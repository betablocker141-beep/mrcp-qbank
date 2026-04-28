import { useState, useEffect, useRef } from 'react';
import {
  getNote, saveNote,
  isBookmarked, toggleBookmark,
  getHighlightsForQuestion, addHighlight, removeHighlight, clearHighlightsForQuestion,
  Highlight, HighlightColor,
} from '../notesStore';

type PanelTabExternal = 'highlights' | 'notes' | 'bookmarks';

interface Props {
  questionId: string;
  stemText: string;
  onBookmarkChange?: (bookmarked: boolean) => void;
  defaultTab?: PanelTabExternal;
}

const HIGHLIGHT_COLORS: { color: HighlightColor; bg: string; label: string; ring: string }[] = [
  { color: 'yellow', bg: 'bg-yellow-200', label: 'Yellow', ring: 'ring-yellow-400' },
  { color: 'green',  bg: 'bg-green-200',  label: 'Green',  ring: 'ring-green-400' },
  { color: 'pink',   bg: 'bg-pink-200',   label: 'Pink',   ring: 'ring-pink-400' },
  { color: 'blue',   bg: 'bg-blue-200',   label: 'Blue',   ring: 'ring-blue-400' },
];

const COLOR_CLASS: Record<HighlightColor, string> = {
  yellow: 'bg-yellow-200',
  green:  'bg-green-200',
  pink:   'bg-pink-200',
  blue:   'bg-blue-200',
};

