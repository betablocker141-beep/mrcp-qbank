import { useState, useEffect, useRef, useCallback } from 'react';
import { Textbook } from '../types';
import {
  getTextbooks, getTextbookNote, saveTextbookNote,
} from '../textbookStore';

// ── Icons ─────────────────────────────────────────────────────────────────────
const BookIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);
const NotesIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const FullscreenIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
  </svg>
);
const CollapseIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
  </svg>
);
const SaveIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
  </svg>
);
const ExternalLinkIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ part }: { part: 'Part 1' | 'Part 2' }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-24 text-center">
      <div className="w-20 h-20 bg-violet-100 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-sm">
        <span className="text-4xl">📚</span>
      </div>
      <h3 className="text-lg font-bold text-gray-800 mb-2">No Textbooks Yet</h3>
      <p className="text-gray-500 text-sm max-w-xs">
        No Passmedicine {part} textbooks have been uploaded. Ask your admin to add textbooks via the Admin Panel.
      </p>
    </div>
  );
}

// ── Textbook Card ─────────────────────────────────────────────────────────────
function TextbookCard({
  tb, selected, onClick,
}: { tb: Textbook; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all group ${
        selected
          ? 'bg-violet-600 text-white border-violet-600 shadow-lg'
          : 'bg-white text-gray-800 border-gray-200 hover:border-violet-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-12 rounded-lg flex items-center justify-center text-lg flex-shrink-0 shadow-sm ${
          selected ? 'bg-white/20' : 'bg-violet-100'
        }`}>
          📖
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-sm leading-tight mb-1 truncate ${selected ? 'text-white' : 'text-gray-800'}`}>
            {tb.title}
          </div>
          {tb.description && (
            <div className={`text-xs line-clamp-2 ${selected ? 'text-violet-200' : 'text-gray-500'}`}>
              {tb.description}
            </div>
          )}
          <div className={`text-xs mt-1 font-medium ${selected ? 'text-violet-200' : 'text-gray-400'}`}>
            {new Date(tb.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── PDF Viewer ────────────────────────────────────────────────────────────────
function PdfViewer({ url, title }: { url: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [url]);

  // Try to make the URL embeddable
  // Google Drive: convert /file/d/ID/view → /file/d/ID/preview
  const embedUrl = url
    .replace(/\/view(\?.*)?$/, '/preview')
    .replace(/\/edit(\?.*)?$/, '/preview');

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="text-5xl mb-4">⚠️</div>
        <h3 className="text-lg font-bold text-gray-700 mb-2">Cannot embed this PDF</h3>
        <p className="text-gray-500 text-sm mb-6 max-w-md">
          This PDF URL cannot be displayed in an embedded viewer. Try opening it in a new tab instead.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition shadow"
        >
          <ExternalLinkIcon />
          Open in New Tab
        </a>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-4" />
          <div className="text-gray-500 font-medium text-sm">Loading {title}…</div>
        </div>
      )}
      <iframe
        src={embedUrl}
        title={title}
        className="w-full h-full border-0"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        allow="fullscreen"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
    </div>
  );
}

