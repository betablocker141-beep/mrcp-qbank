import { OneLiner, OneLinerSource } from './types';

const KEY = 'mrcp_oneliners';

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

// ── CRUD ──────────────────────────────────────────────────────────────────────

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
