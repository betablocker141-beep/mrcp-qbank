// ── Notes, Highlights & Bookmarks Store ──────────────────────

const NOTES_KEY = 'mrcp_notes';
const BOOKMARKS_KEY = 'mrcp_bookmarks';
const HIGHLIGHTS_KEY = 'mrcp_highlights';

export type HighlightColor = 'yellow' | 'green' | 'pink' | 'blue';

export interface Highlight {
  id: string;
  questionId: string;
  start: number;
  end: number;
  color: HighlightColor;
  text: string;
}

export interface QuestionNote {
  questionId: string;
  content: string;
  updatedAt: string;
}

// ── Notes ────────────────────────────────────────────────────
export function getNotes(): Record<string, QuestionNote> {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveNote(questionId: string, content: string): void {
  const notes = getNotes();
  if (!content.trim()) {
    delete notes[questionId];
  } else {
    notes[questionId] = { questionId, content, updatedAt: new Date().toISOString() };
  }
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

export function getNote(questionId: string): QuestionNote | null {
  return getNotes()[questionId] ?? null;
}

export function deleteNote(questionId: string): void {
  const notes = getNotes();
  delete notes[questionId];
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

// ── Bookmarks ────────────────────────────────────────────────
export function getBookmarks(): Set<string> {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function toggleBookmark(questionId: string): boolean {
  const bookmarks = getBookmarks();
  if (bookmarks.has(questionId)) {
    bookmarks.delete(questionId);
  } else {
    bookmarks.add(questionId);
  }
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...bookmarks]));
  return bookmarks.has(questionId);
}

export function isBookmarked(questionId: string): boolean {
  return getBookmarks().has(questionId);
}

export function getAllBookmarkedIds(): string[] {
  return [...getBookmarks()];
}

// ── Highlights ────────────────────────────────────────────────
export function getHighlights(): Record<string, Highlight[]> {
  try {
    const raw = localStorage.getItem(HIGHLIGHTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getHighlightsForQuestion(questionId: string): Highlight[] {
  return getHighlights()[questionId] ?? [];
}

export function addHighlight(highlight: Highlight): void {
  const all = getHighlights();
  if (!all[highlight.questionId]) all[highlight.questionId] = [];
  // Remove overlapping highlights
  all[highlight.questionId] = all[highlight.questionId].filter(
    (h) => h.end <= highlight.start || h.start >= highlight.end
  );
  all[highlight.questionId].push(highlight);
  all[highlight.questionId].sort((a, b) => a.start - b.start);
  localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(all));
}

export function removeHighlight(questionId: string, highlightId: string): void {
  const all = getHighlights();
  if (all[questionId]) {
    all[questionId] = all[questionId].filter((h) => h.id !== highlightId);
  }
  localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(all));
}

export function clearHighlightsForQuestion(questionId: string): void {
  const all = getHighlights();
  delete all[questionId];
  localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(all));
}

// ── Summary Stats ─────────────────────────────────────────────
export function getStudyToolsStats() {
  return {
    notesCount: Object.keys(getNotes()).length,
    bookmarksCount: getBookmarks().size,
    highlightsCount: Object.values(getHighlights()).reduce((sum, arr) => sum + arr.length, 0),
  };
}
