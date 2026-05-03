import { OneLiner, OneLinerSource } from './types';
import { supabase } from './lib/supabase';

const KEY = 'mrcp_oneliners';
const PAGE_SIZE = 1000;

// ── Core helpers ──────────────────────────────────────────────────────────────

export function getOneLiners(): OneLiner[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as OneLiner[];
  } catch {
    return [];
  }
}

function persist(liners: OneLiner[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(liners));
  } catch { /* quota */ }
}

// ── Supabase sync ─────────────────────────────────────────────────────────────

function rowToOneLiner(row: Record<string, unknown>): OneLiner {
  return {
    id: row.id as string,
    source: row.source as OneLinerSource,
    part: row.part as OneLiner['part'],
    system: row.system as string,
    topic: (row.topic as string) ?? undefined,
    content: row.content as string,
    explanation: (row.explanation as string) ?? undefined,
    tags: (row.tags as string[]) ?? undefined,
  };
}

function oneLinerToRow(l: OneLiner) {
  return {
    id: l.id,
    source: l.source,
    part: l.part,
    system: l.system,
    topic: l.topic ?? null,
    content: l.content,
    explanation: l.explanation ?? null,
    tags: l.tags ?? null,
  };
}

/** Fetch all one-liners from Supabase, cache in localStorage, return them. */
export async function syncOneLinersFromSupabase(): Promise<OneLiner[]> {
  try {
    const allRows: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('one_liners')
        .select('*')
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allRows.push(...data);
        from += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    if (allRows.length > 0) {
      const liners = allRows.map(rowToOneLiner);
      persist(liners);
      return liners;
    }
  } catch (err) {
    console.warn('[oneLinerStore] Supabase sync failed, using localStorage:', err);
  }
  return getOneLiners();
}

/** Upsert a batch of one-liners into Supabase (used by AdminPanel after import). */
export async function pushOneLinersToSupabase(liners: OneLiner[]): Promise<{ ok: boolean; error?: string }> {
  try {
    // Deduplicate by id — keep the last occurrence to avoid ON CONFLICT errors
    const seen = new Map<string, OneLiner>();
    for (const l of liners) seen.set(l.id, l);
    const rows = [...seen.values()].map(oneLinerToRow);

    // Upsert in chunks of 500 to avoid request size limits
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase.from('one_liners').upsert(chunk, { onConflict: 'id' });
      if (error) throw error;
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message ?? String(err) };
  }
}

/** Delete one-liners from Supabase by source. */
export async function clearOneLinersInSupabase(source?: OneLinerSource): Promise<void> {
  try {
    const query = supabase.from('one_liners').delete();
    if (source) {
      await query.eq('source', source);
    } else {
      await query.neq('id', ''); // delete all
    }
  } catch (err) {
    console.warn('[oneLinerStore] Supabase clear failed:', err);
  }
}

// ── CRUD (localStorage) ───────────────────────────────────────────────────────

export function addOneLiner(liner: OneLiner): void {
  const list = getOneLiners();
  list.push(liner);
  persist(list);
}

export function bulkAddOneLiners(liners: OneLiner[]): { added: number; updated: number; skipped: number } {
  const list = getOneLiners();
  const key = (l: OneLiner) => `${l.source}::${l.system}::${l.id}`;
  const existingKeys = new Set(list.map(key));
  const updated = list.map((l) => {
    const incoming = liners.find((n) => n.id === l.id && n.source === l.source && n.system === l.system);
    return incoming ?? l;
  });
  const brandNew = liners.filter((l) => !existingKeys.has(key(l)));
  const updatedCount = liners.length - brandNew.length;
  persist([...updated, ...brandNew]);
  return { added: brandNew.length, updated: updatedCount, skipped: 0 };
}

export function updateOneLiner(liner: OneLiner): void {
  const list = getOneLiners();
  const idx = list.findIndex((l) => l.id === liner.id);
  if (idx >= 0) {
    list[idx] = liner;
    persist(list);
  }
}

export function deleteOneLiner(id: string): void {
  persist(getOneLiners().filter((l) => l.id !== id));
}

export function clearOneLiners(source?: OneLinerSource): void {
  if (!source) {
    localStorage.removeItem(KEY);
    return;
  }
  persist(getOneLiners().filter((l) => l.source !== source));
}

// ── Filtered access ───────────────────────────────────────────────────────────

export function getOneLinersBySource(source: OneLinerSource): OneLiner[] {
  return getOneLiners().filter((l) => l.source === source);
}

// ── Generate ID ───────────────────────────────────────────────────────────────

export function generateOneLinerBatchIds(count: number, prefix: string): string[] {
  const base = Date.now();
  return Array.from({ length: count }, (_, i) => `${prefix}_${base}_${i}`);
}
