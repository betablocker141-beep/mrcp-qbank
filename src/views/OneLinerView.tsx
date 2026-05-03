import { useState, useMemo, useEffect, useCallback } from 'react';
import { OneLiner, OneLinerSource, SYSTEMS, SYSTEM_ICONS } from '../types';
import { getOneLiners, syncOneLinersFromSupabase } from '../oneLinerStore';

// ── Icons ─────────────────────────────────────────────────────────────────────
const SearchIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const XIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const FlipIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);
const ShuffleIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
  </svg>
);
const CheckIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);
const ChevronIcon = ({ className = 'w-5 h-5', dir = 'right' }: { className?: string; dir?: 'left' | 'right' | 'down' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d={dir === 'right' ? 'M9 5l7 7-7 7' : dir === 'left' ? 'M15 19l-7-7 7-7' : 'M19 9l-7 7-7-7'} />
  </svg>
);
const GridIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);
const ListIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
);
const KeyboardIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
  </svg>
);

// ── Source config ─────────────────────────────────────────────────────────────
const SOURCE_CONFIG: Record<OneLinerSource, {
  color: string; bg: string; icon: string;
  gradient: string; ring: string; accent: string; dark: string;
}> = {
  Passmedicine: {
    color: 'text-violet-700', bg: 'bg-violet-100 border-violet-200',
    icon: '🟣', gradient: 'from-violet-600 via-purple-600 to-indigo-700',
    ring: 'ring-violet-400', accent: 'bg-violet-600', dark: 'bg-violet-900',
  },
  Pastest: {
    color: 'text-teal-700', bg: 'bg-teal-100 border-teal-200',
    icon: '🟢', gradient: 'from-teal-500 via-emerald-600 to-cyan-700',
    ring: 'ring-teal-400', accent: 'bg-teal-600', dark: 'bg-teal-900',
  },
};

