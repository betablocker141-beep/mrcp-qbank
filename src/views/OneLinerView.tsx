import { useState, useMemo } from 'react';
import { OneLiner, OneLinerSource, SYSTEMS, SYSTEM_ICONS } from '../types';
import { getOneLiners } from '../oneLinerStore';

// ── Icons ─────────────────────────────────────────────────────────────────────
const SearchIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const CardIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
);
const ListIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);
const FlipIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);
const ChevronIcon = ({ className = 'w-5 h-5', dir = 'right' }: { className?: string; dir?: 'left' | 'right' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d={dir === 'right' ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
  </svg>
);

// ── Source badge colors ───────────────────────────────────────────────────────
const SOURCE_CONFIG: Record<OneLinerSource, { color: string; bg: string; icon: string; gradient: string }> = {
  Passmedicine: { color: 'text-violet-700', bg: 'bg-violet-100 border-violet-200', icon: '🟣', gradient: 'from-violet-600 to-purple-700' },
  Pastest:      { color: 'text-teal-700',   bg: 'bg-teal-100 border-teal-200',    icon: '🟢', gradient: 'from-teal-600 to-cyan-700' },
};

// ── Flashcard Component ───────────────────────────────────────────────────────
function Flashcard({ liner }: { liner: OneLiner }) {
  const [flipped, setFlipped] = useState(false);
  const src = SOURCE_CONFIG[liner.source];

  return (
    <div
      className="cursor-pointer select-none"
      style={{ perspective: '1000px' }}
      onClick={() => setFlipped(!flipped)}
    >
      <div
        className="relative transition-all duration-500"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          minHeight: '220px',
        }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 backface-hidden bg-white rounded-2xl shadow-md border border-gray-100 p-6 flex flex-col"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${src.bg} ${src.color}`}>
              {src.icon} {liner.source}
            </span>
            <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
              {SYSTEM_ICONS[liner.system] ?? ''} {liner.system}
            </span>
            {liner.topic && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">{liner.topic}</span>
            )}
            <span className={`ml-auto text-xs text-white font-bold px-2.5 py-1 rounded-full bg-gradient-to-r ${src.gradient}`}>
              {liner.part}
            </span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-800 text-base font-semibold text-center leading-relaxed">{liner.content}</p>
          </div>
          <div className="flex items-center justify-center gap-1 mt-4 text-xs text-gray-400">
            <FlipIcon className="w-3.5 h-3.5" />
            Tap to reveal explanation
          </div>
        </div>

        {/* Back */}
        <div
          className={`absolute inset-0 backface-hidden bg-gradient-to-br ${src.gradient} rounded-2xl shadow-md p-6 flex flex-col`}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="text-white/70 text-xs font-bold uppercase tracking-wider">Explanation</span>
          </div>
          <div className="flex-1 flex items-start">
            <p className="text-white text-sm leading-relaxed">
              {liner.explanation ?? 'No explanation provided.'}
            </p>
          </div>
          {liner.tags && liner.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {liner.tags.map((tag) => (
                <span key={tag} className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-center gap-1 mt-4 text-xs text-white/60">
            <FlipIcon className="w-3.5 h-3.5" />
            Tap to flip back
          </div>
        </div>
      </div>
    </div>
  );
}

// ── List Row ──────────────────────────────────────────────────────────────────
function ListRow({ liner }: { liner: OneLiner }) {
  const [expanded, setExpanded] = useState(false);
  const src = SOURCE_CONFIG[liner.source];

  return (
    <div
      className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-4 flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 bg-gradient-to-br ${src.gradient} text-white font-bold shadow-sm`}>
          {src.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${src.bg} ${src.color}`}>
              {liner.source}
            </span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {SYSTEM_ICONS[liner.system] ?? ''} {liner.system}
            </span>
            {liner.topic && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{liner.topic}</span>
            )}
            <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full ml-auto">
              {liner.part}
            </span>
          </div>
          <p className="text-gray-800 text-sm font-medium leading-snug">{liner.content}</p>
          {expanded && liner.explanation && (
            <div className={`mt-3 p-3 rounded-xl text-sm text-white bg-gradient-to-r ${src.gradient} leading-relaxed`}>
              {liner.explanation}
            </div>
          )}
          {expanded && liner.tags && liner.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {liner.tags.map((tag) => (
                <span key={tag} className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
          )}
        </div>
        <ChevronIcon
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform mt-1 ${expanded ? 'rotate-90' : ''}`}
          dir="right"
        />
      </div>
    </div>
  );
}

// ── Flashcard Navigator ───────────────────────────────────────────────────────
function FlashcardNavigator({ liners }: { liners: OneLiner[] }) {
  const [index, setIndex] = useState(0);

  if (liners.length === 0) return null;

  const current = liners[index];
  const prev = () => setIndex((i) => Math.max(0, i - 1));
  const next = () => setIndex((i) => Math.min(liners.length - 1, i + 1));

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm font-semibold text-gray-600">{index + 1} / {liners.length}</span>
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 transition-all"
            style={{ width: `${((index + 1) / liners.length) * 100}%` }}
          />
        </div>
        <span className="text-sm text-gray-500">{Math.round(((index + 1) / liners.length) * 100)}%</span>
      </div>

      <Flashcard liner={current} />

      {/* Navigation */}
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={prev}
          disabled={index === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-white border border-gray-200 hover:border-gray-300 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition"
        >
          <ChevronIcon dir="left" className="w-4 h-4" /> Previous
        </button>
        <div className="flex gap-1">
          {Array.from({ length: Math.min(7, liners.length) }, (_, i) => {
            const dotIdx = liners.length <= 7 ? i : Math.round(i * (liners.length - 1) / 6);
            const isActive = Math.abs(dotIdx - index) < liners.length / 7;
            return (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === Math.round(index * 6 / Math.max(liners.length - 1, 1))
                    ? 'bg-violet-600 scale-125'
                    : 'bg-gray-300'
                }`}
              />
            );
          })}
        </div>
        <button
          onClick={next}
          disabled={index === liners.length - 1}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-white border border-gray-200 hover:border-gray-300 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition"
        >
          Next <ChevronIcon dir="right" className="w-4 h-4" />
        </button>
      </div>
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

  const allLiners = getOneLiners();

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

  // Derive available systems for current source
  const availableSystems = useMemo(() => {
    const set = new Set(allLiners.filter((l) => l.source === source).map((l) => l.system));
    return [
      ...SYSTEMS.filter((s) => set.has(s)),
      ...[...set].filter((s) => !SYSTEMS.includes(s as any)).sort(),
    ] as typeof SYSTEMS[number][];
  }, [allLiners, source]);

  const srcCfg = SOURCE_CONFIG[source];
  const pmCount = allLiners.filter((l) => l.source === 'Passmedicine').length;
  const ptCount = allLiners.filter((l) => l.source === 'Pastest').length;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ── */}
      <div className={`bg-gradient-to-br ${srcCfg.gradient} text-white px-4 py-7`}>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/15 border border-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-3">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                One-Liners & Pearls
              </div>
              <h1 className="text-3xl font-extrabold mb-1">Clinical Pearls</h1>
              <p className="text-white/70 text-sm">High-yield facts · Memory aids · Key take-aways</p>
            </div>
            <div className="flex gap-3 text-center">
              {([['Passmedicine', pmCount, '🟣'], ['Pastest', ptCount, '🟢']] as const).map(([s, c, icon]) => (
                <button
                  key={s}
                  onClick={() => { setSource(s as OneLinerSource); setSearch(''); setSystemFilter('All'); }}
                  className={`px-4 py-3 rounded-xl border-2 transition-all font-bold text-sm ${
                    source === s
                      ? 'bg-white text-gray-900 border-white shadow-lg'
                      : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
                  }`}
                >
                  <div className="text-xl mb-0.5">{icon}</div>
                  <div className="text-xs">{s}</div>
                  <div className={`text-lg font-extrabold ${source === s ? 'text-gray-900' : 'text-white'}`}>{c}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="max-w-5xl mx-auto px-4 py-5">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3 items-center">

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pearls, topics, systems…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 bg-gray-50"
            />
          </div>

          {/* Part filter */}
          <div className="flex gap-1">
            {(['All', 'Part 1', 'Part 2'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPartFilter(p)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition border ${
                  partFilter === p
                    ? `bg-gradient-to-r ${srcCfg.gradient} text-white border-transparent shadow`
                    : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'
                }`}
              >
                {p === 'All' ? 'All Parts' : p}
              </button>
            ))}
          </div>

          {/* System filter */}
          <select
            value={systemFilter}
            onChange={(e) => setSystemFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            <option value="All">All Systems</option>
            {availableSystems.map((s) => (
              <option key={s} value={s}>{SYSTEM_ICONS[s] ?? ''} {s}</option>
            ))}
          </select>

          {/* View mode */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'list' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ListIcon className="w-3.5 h-3.5" /> List
            </button>
            <button
              onClick={() => setViewMode('flashcard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'flashcard' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <CardIcon className="w-3.5 h-3.5" /> Flashcards
            </button>
          </div>

          {/* Count */}
          <span className="text-xs text-gray-500 font-medium bg-gray-100 px-3 py-2 rounded-xl">
            {filtered.length} pearls
          </span>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-4 pb-12">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
            <div className="text-5xl mb-4">{srcCfg.icon}</div>
            <h3 className="text-lg font-bold text-gray-700 mb-2">
              {allLiners.filter((l) => l.source === source).length === 0
                ? `No ${source} One-Liners Yet`
                : 'No Results Found'}
            </h3>
            <p className="text-gray-400 text-sm">
              {allLiners.filter((l) => l.source === source).length === 0
                ? `Upload ${source} one-liners from the Admin Panel.`
                : 'Try adjusting your search or filters.'}
            </p>
          </div>
        ) : viewMode === 'flashcard' ? (
          <FlashcardNavigator liners={filtered} />
        ) : (
          <div className="space-y-2">
            {filtered.map((liner) => (
              <ListRow key={liner.id} liner={liner} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