// ── Notes Panel ───────────────────────────────────────────────────────────────
function NotesPanel({ textbookId }: { textbookId: string }) {
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setNote(getTextbookNote(textbookId));
    setSaved(false);
  }, [textbookId]);

  const handleChange = useCallback((val: string) => {
    setNote(val);
    setSaved(false);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTextbookNote(textbookId, val);
      setSaved(true);
    }, 800);
  }, [textbookId]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <NotesIcon className="w-4 h-4 text-violet-600" />
          <span className="font-semibold text-gray-800 text-sm">My Notes</span>
        </div>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <SaveIcon className="w-3 h-3" /> Saved
          </span>
        )}
      </div>
      <textarea
        value={note}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Write your notes for this textbook here...&#10;&#10;• Key concepts&#10;• Important tables&#10;• Things to remember"
        className="flex-1 resize-none p-4 text-sm text-gray-700 placeholder-gray-300 bg-white focus:outline-none"
      />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TextbookView() {
  const [activePart, setActivePart] = useState<'Part 1' | 'Part 2'>('Part 1');
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    setTextbooks(getTextbooks());
  }, []);

  const partBooks = textbooks.filter((t) => t.part === activePart);
  const selectedBook = textbooks.find((t) => t.id === selectedId) ?? null;

  const handlePartChange = (p: 'Part 1' | 'Part 2') => {
    setActivePart(p);
    setSelectedId(null);
  };

  return (
    <div className={`${fullscreen ? 'fixed inset-0 z-[9999]' : 'min-h-screen'} bg-gray-50 flex flex-col`}>

      {/* ── Header ── */}
      {!fullscreen && (
        <div className="bg-gradient-to-r from-violet-900 via-purple-800 to-indigo-900 text-white px-4 py-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-violet-500/30 text-violet-100 text-xs font-bold px-3 py-1 rounded-full border border-violet-400/30">
                    📚 Passmedicine Textbooks
                  </span>
                </div>
                <h1 className="text-2xl font-extrabold">Study Textbooks</h1>
                <p className="text-violet-300 text-sm mt-0.5">Read, annotate and highlight Passmedicine resources</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-extrabold">{partBooks.length}</div>
                <div className="text-violet-300 text-xs">textbooks</div>
              </div>
            </div>

            {/* Part tabs */}
            <div className="flex gap-2">
              {(['Part 1', 'Part 2'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePartChange(p)}
                  className={`px-5 py-2 rounded-xl font-bold text-sm transition-all border-2 ${
                    activePart === p
                      ? 'bg-white text-violet-900 border-white shadow-lg'
                      : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  {p === 'Part 1' ? '📘' : '📗'} {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden max-w-7xl mx-auto w-full">

        {/* Sidebar — textbook list */}
        {!fullscreen && (
          <div className="w-72 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
            <div className="p-3 border-b border-gray-100 bg-gray-50">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Passmedicine {activePart} ({partBooks.length})
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {partBooks.length === 0 ? (
                <EmptyState part={activePart} />
              ) : (
                partBooks.map((tb) => (
                  <TextbookCard
                    key={tb.id}
                    tb={tb}
                    selected={selectedId === tb.id}
                    onClick={() => setSelectedId(tb.id)}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* Main viewer area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Viewer toolbar */}
          <div className={`flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white shadow-sm flex-shrink-0`}>
            <div className="flex items-center gap-2">
              {fullscreen && (
                <button
                  onClick={() => setFullscreen(false)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition mr-2"
                >
                  ← Back
                </button>
              )}
              <BookIcon className="w-4 h-4 text-violet-600" />
              <span className="font-semibold text-gray-700 text-sm truncate max-w-xs">
                {selectedBook ? selectedBook.title : 'Select a textbook'}
              </span>
              {selectedBook && (
                <span className="bg-violet-100 text-violet-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {selectedBook.part}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedBook && (
                <a
                  href={selectedBook.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-violet-600 bg-gray-100 hover:bg-violet-50 px-3 py-1.5 rounded-lg transition"
                >
                  <ExternalLinkIcon /> Open Tab
                </a>
              )}
              {selectedBook && !fullscreen && (
                <button
                  onClick={() => setShowNotes(!showNotes)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                    showNotes
                      ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <NotesIcon className="w-3.5 h-3.5" />
                  Notes
                </button>
              )}
              {selectedBook && (
                <button
                  onClick={() => { setFullscreen(!fullscreen); setShowNotes(false); }}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition"
                >
                  {fullscreen ? <CollapseIcon className="w-3.5 h-3.5" /> : <FullscreenIcon className="w-3.5 h-3.5" />}
                  {fullscreen ? 'Exit' : 'Fullscreen'}
                </button>
              )}
            </div>
          </div>

          {/* PDF + Notes layout */}
          <div className="flex flex-1 overflow-hidden">
            {/* PDF iframe */}
            <div className="flex-1 overflow-hidden bg-gray-100">
              {selectedBook ? (
                <PdfViewer url={selectedBook.pdfUrl} title={selectedBook.title} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <div className="w-20 h-20 bg-violet-100 rounded-3xl flex items-center justify-center mb-5 shadow-sm">
                    <span className="text-4xl">📖</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-700 mb-2">Select a Textbook</h3>
                  <p className="text-gray-400 text-sm max-w-xs">
                    Choose a textbook from the sidebar to start reading
                  </p>
                </div>
              )}
            </div>

            {/* Notes panel */}
            {showNotes && selectedBook && !fullscreen && (
              <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-white flex flex-col shadow-xl">
                <NotesPanel textbookId={selectedBook.id} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
