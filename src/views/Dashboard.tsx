import { useState, useEffect } from 'react';
import { getStats } from '../store';
import {
  PART1_SYSTEMS, PART2_SYSTEMS, SYSTEM_ICONS, MRCPPart, Question,
} from '../types';
import {
  BookOpenIcon, TargetIcon, TrendingUpIcon, PlayIcon,
  CalendarIcon, ActivityIcon, ArrowRightIcon,
} from '../components/Icons';
import { getTextbooks } from '../textbookStore';
import { getOneLiners } from '../oneLinerStore';

// ── Types ────────────────────────────────────────────────────────────────────
type DashboardTab = 'mrcp1' | 'mrcp2' | 'pm1' | 'pm2' | 'pt1' | 'pt2';

interface DashboardProps {
  activePart: MRCPPart;
  setActivePart: (p: MRCPPart) => void;
  setView: (v: string) => void;
  setSelectedSystem: (s: string) => void;
  setActiveSource?: (src: 'All' | 'Passmedicine' | 'Pastest') => void;
  questions: Question[];
  isLoading?: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────
const SYSTEM_COLORS: string[] = [
  'from-rose-500 to-red-600',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-green-600',
  'from-amber-500 to-orange-600',
  'from-violet-500 to-purple-600',
  'from-teal-500 to-cyan-600',
  'from-pink-500 to-rose-600',
  'from-indigo-500 to-blue-700',
  'from-lime-500 to-green-600',
  'from-fuchsia-500 to-pink-600',
  'from-orange-500 to-red-500',
  'from-cyan-500 to-teal-600',
  'from-yellow-500 to-amber-600',
  'from-blue-500 to-indigo-600',
  'from-green-500 to-emerald-600',
  'from-red-500 to-rose-700',
  'from-purple-500 to-violet-700',
];

const TAB_CONFIG: Record<DashboardTab, {
  gradient: string;
  accentBar: string;
  badge: string;
  label: string;
  desc: string;
  btnStart: string;
  btnQuick: string;
  icon: string;
  color: string;
  source: 'MRCP' | 'Passmedicine' | 'Pastest';
  part: MRCPPart;
}> = {
  mrcp1: {
    gradient: 'from-blue-900 via-blue-800 to-indigo-900',
    accentBar: 'bg-sky-400',
    badge: 'bg-sky-500/20 text-sky-100 border border-sky-400/30',
    label: 'MRCP Part 1',
    desc: 'Basic Sciences · Clinical Pharmacology · Biostatistics',
    btnStart: 'bg-white text-blue-900 hover:bg-blue-50',
    btnQuick: 'bg-blue-600/50 border border-white/30 text-white hover:bg-blue-600',
    icon: '📘',
    color: 'text-blue-400',
    source: 'MRCP',
    part: 'Part 1',
  },
  mrcp2: {
    gradient: 'from-emerald-900 via-teal-800 to-green-900',
    accentBar: 'bg-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/30',
    label: 'MRCP Part 2',
    desc: 'Clinical Medicine · Advanced Cases · Specialties',
    btnStart: 'bg-white text-emerald-900 hover:bg-emerald-50',
    btnQuick: 'bg-emerald-600/50 border border-white/30 text-white hover:bg-emerald-600',
    icon: '📗',
    color: 'text-emerald-400',
    source: 'MRCP',
    part: 'Part 2',
  },
  pm1: {
    gradient: 'from-violet-900 via-purple-800 to-indigo-900',
    accentBar: 'bg-violet-400',
    badge: 'bg-violet-500/20 text-violet-100 border border-violet-400/30',
    label: 'Passmedicine Part 1',
    desc: 'System-wise · Passmedicine QBank · Part 1',
    btnStart: 'bg-white text-violet-900 hover:bg-violet-50',
    btnQuick: 'bg-violet-600/50 border border-white/30 text-white hover:bg-violet-600',
    icon: '🟣',
    color: 'text-violet-400',
    source: 'Passmedicine',
    part: 'Part 1',
  },
  pm2: {
    gradient: 'from-purple-900 via-violet-800 to-fuchsia-900',
    accentBar: 'bg-purple-400',
    badge: 'bg-purple-500/20 text-purple-100 border border-purple-400/30',
    label: 'Passmedicine Part 2',
    desc: 'System-wise · Passmedicine QBank · Part 2',
    btnStart: 'bg-white text-purple-900 hover:bg-purple-50',
    btnQuick: 'bg-purple-600/50 border border-white/30 text-white hover:bg-purple-600',
    icon: '🟣',
    color: 'text-purple-400',
    source: 'Passmedicine',
    part: 'Part 2',
  },
  pt1: {
    gradient: 'from-teal-900 via-cyan-800 to-green-900',
    accentBar: 'bg-teal-400',
    badge: 'bg-teal-500/20 text-teal-100 border border-teal-400/30',
    label: 'Pastest Part 1',
    desc: 'System-wise · Pastest QBank · Part 1',
    btnStart: 'bg-white text-teal-900 hover:bg-teal-50',
    btnQuick: 'bg-teal-600/50 border border-white/30 text-white hover:bg-teal-600',
    icon: '🟢',
    color: 'text-teal-400',
    source: 'Pastest',
    part: 'Part 1',
  },
  pt2: {
    gradient: 'from-cyan-900 via-teal-800 to-emerald-900',
    accentBar: 'bg-cyan-400',
    badge: 'bg-cyan-500/20 text-cyan-100 border border-cyan-400/30',
    label: 'Pastest Part 2',
    desc: 'System-wise · Pastest QBank · Part 2',
    btnStart: 'bg-white text-cyan-900 hover:bg-cyan-50',
    btnQuick: 'bg-cyan-600/50 border border-white/30 text-white hover:bg-cyan-600',
    icon: '🟢',
    color: 'text-cyan-400',
    source: 'Pastest',
    part: 'Part 2',
  },
};

// ── Loading Skeleton ──────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-200 h-20" />
            <div className="p-3 space-y-2">
              <div className="h-3 bg-gray-200 rounded w-3/4" />
              <div className="h-2 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── System Grid (shared between all tabs) ────────────────────────────────────
function SystemGrid({
  systems,
  questions,
  stats,
  tab,
  onSystemClick,
}: {
  systems: readonly string[];
  questions: Question[];
  stats: ReturnType<typeof getStats>;
  tab: DashboardTab;
  onSystemClick: (sys: string) => void;
}) {
  const systemCounts = systems.map((sys) => ({
    name: sys,
    total: questions.filter((q) => q.system === sys).length,
    attempted: stats.bySystem[sys]?.attempted ?? 0,
    correct: stats.bySystem[sys]?.correct ?? 0,
  }));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {systemCounts.map((sys, i) => {
        const pct = sys.attempted > 0 ? Math.round((sys.correct / sys.attempted) * 100) : 0;
        return (
          <button
            key={sys.name}
            onClick={() => onSystemClick(sys.name)}
            className="group bg-white rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden border border-gray-100 hover:border-blue-200 text-left"
          >
            <div className={`bg-gradient-to-br ${SYSTEM_COLORS[i % SYSTEM_COLORS.length]} p-4 flex items-center justify-between`}>
              <span className="text-2xl">{SYSTEM_ICONS[sys.name] ?? '+'}</span>
              <span className={`text-white text-xs font-bold px-2 py-0.5 rounded-full ${
                sys.total > 0 ? 'bg-white/25' : 'bg-black/25'
              }`}>
                {sys.total}
              </span>
            </div>
            <div className="p-3">
              <div className="font-semibold text-gray-800 text-sm leading-tight mb-2">{sys.name}</div>
              {sys.attempted > 0 ? (
                <>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500">{sys.correct}/{sys.attempted} · {pct}%</div>
                </>
              ) : (
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full inline-block ${sys.total > 0 ? 'bg-gray-300' : 'bg-gray-200'}`} />
                  {sys.total > 0 ? 'Not started' : 'No questions'}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Main Dashboard Component ─────────────────────────────────────────────────
export default function Dashboard({
  activePart, setActivePart, setView, setSelectedSystem, setActiveSource, questions, isLoading = false,
}: DashboardProps) {
  const stats = getStats();
  const [activeTab, setActiveTab] = useState<DashboardTab>(activePart === 'Part 1' ? 'mrcp1' : 'mrcp2');

  // Keep activeTab in sync when activePart prop changes from Navbar
  useEffect(() => {
    if (activeTab === 'mrcp1' || activeTab === 'mrcp2') {
      setActiveTab(activePart === 'Part 1' ? 'mrcp1' : 'mrcp2');
    }
  }, [activePart]);

  const cfg = TAB_CONFIG[activeTab];

  // Counts for each tab
  const mrcpQs = (part: MRCPPart) =>
    questions.filter((q) => q.part === part && q.source !== 'Passmedicine' && q.source !== 'Pastest');
  const pmQs = (part: MRCPPart) =>
    questions.filter((q) => q.source === 'Passmedicine' && q.part === part);
  const ptQs = (part: MRCPPart) =>
    questions.filter((q) => q.source === 'Pastest' && q.part === part);

  const tabCounts: Record<DashboardTab, number> = {
    mrcp1: mrcpQs('Part 1').length,
    mrcp2: mrcpQs('Part 2').length,
    pm1: pmQs('Part 1').length,
    pm2: pmQs('Part 2').length,
    pt1: ptQs('Part 1').length,
    pt2: ptQs('Part 2').length,
  };

  // Active questions for current tab
  const activeQuestions = (() => {
    if (activeTab === 'mrcp1') return mrcpQs('Part 1');
    if (activeTab === 'mrcp2') return mrcpQs('Part 2');
    if (activeTab === 'pm1') return pmQs('Part 1');
    if (activeTab === 'pm2') return pmQs('Part 2');
    if (activeTab === 'pt1') return ptQs('Part 1');
    return ptQs('Part 2');
  })();

  const activeSystems = (() => {
    const part = cfg.part;
    if (activeTab === 'mrcp1') return PART1_SYSTEMS;
    if (activeTab === 'mrcp2') return PART2_SYSTEMS;
    const sysList = [...new Set(activeQuestions.map((q) => q.system))].sort();
    const stdSystems = part === 'Part 1' ? [...PART1_SYSTEMS] : [...PART2_SYSTEMS];
    return [
      ...stdSystems.filter((s) => sysList.includes(s)),
      ...sysList.filter((s) => !(stdSystems as string[]).includes(s)),
    ] as typeof stdSystems;
  })();

  const partAttempted = activeQuestions.filter((q) => (stats.bySystem[q.system]?.attempted ?? 0) > 0).length;
  const overallPct = stats.totalAttempted > 0
    ? Math.round((stats.totalCorrect / stats.totalAttempted) * 100)
    : 0;

  const partHistory = stats.history.filter((h) => {
    if (activeTab === 'mrcp1') return (h.part ?? 'Part 1') === 'Part 1' && !['Passmedicine','Pastest'].includes(h.source ?? '');
    if (activeTab === 'mrcp2') return (h.part ?? 'Part 1') === 'Part 2' && !['Passmedicine','Pastest'].includes(h.source ?? '');
    return false;
  });

  // Textbooks + one-liners counts (for feature cards)
  const tbCount = getTextbooks().length;
  const olCount = getOneLiners().length;

  // ── Tab click handler ────────────────────────────────────────────────────
  const handleTabClick = (tab: DashboardTab) => {
    setActiveTab(tab);
    if (tab === 'mrcp1') setActivePart('Part 1');
    if (tab === 'mrcp2') setActivePart('Part 2');
  };

  // ── System click handler ─────────────────────────────────────────────────
  const handleSystemClick = (sys: string) => {
    const src = cfg.source === 'Passmedicine' ? 'Passmedicine'
      : cfg.source === 'Pastest' ? 'Pastest' : 'All';
    setActiveSource?.(src as any);
    setSelectedSystem(sys);
    setView('bank');
  };

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Hero Banner ─────────────────────────────────────────────────── */}
      <div className={`bg-gradient-to-br ${cfg.gradient} text-white`}>
        <div className="max-w-7xl mx-auto px-4 py-8">

          {/* ── 6-Tab Switcher ─────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2 mb-8">
            {/* Group 1: MRCP */}
            <div className="flex gap-1.5">
              {([['mrcp1', '📘', 'MRCP P1', 'bg-sky-100 text-sky-700'], ['mrcp2', '📗', 'MRCP P2', 'bg-emerald-100 text-emerald-700']] as const).map(([t, icon, label, activeBadge]) => (
                <button key={t} onClick={() => handleTabClick(t)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-sm transition-all border-2 ${
                    activeTab === t ? 'bg-white text-slate-900 border-white shadow-lg' : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20 hover:text-white'
                  }`}>
                  {icon} {label}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${activeTab === t ? activeBadge : 'bg-white/20 text-white'}`}>
                    {isLoading ? '…' : tabCounts[t]}
                  </span>
                </button>
              ))}
            </div>

            <div className="w-px bg-white/20 self-stretch mx-0.5" />

            {/* Group 2: Passmedicine */}
            <div className="flex gap-1.5">
              {([['pm1', '🟣', 'PM P1', 'bg-violet-100 text-violet-700'], ['pm2', '🟣', 'PM P2', 'bg-violet-100 text-violet-700']] as const).map(([t, icon, label, activeBadge]) => (
                <button key={t} onClick={() => handleTabClick(t)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-sm transition-all border-2 ${
                    activeTab === t ? 'bg-white text-slate-900 border-white shadow-lg' : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20 hover:text-white'
                  }`}>
                  {icon} {label}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${activeTab === t ? activeBadge : 'bg-white/20 text-white'}`}>
                    {isLoading ? '…' : tabCounts[t]}
                  </span>
                </button>
              ))}
            </div>

            <div className="w-px bg-white/20 self-stretch mx-0.5" />

            {/* Group 3: Pastest */}
            <div className="flex gap-1.5">
              {([['pt1', '🟢', 'PT P1', 'bg-teal-100 text-teal-700'], ['pt2', '🟢', 'PT P2', 'bg-teal-100 text-teal-700']] as const).map(([t, icon, label, activeBadge]) => (
                <button key={t} onClick={() => handleTabClick(t)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-sm transition-all border-2 ${
                    activeTab === t ? 'bg-white text-slate-900 border-white shadow-lg' : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20 hover:text-white'
                  }`}>
                  {icon} {label}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${activeTab === t ? activeBadge : 'bg-white/20 text-white'}`}>
                    {isLoading ? '…' : tabCounts[t]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Hero Content Row ──────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              {/* Badge */}
              <div className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-4 ${cfg.badge}`}>
                <span className={`w-2 h-2 rounded-full animate-pulse ${cfg.accentBar}`} />
                {cfg.label}
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-4xl font-extrabold mb-2 tracking-tight">
                {activeTab === 'Part 1' || activeTab === 'Part 2'
                  ? 'MRCP Question Bank'
                  : `${activeTab} Question Bank`}
              </h1>
              <p className="text-blue-200 text-base md:text-lg mb-6 max-w-lg">{cfg.desc}</p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    setActiveSource?.(cfg.source === 'MRCP' ? 'All' : cfg.source as any);
                    setView('bank');
                  }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all ${cfg.btnStart}`}
                >
                  <BookOpenIcon className="w-4 h-4" />
                  Browse Questions
                </button>
                <button
                  onClick={() => {
                    setActiveSource?.(cfg.source === 'MRCP' ? 'All' : cfg.source as any);
                    setSelectedSystem('All Systems');
                    setView('bank');
                  }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all backdrop-blur ${cfg.btnQuick}`}
                >
                  <PlayIcon className="w-4 h-4" />
                  Quick Practice
                </button>
              </div>
            </div>

            {/* ── Stats Summary Cards ─────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3 shrink-0">
              {[
                {
                  label: isLoading ? 'Loading…' : `${cfg.label} Qs`,
                  value: isLoading ? (
                    <span className="text-white/50">…</span>
                  ) : (
                    <span>{activeQuestions.length.toLocaleString()}</span>
                  ),
                  icon: <BookOpenIcon className="w-5 h-5" />,
                },
                {
                  label: 'Attempted',
                  value: partAttempted,
                  icon: <TargetIcon className="w-5 h-5" />,
                },
                {
                  label: 'Accuracy',
                  value: `${overallPct}%`,
                  icon: <TrendingUpIcon className="w-5 h-5" />,
                },
              ].map((s, i) => (
                <div key={i} className="bg-white/10 backdrop-blur rounded-2xl p-4 text-center border border-white/20 min-w-[90px]">
                  <div className="flex justify-center mb-2 text-white/80">{s.icon}</div>
                  <div className="text-2xl font-extrabold">{s.value}</div>
                  <div className="text-blue-200 text-xs mt-0.5 leading-tight">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Overall Progress Bar ─────────────────────────────────────────── */}
      {stats.totalAttempted > 0 && (
        <div className="max-w-7xl mx-auto px-4 -mt-4 mb-2">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 flex items-center gap-4">
            <div className="text-sm font-semibold text-gray-600 whitespace-nowrap">Overall Progress</div>
            <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  overallPct >= 70 ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                  : overallPct >= 50 ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                  : 'bg-gradient-to-r from-red-400 to-rose-500'
                }`}
                style={{ width: `${overallPct}%` }}
              />
            </div>
            <div className="text-sm font-bold text-gray-800 whitespace-nowrap">{overallPct}%</div>
          </div>
        </div>
      )}

      {/* ── Summary Strip (for non-MRCP tabs) ───────────────────────────── */}
      {(activeTab !== 'mrcp1' && activeTab !== 'mrcp2') && !isLoading && (
        <div className="max-w-7xl mx-auto px-4 pt-4 pb-0">
          <div className="flex flex-wrap gap-3">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold ${
              cfg.source === 'Passmedicine' ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-teal-50 border-teal-200 text-teal-700'
            }`}>
              {cfg.icon} {cfg.label}: <span className="font-extrabold">{activeQuestions.length.toLocaleString()}</span> questions
            </div>
          </div>
        </div>
      )}

      {/* ── Systems Grid ─────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {cfg.label} — Browse by System
            </h2>
            <p className="text-gray-500 text-sm mt-0.5">Select a system to start practising</p>
          </div>
          <div className="flex items-center gap-2">
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-blue-600 font-medium bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse inline-block" />
                Loading questions…
              </div>
            )}
            {!isLoading && (
              <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full font-medium border border-gray-200">
                {activeSystems.length} systems · {activeQuestions.length.toLocaleString()} questions
              </span>
            )}
          </div>
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <SystemGrid
            systems={activeSystems}
            questions={activeQuestions}
            stats={stats}
            tab={activeTab}
            onSystemClick={handleSystemClick}
          />
        )}
      </div>

      {/* ── Recent History (MRCP tabs only) ──────────────────────────────── */}
      {(activeTab === 'mrcp1' || activeTab === 'mrcp2') && partHistory.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 pb-12">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-500" />
              Recent {cfg.label} Sessions
            </h2>
            <button
              onClick={() => setView('stats')}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium transition"
            >
              View all <ArrowRightIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Date', 'System', 'Mode', 'Score', 'Accuracy'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {partHistory.slice(0, 5).map((entry, i) => {
                  const pct = Math.round((entry.score / entry.total) * 100);
                  return (
                    <tr key={i} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-[160px] truncate">{entry.system}</td>
                      <td className="px-4 py-3">
                        <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full text-xs font-semibold capitalize">
                          {entry.mode}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800">{entry.score}/{entry.total}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold text-sm ${pct >= 70 ? 'text-green-600' : pct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Empty state for MRCP tabs with no history ────────────────────── */}
      {!isLoading && (activeTab === 'mrcp1' || activeTab === 'mrcp2') && partHistory.length === 0 && (
        <div className="max-w-7xl mx-auto px-4 pb-6">
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ActivityIcon className="w-7 h-7 text-blue-400" />
            </div>
            <div className="text-gray-600 font-semibold mb-1">No sessions yet</div>
            <div className="text-gray-400 text-sm">Start practising to see your {cfg.label} history here</div>
          </div>
        </div>
      )}

      {/* ── Empty state for QBank tabs with no questions ──────────────────── */}
      {!isLoading && activeTab !== 'mrcp1' && activeTab !== 'mrcp2' && activeQuestions.length === 0 && (
        <div className="max-w-7xl mx-auto px-4 pb-6">
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
            <div className="text-4xl mb-4">{cfg.icon}</div>
            <div className="text-gray-700 font-bold text-lg mb-2">No {cfg.label} Questions Yet</div>
            <div className="text-gray-400 text-sm mb-6">
              Upload {cfg.label} questions from the Admin Panel.
            </div>
            <button onClick={() => setView('admin')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white shadow transition bg-violet-600 hover:bg-violet-700">
              Go to Admin Panel
            </button>
          </div>
        </div>
      )}

      {/* ── Daily Mock Banner ────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 pb-6">
        <button
          onClick={() => setView('daily-mock')}
          className="group w-full relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all text-left hover:-translate-y-0.5 border border-white/10"
        >
          {/* Decorative blobs */}
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-indigo-500/15 pointer-events-none" />
          <div className="absolute -bottom-8 left-1/3 w-32 h-32 rounded-full bg-blue-500/10 pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-white/10 flex-shrink-0">
                🎯
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold px-2.5 py-1 rounded-full mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Daily Challenge
                </div>
                <h3 className="text-white text-lg font-extrabold">Today's Daily Mock Exam</h3>
                <p className="text-blue-300 text-sm">
                  20 questions · Same for everyone · Part 1 & Part 2 · Live leaderboard
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white text-slate-900 font-extrabold text-sm px-5 py-2.5 rounded-xl shadow-lg group-hover:scale-105 transition-all flex-shrink-0">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              Start Daily Mock
            </div>
          </div>
        </button>
      </div>

      {/* ── Feature Cards — Textbooks & One-Liners ───────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 pb-12">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-gray-900">Study Resources</h2>
          <p className="text-gray-500 text-sm mt-0.5">Additional tools to support your MRCP preparation</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Textbooks card */}
          <button
            onClick={() => setView('textbooks')}
            className="group bg-gradient-to-br from-violet-600 to-purple-700 text-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all text-left hover:-translate-y-0.5"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl shadow-sm">
                📚
              </div>
              <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold">
                {tbCount} textbook{tbCount !== 1 ? 's' : ''}
              </div>
            </div>
            <h3 className="text-lg font-extrabold mb-1">Passmedicine Textbooks</h3>
            <p className="text-violet-200 text-sm mb-4">
              Read, annotate and highlight Passmedicine textbooks for Part 1 & Part 2
            </p>
            <div className="flex items-center gap-1.5 text-sm font-bold text-white group-hover:gap-2.5 transition-all">
              Open Textbooks <ArrowRightIcon className="w-4 h-4" />
            </div>
          </button>

          {/* One-liners card */}
          <button
            onClick={() => setView('oneliners')}
            className="group bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all text-left hover:-translate-y-0.5"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl shadow-sm">
                💡
              </div>
              <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold">
                {olCount} pearl{olCount !== 1 ? 's' : ''}
              </div>
            </div>
            <h3 className="text-lg font-extrabold mb-1">One-Liners & Clinical Pearls</h3>
            <p className="text-amber-100 text-sm mb-4">
              High-yield facts from Passmedicine & Pastest in flashcard and list format
            </p>
            <div className="flex items-center gap-1.5 text-sm font-bold text-white group-hover:gap-2.5 transition-all">
              Browse Pearls <ArrowRightIcon className="w-4 h-4" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