function generateHighlightId() {
  return `hl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// Render stem text with highlights
function HighlightedStem({
  text,
  highlights,
  onRemove,
}: {
  text: string;
  highlights: Highlight[];
  onRemove: (id: string) => void;
}) {
  if (highlights.length === 0) {
    return <span className="whitespace-pre-wrap text-gray-800 leading-relaxed">{text}</span>;
  }

  const parts: { text: string; highlight?: Highlight }[] = [];
  let cursor = 0;
  const sorted = [...highlights].sort((a, b) => a.start - b.start);

  for (const hl of sorted) {
    if (hl.start > cursor) {
      parts.push({ text: text.slice(cursor, hl.start) });
    }
    parts.push({ text: text.slice(hl.start, hl.end), highlight: hl });
    cursor = hl.end;
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor) });
  }

  return (
    <span className="whitespace-pre-wrap text-gray-800 leading-relaxed">
      {parts.map((part, i) =>
        part.highlight ? (
          <mark
            key={i}
            className={`${COLOR_CLASS[part.highlight.color]} rounded cursor-pointer hover:opacity-70 transition`}
            title="Click to remove highlight"
            onClick={() => onRemove(part.highlight!.id)}
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </span>
  );
}

type PanelTab = 'highlights' | 'notes' | 'bookmarks';

export default function StudyToolsPanel({ questionId, stemText, onBookmarkChange, defaultTab }: Props) {
  const [activeTab, setActiveTab] = useState<PanelTab>(defaultTab ?? 'highlights');

  // Sync active tab when defaultTab prop changes
  useEffect(() => {
    if (defaultTab) setActiveTab(defaultTab);
  }, [defaultTab]);
  const [bookmarked, setBookmarked] = useState(() => isBookmarked(questionId));
  const [highlights, setHighlights] = useState<Highlight[]>(() => getHighlightsForQuestion(questionId));
  const [noteContent, setNoteContent] = useState(() => getNote(questionId)?.content ?? '');
  const [noteSaved, setNoteSaved] = useState(false);
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow');
  const [isSelecting, setIsSelecting] = useState(false);
  const stemRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset when question changes
  useEffect(() => {
    setBookmarked(isBookmarked(questionId));
    setHighlights(getHighlightsForQuestion(questionId));
    setNoteContent(getNote(questionId)?.content ?? '');
    setNoteSaved(false);
  }, [questionId]);

  // Auto-save note with debounce
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveNote(questionId, noteContent);
      if (noteContent.trim()) setNoteSaved(true);
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [noteContent, questionId]);

  const handleBookmark = () => {
    const next = toggleBookmark(questionId);
    setBookmarked(next);
    onBookmarkChange?.(next);
  };

  const handleHighlight = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !stemRef.current) return;
    const range = selection.getRangeAt(0);
    const preRange = document.createRange();
    preRange.selectNodeContents(stemRef.current);
    preRange.setEnd(range.startContainer, range.startOffset);
    const start = preRange.toString().length;
    const selectedText = range.toString();
    const end = start + selectedText.length;
    if (start === end || !selectedText.trim()) return;

    const hl: Highlight = {
      id: generateHighlightId(),
      questionId,
      start,
      end,
      color: selectedColor,
      text: selectedText,
    };
    addHighlight(hl);
    setHighlights(getHighlightsForQuestion(questionId));
    selection.removeAllRanges();
  };

  const handleRemoveHighlight = (id: string) => {
    removeHighlight(questionId, id);
    setHighlights(getHighlightsForQuestion(questionId));
  };

  const handleClearHighlights = () => {
    clearHighlightsForQuestion(questionId);
    setHighlights([]);
  };

  const tabs: { id: PanelTab; label: string; icon: string }[] = [
    { id: 'highlights', label: 'Highlight', icon: '✏️' },
    { id: 'notes',      label: 'Notes',     icon: '📝' },
    { id: 'bookmarks',  label: 'Bookmark',  icon: bookmarked ? '🔖' : '🔖' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Tab Header */}
      <div className="flex border-b border-gray-100 bg-gray-50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-indigo-700 border-b-2 border-indigo-500'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.id === 'notes' && noteContent.trim() && (
              <span className="w-2 h-2 bg-amber-400 rounded-full" />
            )}
            {tab.id === 'bookmarks' && bookmarked && (
              <span className="w-2 h-2 bg-indigo-500 rounded-full" />
            )}
            {tab.id === 'highlights' && highlights.length > 0 && (
              <span className="text-xs bg-yellow-100 text-yellow-700 rounded-full px-1.5 font-bold">
                {highlights.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Highlights Tab ──────────────────────────────────────── */}
      {activeTab === 'highlights' && (
        <div className="p-4 space-y-4">
          {/* Color picker + instructions */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-gray-500 font-medium">Color:</span>
            <div className="flex gap-2">
              {HIGHLIGHT_COLORS.map(({ color, bg, label, ring }) => (
                <button
                  key={color}
                  title={label}
                  onClick={() => setSelectedColor(color)}
                  className={`w-7 h-7 rounded-full ${bg} border-2 transition-all ${
                    selectedColor === color
                      ? `border-gray-700 ring-2 ${ring} ring-offset-1 scale-110`
                      : 'border-transparent hover:scale-105'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={handleHighlight}
              onMouseDown={() => setIsSelecting(true)}
              onMouseUp={() => setIsSelecting(false)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-amber-900 rounded-lg text-xs font-bold transition"
            >
              ✏️ Apply to Selection
            </button>
          </div>

          {/* Stem with highlights */}
          <div
            ref={stemRef}
            className={`p-4 bg-gray-50 rounded-xl border text-sm leading-relaxed select-text cursor-text ${
              isSelecting ? 'border-amber-300 bg-amber-50' : 'border-gray-200'
            }`}
            onMouseUp={handleHighlight}
          >
            <HighlightedStem
              text={stemText}
              highlights={highlights}
              onRemove={handleRemoveHighlight}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              💡 Select text above then click "Apply" or release mouse to highlight
            </p>
            {highlights.length > 0 && (
              <button
                onClick={handleClearHighlights}
                className="text-xs text-red-400 hover:text-red-600 transition font-medium"
              >
                Clear all ({highlights.length})
              </button>
            )}
          </div>

          {/* Highlight list */}
          {highlights.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Your highlights
              </p>
              {highlights.map((hl) => (
                <div
                  key={hl.id}
                  className={`flex items-start gap-2 p-2 rounded-lg ${COLOR_CLASS[hl.color]} group`}
                >
                  <span className="flex-1 text-xs text-gray-700 leading-relaxed line-clamp-2">
                    "{hl.text}"
                  </span>
                  <button
                    onClick={() => handleRemoveHighlight(hl.id)}
                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition text-xs shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {highlights.length === 0 && (
            <div className="text-center py-4 text-gray-400">
              <div className="text-3xl mb-1">🖌️</div>
              <p className="text-sm">No highlights yet. Select text and apply a colour.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Notes Tab ──────────────────────────────────────────── */}
      {activeTab === 'notes' && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Personal Notes
            </p>
            {noteSaved && noteContent.trim() && (
              <span className="text-xs text-emerald-600 flex items-center gap-1">
                <span>✓</span> Saved
              </span>
            )}
          </div>
          <textarea
            className="w-full h-36 p-3 border border-gray-200 rounded-xl text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 placeholder-gray-300 leading-relaxed"
            placeholder="Add your notes, mnemonics, or key points here…&#10;&#10;e.g. Remember: ACE inhibitors → first-line in diabetic nephropathy (NICE NG28)"
            value={noteContent}
            onChange={(e) => {
              setNoteContent(e.target.value);
              setNoteSaved(false);
            }}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Notes are auto-saved and linked to this question
            </p>
            {noteContent.trim() && (
              <button
                onClick={() => { setNoteContent(''); saveNote(questionId, ''); setNoteSaved(false); }}
                className="text-xs text-red-400 hover:text-red-600 transition font-medium"
              >
                Clear note
              </button>
            )}
          </div>

          {/* Quick templates */}
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-400 mb-2 font-medium">Quick templates:</p>
            <div className="flex flex-wrap gap-2">
              {[
                '🔑 Key point: ',
                '⚠️ Pitfall: ',
                '🧠 Mnemonic: ',
                '📚 Reference: ',
                '💊 Drug: ',
              ].map((tmpl) => (
                <button
                  key={tmpl}
                  onClick={() => setNoteContent((p) => p + (p && !p.endsWith('\n') ? '\n' : '') + tmpl)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded-lg transition"
                >
                  {tmpl}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Bookmark Tab ──────────────────────────────────────── */}
      {activeTab === 'bookmarks' && (
        <div className="p-6 text-center space-y-4">
          <button
            onClick={handleBookmark}
            className={`mx-auto flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all w-full ${
              bookmarked
                ? 'border-indigo-300 bg-indigo-50 hover:bg-indigo-100'
                : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
            }`}
          >
            <span className="text-5xl transition-transform hover:scale-110">
              {bookmarked ? '🔖' : '🏷️'}
            </span>
            <div>
              <div className={`font-bold text-base ${bookmarked ? 'text-indigo-700' : 'text-gray-600'}`}>
                {bookmarked ? 'Bookmarked!' : 'Bookmark this question'}
              </div>
              <div className="text-sm text-gray-400 mt-0.5">
                {bookmarked
                  ? 'Click to remove bookmark'
                  : 'Save for later review or custom quiz'}
              </div>
            </div>
          </button>

          {bookmarked && (
            <div className="text-xs text-gray-400 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
              💡 <strong>Tip:</strong> You can start a quiz from your bookmarked questions in the Question Bank using the <em>"Bookmarks Only"</em> filter.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
