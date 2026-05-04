import { OneLiner, OneLinerSource } from './types';
import { supabase } from './lib/supabase';

const KEY = 'mrcp_oneliners';
const PAGE_SIZE = 1000;

// In-memory session cache — prevents multiple Supabase fetches per session
// and stops the count from flickering on re-renders.
let _cache: OneLiner[] | null = null;
let _fetchPromise: Promise<OneLiner[]> | null = null;

export function invalidateOneLinerCache(): void {
  _cache = null;
  _fetchPromise = null;
}

// Composite uniqueness key — pearls from different sources OR different
// systems within the same source can share raw ids (e.g. Cardiology and
// Dermatology JSONs both number their pearls "ol_001"…"ol_161"), so we MUST
// dedup by (source, system, id) — never by anything narrower — or distinct
// pearls collapse on Supabase's id PK.
const compositeKey = (l: OneLiner) => `${l.source}::${l.system}::${l.id}`;

// Ensure a pearl's id is globally unique by prefixing source AND system.
// Idempotent — safe to call on already-namespaced ids (and on ids that were
// stamped by the earlier source-only scheme: those get upgraded in place).
export function namespaceOneLinerId(source: OneLinerSource, system: string, rawId: string): string {
  const fullPrefix = `${source}::${system}::`;
  if (rawId.startsWith(fullPrefix)) return rawId;

  // Upgrade legacy source-only namespacing: "Pastest::ol_001" → strip the
  // source prefix before re-stamping with both source and system.
  const sourcePrefix = `${source}::`;
  const stripped = rawId.startsWith(sourcePrefix) ? rawId.slice(sourcePrefix.length) : rawId;

  return `${fullPrefix}${stripped}`;
}

// ── Core helpers ──────────────────────────────────────────────────────────────

export function getOneLiners(): OneLiner[] {
  if (_cache !== null) return _cache;
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as OneLiner[];
  } catch {
    return [];
  }
}

