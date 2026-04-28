import { Textbook } from './types';

const TEXTBOOKS_KEY = 'mrcp_textbooks';
const NOTES_KEY = 'mrcp_textbook_notes';

// ── Textbook CRUD ─────────────────────────────────────────────────────────────

export function getTextbooks(): Textbook[] {
  try {
    return JSON.parse(localStorage.getItem(TEXTBOOKS_KEY) ?? '[]') as Textbook[];
  } catch {
    return [];
  }
}

export function saveTextbook(tb: Textbook): void {
  const list = getTextbooks();
  const idx = list.findIndex((t) => t.id === tb.id);
  if (idx >= 0) list[idx] = tb;
  else list.push(tb);
  try {
    localStorage.setItem(TEXTBOOKS_KEY, JSON.stringify(list));
  } catch { /* quota */ }
}

export function deleteTextbook(id: string): void {
  const list = getTextbooks().filter((t) => t.id !== id);
  try {
    localStorage.setItem(TEXTBOOKS_KEY, JSON.stringify(list));
  } catch { /* quota */ }
  // Also remove associated note
  const notes = getAllNotes();
  delete notes[id];
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  } catch { /* quota */ }
}

export function getTextbooksByPart(part: 'Part 1' | 'Part 2'): Textbook[] {
  return getTextbooks().filter((t) => t.part === part);
}

// ── Per-Textbook Notes ────────────────────────────────────────────────────────

function getAllNotes(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

export function getTextbookNote(id: string): string {
  return getAllNotes()[id] ?? '';
}

export function saveTextbookNote(id: string, note: string): void {
  const notes = getAllNotes();
  notes[id] = note;
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  } catch { /* quota */ }
}

// ── Generate ID ───────────────────────────────────────────────────────────────

export function generateTextbookId(): string {
  return `tb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