// ── Utility ───────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Flashcard ─────────────────────────────────────────────────────────────────
function Flashcard({
  liner, known, onMark,
}: {
  liner: OneLiner;
  known: boolean;
  onMark: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const src = SOURCE_CONFIG[liner.source];

  // reset flip when card changes
  useEffect(() => { setFlipped(false); }, [liner.id]);

  return (
    <div className="w-full" style={{ perspective: '1200px' }}>
      {/* Card wrapper */}
      <div
        className="relative cursor-pointer select-none"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 0.55s cubic-bezier(0.4, 0.2, 0.2, 1)',
          minHeight: '260px',
        }}
        onClick={() => setFlipped((f) => !f)}
      >
        {/* ── Front ── */}
        <div
          className="absolute inset-0 bg-white rounded-3xl overflow-hidden flex flex-col"
          style={{ backfaceVisibility: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.10)' }}
        >
          {/* Top accent bar */}
          <div className={`h-1.5 w-full bg-gradient-to-r ${src.gradient}`} />

          <div className="flex-1 flex flex-col p-6">
            {/* Badges row */}
            <div className="flex items-center flex-wrap gap-2 mb-4">
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${src.bg} ${src.color}`}>
                <span className="text-sm">{src.icon}</span>
                {liner.source}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 border border-gray-200 px-3 py-1 rounded-full">
                {SYSTEM_ICONS[liner.system] ?? ''} {liner.system}
              </span>
              {liner.topic && (
                <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-3 py-1 rounded-full">
                  {liner.topic}
                </span>
              )}
              <span className={`ml-auto inline-flex items-center text-xs font-bold px-3 py-1 rounded-full text-white bg-gradient-to-r ${src.gradient}`}>
                {liner.part}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 flex items-center justify-center px-2">
              <p className="text-gray-900 text-lg font-semibold text-center leading-relaxed">
                {liner.content}
              </p>
            </div>

            {/* Hint */}
            <div className="flex items-center justify-center gap-1.5 mt-4 text-gray-400 text-xs">
              <FlipIcon className="w-3.5 h-3.5" />
              <span>Tap to reveal explanation</span>
            </div>
          </div>
        </div>

        {/* ── Back ── */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${src.gradient} rounded-3xl overflow-hidden flex flex-col`}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}
        >
          <div className="flex-1 flex flex-col p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-white/60 text-xs font-bold uppercase tracking-widest">Explanation</span>
              <div className="flex-1 h-px bg-white/20" />
              <span className="text-white/60 text-xs">{liner.system}</span>
            </div>

            <div className="flex-1 flex items-start">
              <p className="text-white text-sm leading-relaxed">
                {liner.explanation ?? 'No explanation provided for this pearl.'}
              </p>
            </div>

            {liner.tags && liner.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {liner.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-white/20 text-white border border-white/30 px-2.5 py-0.5 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-center gap-1.5 mt-4 text-white/50 text-xs">
              <FlipIcon className="w-3.5 h-3.5" />
              <span>Tap to flip back</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mark button — below card, stops propagation */}
      <div className="flex justify-center mt-4">
        <button
          onClick={(e) => { e.stopPropagation(); onMark(); }}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all duration-200 ${
            known
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 scale-105'
              : 'bg-white border-2 border-gray-200 text-gray-500 hover:border-emerald-400 hover:text-emerald-600'
          }`}
        >
          <CheckIcon className="w-4 h-4" />
          {known ? 'Marked as Known ✓' : 'Mark as Known'}
        </button>
      </div>
    </div>
  );
}

// ── Flashcard Navigator ───────────────────────────────────────────────────────
function FlashcardNavigator({ liners, srcCfg }: { liners: OneLiner[]; srcCfg: typeof SOURCE_CONFIG[OneLinerSource] }) {
  const [deck, setDeck] = useState<OneLiner[]>(liners);
  const [index, setIndex] = useState(0);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [shuffled, setShuffled] = useState(false);
  const [showKbHint, setShowKbHint] = useState(true);

  // Sync deck when liners change (filter changed)
  useEffect(() => {
    setDeck(liners);
    setIndex(0);
  }, [liners]);

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIndex((i) => Math.min(deck.length - 1, i + 1)), [deck.length]);
  const toggleKnown = useCallback(() => {
    const id = deck[index]?.id;
    if (!id) return;
    setKnown((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, [deck, index]);

  const handleShuffle = () => {
    setDeck(shuffle(liners));
    setIndex(0);
    setShuffled(true);
  };
  const handleReset = () => {
    setDeck(liners);
    setIndex(0);
    setShuffled(false);
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prev(); }
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggleKnown(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prev, next, toggleKnown]);

  if (deck.length === 0) return null;

  const current = deck[index];
  const progress = ((index + 1) / deck.length) * 100;
  const knownCount = known.size;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Top bar: progress + actions */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          {/* Progress bar */}
          <div className="flex-1 bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${srcCfg.gradient} transition-all duration-500`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm font-bold text-gray-600 tabular-nums w-20 text-right">
            {index + 1} / {deck.length}
          </span>
        </div>

        {/* Shuffle / Reset */}
        <button
          onClick={shuffled ? handleReset : handleShuffle}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
            shuffled
              ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          }`}
        >
          <ShuffleIcon className="w-3.5 h-3.5" />
          {shuffled ? 'Reset order' : 'Shuffle'}
        </button>
      </div>

      {/* Known progress strip */}
      {knownCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-700 font-medium">
          <CheckIcon className="w-3.5 h-3.5" />
          {knownCount} of {deck.length} pearls marked as known
          <div className="flex-1 mx-2 bg-emerald-200 rounded-full h-1.5">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${(knownCount / deck.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Card */}
      <Flashcard liner={current} known={known.has(current.id)} onMark={toggleKnown} />

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prev}
          disabled={index === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm transition-all hover:shadow-md"
        >
          <ChevronIcon dir="left" className="w-4 h-4" /> Previous
        </button>

        {/* Dot indicators */}
        <div className="flex gap-1.5 items-center">
          {Array.from({ length: Math.min(9, deck.length) }, (_, i) => {
            const dotIdx = deck.length <= 9 ? i : Math.round(i * (deck.length - 1) / 8);
            const active = deck.length <= 9
              ? i === index
              : Math.abs(dotIdx - index) <= deck.length / 9 / 2;
            const near = deck.length <= 9
              ? Math.abs(i - index) === 1
              : Math.abs(dotIdx - index) <= deck.length / 9;
            return (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  active
                    ? `w-4 h-2.5 ${srcCfg.accent}`
                    : near
                    ? 'w-2 h-2 bg-gray-300'
                    : 'w-1.5 h-1.5 bg-gray-200'
                }`}
              />
            );
          })}
        </div>

        <button
          onClick={next}
          disabled={index === deck.length - 1}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm transition-all hover:shadow-md"
        >
          Next <ChevronIcon dir="right" className="w-4 h-4" />
        </button>
      </div>

      {/* Keyboard hint */}
      {showKbHint && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <KeyboardIcon className="w-3.5 h-3.5" />
            <span>
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-gray-600 font-mono">←→</kbd>
              {' '}navigate · {' '}
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-gray-600 font-mono">K</kbd>
              {' '}mark known · {' '}
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-gray-600 font-mono">Space</kbd>
              {' '}flip
            </span>
          </div>
          <button onClick={() => setShowKbHint(false)} className="hover:text-gray-700">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── List Row ──────────────────────────────────────────────────────────────────
function ListRow({ liner }: { liner: OneLiner }) {
  const [expanded, setExpanded] = useState(false);
  const src = SOURCE_CONFIG[liner.source];

  return (
    <div
      onClick={() => setExpanded((e) => !e)}
      className={`group bg-white rounded-2xl border cursor-pointer transition-all duration-200 overflow-hidden ${
        expanded
          ? 'border-gray-200 shadow-md'
          : 'border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200'
      }`}
    >
      {/* Left accent bar */}
      <div className="flex">
        <div className={`w-1 flex-shrink-0 bg-gradient-to-b ${src.gradient} rounded-l-2xl`} />

        <div className="flex-1 p-4">
          <div className="flex items-start gap-3">
            {/* System icon badge */}
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 bg-gradient-to-br ${src.gradient} shadow-sm`}>
              <span>{SYSTEM_ICONS[liner.system] ?? '💊'}</span>
            </div>

            <div className="flex-1 min-w-0">
              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${src.bg} ${src.color}`}>
                  {liner.source}
                </span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
                  {liner.system}
                </span>
                {liner.topic && (
                  <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-2.5 py-0.5 rounded-full">
                    {liner.topic}
                  </span>
                )}
                <span className="ml-auto text-xs text-gray-400 bg-gray-50 border border-gray-200 px-2.5 py-0.5 rounded-full">
                  {liner.part}
                </span>
              </div>

              {/* Content */}
              <p className="text-gray-800 text-sm font-semibold leading-snug group-hover:text-gray-900 transition-colors">
                {liner.content}
              </p>

              {/* Expanded: explanation */}
              {expanded && (
                <div className="mt-3 space-y-2">
                  {liner.explanation && (
                    <div className={`p-3.5 rounded-xl text-sm text-white bg-gradient-to-br ${src.gradient} leading-relaxed`}>
                      {liner.explanation}
                    </div>
                  )}
                  {liner.tags && liner.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {liner.tags.map((tag) => (
                        <span key={tag} className="text-xs text-gray-500 bg-gray-100 border border-gray-200 px-2.5 py-0.5 rounded-full">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Chevron */}
            <ChevronIcon
              dir="down"
              className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-1 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── System chip bar ───────────────────────────────────────────────────────────
function SystemChips({
  systems,
  selected,
  onSelect,
  srcCfg,
}: {
  systems: string[];
  selected: string;
  onSelect: (s: string) => void;
  srcCfg: typeof SOURCE_CONFIG[OneLinerSource];
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {(['All', ...systems] as string[]).map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all flex-shrink-0 ${
            selected === s
              ? `bg-gradient-to-r ${srcCfg.gradient} text-white border-transparent shadow-md`
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-800'
          }`}
        >
          {s !== 'All' && <span>{SYSTEM_ICONS[s as keyof typeof SYSTEM_ICONS] ?? ''}</span>}
          {s === 'All' ? 'All Systems' : s}
        </button>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function OneLinerView() {
  const [source, setSource] = useState<OneLinerSource>('Passmedicine');
  const [partFilter, setPartFilter] = useState<'All' | 'Part 1' | 'Part 2'>('All');
  const [systemFilter, setSystemFilter] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'flashcard' | 'list'>('list');
  const [allLiners, setAllLiners] = useState<OneLiner[]>(() => getOneLiners());

  // Sync from Supabase when the view is opened (covers the case where localStorage is empty on mobile)
  useEffect(() => {
    syncOneLinersFromSupabase()
      .then((liners) => setAllLiners(liners))
      .catch(() => setAllLiners(getOneLiners()));
  }, []);
  const srcCfg = SOURCE_CONFIG[source];

  const filtered = useMemo(() => {
    return allLiners.filter((l) => {
      if (l.source !== source) return false;
      if (partFilter !== 'All' && l.part !== 'Both' && l.part !== partFilter) return false;
      if (systemFilter !== 'All' && l.system !== systemFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          l.content.toLowerCase().includes(q) ||
          l.system.toLowerCase().includes(q) ||
          (l.topic ?? '').toLowerCase().includes(q) ||
          (l.explanation ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allLiners, source, partFilter, systemFilter, search]);

  const availableSystems = useMemo(() => {
    const set = new Set(allLiners.filter((l) => l.source === source).map((l) => l.system));
    return [
      ...SYSTEMS.filter((s) => set.has(s)),
      ...[...set].filter((s) => !SYSTEMS.includes(s as any)).sort(),
    ] as typeof SYSTEMS[number][];
  }, [allLiners, source]);

  const pmCount = allLiners.filter((l) => l.source === 'Passmedicine').length;
  const ptCount = allLiners.filter((l) => l.source === 'Pastest').length;

  const switchSource = (s: OneLinerSource) => {
    setSource(s);
    setSearch('');
    setSystemFilter('All');
    setPartFilter('All');
  };

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Hero Header ── */}
      <div className={`relative overflow-hidden bg-gradient-to-br ${srcCfg.gradient}`}>
        {/* Decorative circles */}
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-6 right-32 w-20 h-20 rounded-full bg-white/8 pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">

            {/* Title block */}
            <div>
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur border border-white/25 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-3">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Clinical Pearls · One-Liners
              </div>
              <h1 className="text-4xl font-extrabold text-white mb-1 tracking-tight">
                Clinical Pearls
              </h1>
              <p className="text-white/70 text-sm font-medium">
                High-yield facts · Memory aids · Key take-aways
              </p>

              {/* Source stats pills */}
              <div className="flex items-center gap-2 mt-4">
                <div className="flex items-center gap-1.5 bg-white/15 border border-white/20 px-3 py-1.5 rounded-full text-white text-xs font-semibold">
                  <span>📚</span>
                  {allLiners.length} total pearls
                </div>
                <div className="flex items-center gap-1.5 bg-white/15 border border-white/20 px-3 py-1.5 rounded-full text-white text-xs font-semibold">
                  <span>🏥</span>
                  {availableSystems.length} systems
                </div>
              </div>
            </div>

            {/* Source switcher */}
            <div className="flex gap-3">
              {([
                ['Passmedicine', pmCount, '🟣'],
                ['Pastest', ptCount, '🟢'],
              ] as const).map(([s, c, icon]) => (
                <button
                  key={s}
                  onClick={() => switchSource(s as OneLinerSource)}
                  className={`relative flex flex-col items-center px-5 py-3.5 rounded-2xl border-2 transition-all duration-200 font-bold min-w-[96px] ${
                    source === s
                      ? 'bg-white border-white shadow-xl scale-105'
                      : 'bg-white/10 backdrop-blur border-white/25 text-white/80 hover:bg-white/20 hover:border-white/40'
                  }`}
                >
                  {source === s && (
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-md">
                      <CheckIcon className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <span className="text-2xl mb-1">{icon}</span>
                  <span className={`text-xs font-semibold ${source === s ? 'text-gray-700' : ''}`}>{s}</span>
                  <span className={`text-2xl font-extrabold ${source === s ? 'text-gray-900' : 'text-white'}`}>{c}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Controls Panel ── */}
      <div className="max-w-5xl mx-auto px-4 -mt-4 relative z-10">
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4 space-y-3">

          {/* Row 1: Search + Part filter + View toggle */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search pearls, topics, systems…"
                className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 bg-gray-50 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Part filter */}
            <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
              {(['All', 'Part 1', 'Part 2'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPartFilter(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    partFilter === p
                      ? `bg-gradient-to-r ${srcCfg.gradient} text-white shadow-sm`
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {p === 'All' ? 'All Parts' : p}
                </button>
              ))}
            </div>

            {/* View mode */}
            <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
              <button
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <ListIcon className="w-3.5 h-3.5" /> List
              </button>
              <button
                onClick={() => setViewMode('flashcard')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'flashcard' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <GridIcon className="w-3.5 h-3.5" /> Flashcards
              </button>
            </div>

            {/* Count badge */}
            <div className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r ${srcCfg.gradient} shadow-sm`}>
              💡 {filtered.length} pearls
            </div>
          </div>

          {/* Row 2: System chips */}
          <SystemChips
            systems={availableSystems}
            selected={systemFilter}
            onSelect={setSystemFilter}
            srcCfg={srcCfg}
          />
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-16">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 p-20 text-center">
            <div className="text-6xl mb-5">
              {allLiners.filter((l) => l.source === source).length === 0 ? srcCfg.icon : '🔍'}
            </div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">
              {allLiners.filter((l) => l.source === source).length === 0
                ? `No ${source} One-Liners Yet`
                : 'No Results Found'}
            </h3>
            <p className="text-gray-400 text-sm max-w-xs mx-auto">
              {allLiners.filter((l) => l.source === source).length === 0
                ? `Upload ${source} one-liners from the Admin Panel to get started.`
                : 'Try adjusting your search or filters to find what you need.'}
            </p>
          </div>
        ) : viewMode === 'flashcard' ? (
          <FlashcardNavigator liners={filtered} srcCfg={srcCfg} />
        ) : (
          <div className="space-y-2.5">
            {filtered.map((liner) => (
              <ListRow key={liner.id} liner={liner} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