function persist(liners: OneLiner[]): void {
  _cache = liners;
  try {
    localStorage.setItem(KEY, JSON.stringify(liners));
  } catch {
    // localStorage quota exceeded — Supabase is the source of truth, keep in memory only
  }
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

/**
 * Fetch all one-liners from Supabase and MERGE with localStorage.
 * Merge rule: union by id — Supabase wins on conflicts, but local-only
 * entries are preserved. This means a pearl you imported locally but
 * whose Supabase push failed will never be silently wiped on the next sync.
 *
 * Returns the session cache immediately on subsequent calls.
 */
export async function syncOneLinersFromSupabase(): Promise<OneLiner[]> {
  if (_cache !== null) return _cache;
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = (async () => {
    try {
      const allRows: any[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from('one_liners')
          .select('*')
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      const fromSupabase = allRows.map(rowToOneLiner);

      // Merge: start with local entries, then overwrite/add Supabase entries by id.
      // This preserves any local-only pearls that weren't pushed yet.
      const local = (() => {
        try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as OneLiner[]; }
        catch { return [] as OneLiner[]; }
      })();

      // Merge by COMPOSITE (source, id) key — never by id alone. Two pearls
      // with the same raw id but different sources are distinct pearls and
      // must both survive the merge.
      const merged = new Map<string, OneLiner>();
      for (const l of local) merged.set(compositeKey(l), l);         // local first
      for (const l of fromSupabase) merged.set(compositeKey(l), l);  // Supabase wins on conflict

      const result = [...merged.values()];
      persist(result);
      return result;
    } catch (err) {
      console.warn('[oneLinerStore] Supabase sync failed, using localStorage:', err);
      const local = getOneLiners();
      _cache = local;
      return local;
    } finally {
      _fetchPromise = null;
    }
  })();

  return _fetchPromise;
}

/**
 * Upsert a batch of one-liners into Supabase.
 * Handles any number of entries by chunking into batches of 500.
 */
export async function pushOneLinersToSupabase(liners: OneLiner[]): Promise<{ ok: boolean; error?: string }> {
  try {
    // Deduplicate by COMPOSITE (source, id) — never by id alone, or pearls
    // from different sources sharing the same raw id collapse to one row.
    const seen = new Map<string, OneLiner>();
    for (const l of liners) seen.set(compositeKey(l), l);
    const rows = [...seen.values()].map(oneLinerToRow);

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

/**
 * One-time migration: rename Supabase rows whose `id` isn't fully namespaced
 * to `${source}::${system}::${rawId}`. Catches both:
 *   - bare ids ("ol_001"),
 *   - source-only ids from the earlier fix scheme ("Pastest::ol_001").
 * Same fix is applied to localStorage. Idempotent.
 *
 * Note: this CANNOT recover pearls already lost in Supabase (e.g. cardio
 * rows that were overwritten by derma pearls sharing the same id) — those
 * pearls must be re-imported. The migration only renames surviving rows so
 * future imports can't collide again.
 */
export async function migrateLegacyBareIds(): Promise<{ migrated: number; error?: string }> {
  try {
    // 1. Fetch all rows from Supabase.
    const allRows: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('one_liners')
        .select('*')
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    // 2. Identify rows that need renaming. A row is "fully namespaced" only
    //    if its id starts with `${source}::${system}::`.
    const legacy = allRows.filter((r) => {
      if (typeof r.id !== 'string' || typeof r.source !== 'string' || typeof r.system !== 'string') return false;
      return !r.id.startsWith(`${r.source}::${r.system}::`);
    });

    // 3. Compute new namespaced ids and update Supabase: upsert new rows,
    //    then delete the old (different-id) ones.
    if (legacy.length > 0) {
      const newRows = legacy.map((r) => ({
        ...r,
        id: namespaceOneLinerId(r.source as OneLinerSource, r.system as string, r.id as string),
      }));
      const chunkSize = 500;
      for (let i = 0; i < newRows.length; i += chunkSize) {
        const chunk = newRows.slice(i, i + chunkSize);
        const { error } = await supabase
          .from('one_liners')
          .upsert(chunk, { onConflict: 'id' });
        if (error) throw error;
      }
      // Delete each old row only if its id actually changed (always true here,
      // since `legacy` was filtered for it). Match on id+source+system to
      // avoid touching anything we just inserted under the new id.
      for (let i = 0; i < legacy.length; i++) {
        const oldRow = legacy[i];
        const newId = newRows[i].id;
        if (oldRow.id === newId) continue;
        const { error } = await supabase
          .from('one_liners')
          .delete()
          .eq('id', oldRow.id)
          .eq('source', oldRow.source)
          .eq('system', oldRow.system);
        if (error) throw error;
      }
    }

    // 4. Migrate localStorage: rewrite any non-fully-namespaced pearls.
    const local = (() => {
      try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as OneLiner[]; }
      catch { return [] as OneLiner[]; }
    })();
    let localChanged = false;
    const fixed = local.map((l) => {
      const ns = namespaceOneLinerId(l.source, l.system, l.id);
      if (ns !== l.id) { localChanged = true; return { ...l, id: ns }; }
      return l;
    });
    // Dedupe by composite key in case the rename created collisions with
    // already-namespaced entries.
    const dedup = new Map<string, OneLiner>();
    for (const l of fixed) dedup.set(compositeKey(l), l);
    if (localChanged || dedup.size !== fixed.length) {
      persist([...dedup.values()]);
    }

    invalidateOneLinerCache();
    return { migrated: legacy.length };
  } catch (err: any) {
    return { migrated: 0, error: err.message ?? String(err) };
  }
}

/** Delete one-liners from Supabase by source. */
export async function clearOneLinersInSupabase(source?: OneLinerSource): Promise<void> {
  try {
    const query = supabase.from('one_liners').delete();
    if (source) {
      await query.eq('source', source);
    } else {
      await query.neq('id', '');
    }
  } catch (err) {
    console.warn('[oneLinerStore] Supabase clear failed:', err);
  }
  invalidateOneLinerCache();
}

/** Delete one-liners matching source + optional part + optional system from both localStorage and Supabase. */
export async function deleteOneLinersByFilter(
  source: OneLinerSource,
  part?: OneLiner['part'],
  system?: string,
): Promise<{ removed: number; error?: string }> {
  const before = getOneLiners();
  const kept = before.filter((l) => {
    if (l.source !== source) return true;
    if (part && l.part !== part) return true;
    if (system && l.system !== system) return true;
    return false;
  });
  persist(kept);
  const removed = before.length - kept.length;

  try {
    let query = supabase.from('one_liners').delete().eq('source', source);
    if (part) query = (query as any).eq('part', part);
    if (system) query = (query as any).eq('system', system);
    const { error } = await query;
    if (error) throw error;
  } catch (err: any) {
    return { removed, error: err.message ?? String(err) };
  }

  invalidateOneLinerCache();
  return { removed };
}

// ── CRUD (localStorage + cache) ───────────────────────────────────────────────

export function addOneLiner(liner: OneLiner): void {
  const list = getOneLiners();
  list.push(liner);
  persist(list);
}

export function bulkAddOneLiners(liners: OneLiner[]): { added: number; updated: number; skipped: number } {
  const list = getOneLiners();
  const incomingByKey = new Map(liners.map((l) => [compositeKey(l), l]));
  const existingKeys = new Set(list.map(compositeKey));

  const updated = list.map((l) => incomingByKey.get(compositeKey(l)) ?? l);
  const brandNew = liners.filter((l) => !existingKeys.has(compositeKey(l)));
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
    _cache = null;
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
