import { useState, useEffect, useRef } from 'react';
import { getStats } from '../store';
import { PART1_SYSTEMS, PART2_SYSTEMS, MRCPPart } from '../types';
import RadarChart from '../components/RadarChart';
import { getStudyToolsStats } from '../notesStore';
import {
  BarChartIcon, BookmarkIcon, PencilIcon, ActivityIcon,
  TargetIcon, AlertTriangleIcon, TrophyIcon, ClockIcon,
} from '../components/Icons';

type StatsTab = 'Part 1' | 'Part 2' | 'Passmedicine' | 'Pastest';

interface StatsViewProps {
  activePart: MRCPPart;
}

const TAB_CONFIG: Record<StatsTab, {
  gradient: string;
  badge: string;
  label: string;
  icon: string;
  color: string;
  historyFilter: (entry: any) => boolean;
  systems: readonly string[] | null; // null = derive from data
}> = {
  'Part 1': {
    gradient: 'from-blue-700 to-indigo-800',
    badge: 'bg-sky-400/20 text-sky-100',
    label: 'MRCP Part 1',
    icon: '📘',
    color: 'text-sky-300',
    historyFilter: (h) => (h.part ?? 'Part 1') === 'Part 1' && !['Passmedicine', 'Pastest'].includes(h.source ?? ''),
    systems: PART1_SYSTEMS,
  },
  'Part 2': {
    gradient: 'from-emerald-700 to-teal-800',
    badge: 'bg-emerald-400/20 text-emerald-100',
    label: 'MRCP Part 2',
    icon: '📗',
    color: 'text-emerald-300',
    historyFilter: (h) => (h.part ?? 'Part 1') === 'Part 2' && !['Passmedicine', 'Pastest'].includes(h.source ?? ''),
    systems: PART2_SYSTEMS,
  },
  'Passmedicine': {
    gradient: 'from-violet-700 to-purple-800',
    badge: 'bg-violet-400/20 text-violet-100',
    label: 'Passmedicine QBank',
    icon: '🟣',
    color: 'text-violet-300',
    historyFilter: (h) => h.source === 'Passmedicine',
    systems: null,
  },
  'Pastest': {
    gradient: 'from-teal-700 to-cyan-800',
    badge: 'bg-teal-400/20 text-teal-100',
    label: 'Pastest QBank',
    icon: '🟢',
    color: 'text-teal-300',
    historyFilter: (h) => h.source === 'Pastest',
    systems: null,
  },
};

export default function StatsView({ activePart }: StatsViewProps) {
  const [activeTab, setActiveTab] = useState<StatsTab>(activePart);
  const stats = getStats();
  const studyTools = getStudyToolsStats();
  const radarContainerRef = useRef<HTMLDivElement>(null);
  const [radarSize, setRadarSize] = useState(380);

  useEffect(() => {
    const update = () => {
      if (radarContainerRef.current) {
        const w = radarContainerRef.current.offsetWidth;
        setRadarSize(Math.min(380, Math.max(260, w - 32)));
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Keep tab in sync when activePart prop changes
  useEffect(() => {
    if (activeTab === 'Part 1' || activeTab === 'Part 2') setActiveTab(activePart);
  }, [activePart]);

  const cfg = TAB_CONFIG[activeTab];
  const partHistory = stats.history.filter(cfg.historyFilter);

  const partAttempted = partHistory.reduce((a, h) => a + h.total, 0);
  const partCorrect   = partHistory.reduce((a, h) => a + h.score, 0);
  const partPct       = partAttempted > 0 ? Math.round((partCorrect / partAttempted) * 100) : 0;

  const overallPct = stats.totalAttempted > 0
    ? Math.round((stats.totalCorrect / stats.totalAttempted) * 100)
    : 0;

  // Determine which systems to show
  const partSystems: readonly string[] = cfg.systems ?? (() => {
    const sysList = [...new Set(partHistory.map((h) => h.system.split(', ')).flat())].sort();
    return sysList;
  })();

  // Radar chart data
  const radarData = partSystems
    .map((sys) => {
      const d = stats.bySystem[sys] ?? { attempted: 0, correct: 0 };
      return { label: sys, value: d.attempted > 0 ? Math.round((d.correct / d.attempted) * 100) : 0, attempted: d.attempted };
    })
    .filter((d) => d.attempted > 0);

  // Weak areas
  const weakAreas = partSystems
    .map((sys) => {
      const d = stats.bySystem[sys] ?? { attempted: 0, correct: 0 };
      const pct = d.attempted > 0 ? Math.round((d.correct / d.attempted) * 100) : -1;
      return { sys, pct, attempted: d.attempted, correct: d.correct };
    })
    .filter((d) => d.attempted > 0 && d.pct < 60)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 5);

  const isQBank = activeTab === 'Passmedicine' || activeTab === 'Pastest';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Header Card ─────────────────────────────────────────── */}
        <div className={`bg-gradient-to-br ${cfg.gradient} text-white rounded-3xl p-8`}>

          {/* 4-tab switcher inside header */}
          <div className="flex flex-wrap gap-2 mb-6">
            {(['Part 1', 'Part 2', 'Passmedicine', 'Pastest'] as StatsTab[]).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  activeTab === tab
                    ? 'bg-white text-slate-900 border-white shadow'
                    : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20 hover:text-white'
                }`}>
                {TAB_CONFIG[tab].icon} {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 mb-2">
            <BarChartIcon className="w-8 h-8 text-white/80" />
            <h1 className="text-3xl font-bold">My Performance</h1>
            <span className={`text-sm font-bold px-3 py-1 rounded-full ${cfg.badge}`}>
              {cfg.label}
            </span>
          </div>
          <p className="text-blue-200 mb-6">
            {isQBank
              ? `Track your ${activeTab} question bank performance`
              : `Track your MRCP ${activeTab} preparation progress`}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: `${activeTab} Attempted`, value: partAttempted },
              { label: `${activeTab} Correct`,   value: partCorrect },
              { label: `${activeTab} Accuracy`,  value: `${partPct}%` },
              { label: 'Overall Accuracy',        value: `${overallPct}%` },
            ].map((s) => (
              <div key={s.label} className="bg-white/15 backdrop-blur rounded-2xl p-4 text-center border border-white/20">
                <div className="text-3xl font-black">{s.value}</div>
                <div className="text-blue-200 text-xs mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Study Tools Stats ──────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[
            { icon: <BookmarkIcon className="w-5 h-5 sm:w-7 sm:h-7" />, label: 'Bookmarks',  value: studyTools.bookmarksCount,  color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
            { icon: <PencilIcon className="w-5 h-5 sm:w-7 sm:h-7" />,   label: 'Notes',      value: studyTools.notesCount,       color: 'bg-amber-50 border-amber-200 text-amber-700' },
            { icon: <ActivityIcon className="w-5 h-5 sm:w-7 sm:h-7" />, label: 'Highlights', value: studyTools.highlightsCount,  color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-3 sm:p-4 ${s.color} flex items-center gap-2 sm:gap-4`}>
              <div className="opacity-70 hidden sm:block">{s.icon}</div>
              <div>
                <div className="text-xl sm:text-2xl font-extrabold">{s.value}</div>
                <div className="text-xs sm:text-sm font-medium opacity-75">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Radar Chart ───────────────────────────────────────────── */}
        {partAttempted > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                  <TargetIcon className="w-5 h-5 text-indigo-500" />
                  Performance Radar — {cfg.label}
                </h2>
                <p className="text-gray-400 text-sm mt-0.5">
                  Visual overview of your strengths and weak spots
                </p>
              </div>
              {radarData.length > 0 && (
                <span className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-bold">
                  {radarData.length} systems attempted
                </span>
              )}
            </div>

            {radarData.length >= 3 ? (
              <div ref={radarContainerRef} className="flex justify-center">
                <RadarChart data={radarData} size={radarSize} />
              </div>
            ) : (
              <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <TargetIcon className="w-7 h-7 text-indigo-400" />
                </div>
                <div className="text-gray-500 font-semibold">Radar chart unlocks after 3 systems</div>
                <div className="text-gray-400 text-sm mt-1">
                  {radarData.length} of 3 needed. Complete quizzes in {Math.max(0, 3 - radarData.length)} more system{3 - radarData.length !== 1 ? 's' : ''} to unlock.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Difficulty + Weak Areas ───────────────────────────────── */}
        {partAttempted > 0 && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Difficulty Breakdown */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2">
                <TargetIcon className="w-5 h-5 text-blue-500" /> By Difficulty
              </h2>
              <div className="space-y-4">
                {[
                  { label: 'Easy',   color: 'green' },
                  { label: 'Medium', color: 'amber' },
                  { label: 'Hard',   color: 'red' },
                ].map(({ label, color }) => {
                  const data = stats.byDifficulty[label] ?? { attempted: 0, correct: 0 };
                  const pct  = data.attempted > 0 ? Math.round((data.correct / data.attempted) * 100) : 0;
                  const colors: Record<string, { bg: string; border: string; text: string; sub: string; bar: string; bar2: string }> = {
                    green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', sub: 'text-green-700', bar: 'bg-green-100', bar2: 'bg-green-500' },
                    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', sub: 'text-amber-700', bar: 'bg-amber-100', bar2: 'bg-amber-500' },
                    red:   { bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-600',   sub: 'text-red-700',   bar: 'bg-red-100',   bar2: 'bg-red-500' },
                  };
                  const c = colors[color];
                  return (
                    <div key={label} className={`${c.bg} border ${c.border} rounded-2xl p-4`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-bold ${c.sub}`}>{label}</span>
                        <span className={`font-black text-xl ${c.text}`}>{pct}%</span>
                      </div>
                      <div className={`w-full ${c.bar} rounded-full h-2.5`}>
                        <div className={`h-full ${c.bar2} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className={`text-xs ${c.text} mt-1.5`}>{data.correct}/{data.attempted} correct</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Weak Areas */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2">
                <AlertTriangleIcon className="w-5 h-5 text-amber-500" /> Weak Areas (Top 5)
              </h2>
              {weakAreas.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-2">
                    <TrophyIcon className="w-6 h-6 text-green-500" />
                  </div>
                  <div className="text-gray-500 font-semibold">No weak areas!</div>
                  <div className="text-gray-400 text-sm mt-1">All attempted systems ≥ 60%</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {weakAreas.map((w, i) => (
                    <div key={w.sys} className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                      <span className="font-black text-red-400 text-lg w-6 text-center">{i + 1}</span>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800 text-sm">{w.sys}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 bg-red-100 rounded-full h-2">
                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${w.pct}%` }} />
                          </div>
                          <span className="text-xs font-bold text-red-600 w-10 text-right">{w.pct}%</span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">{w.correct}/{w.attempted}</span>
                    </div>
                  ))}
                  <p className="text-xs text-gray-400 text-center pt-1">Focus on these to boost your score</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── System Breakdown Table ─────────────────────────────────── */}
        {partSystems.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold text-gray-800 text-lg mb-5 flex items-center gap-2">
              <BarChartIcon className="w-5 h-5 text-blue-500" />
              {cfg.label} — By System
            </h2>
            <div className="space-y-3">
              {partSystems.map((sys) => {
                const data = stats.bySystem[sys] ?? { attempted: 0, correct: 0 };
                const pct = data.attempted > 0 ? Math.round((data.correct / data.attempted) * 100) : 0;
                const barColor = pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400';
                return (
                  <div key={sys} className="flex items-center gap-2 sm:gap-4">
                    <div className="w-24 sm:w-40 text-sm text-gray-700 font-medium flex-shrink-0 truncate">{sys}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div className={`h-full ${barColor} rounded-full transition-all`}
                        style={{ width: data.attempted > 0 ? `${pct}%` : '0%' }} />
                    </div>
                    <div className="w-16 sm:w-36 text-right text-sm flex-shrink-0">
                      {data.attempted > 0 ? (
                        <span className={`font-bold ${pct >= 70 ? 'text-green-600' : pct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                          <span className="hidden sm:inline">{data.correct}/{data.attempted} </span>({pct}%)
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── History Table ──────────────────────────────────────────── */}
        {partHistory.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-blue-500" />
              <h2 className="font-bold text-gray-800 text-lg">{cfg.label} Session History</h2>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium ml-auto">{partHistory.length} sessions</span>
            </div>
            <div className="overflow-x-auto -mx-0">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Date', 'System', 'Mode', 'Source', 'Score', 'Accuracy', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {partHistory.map((entry, i) => {
                    const pct = Math.round((entry.score / entry.total) * 100);
                    const status =
                      pct >= 70 ? { label: 'Pass',       cls: 'bg-green-100 text-green-700' }
                    : pct >= 50 ? { label: 'Borderline', cls: 'bg-amber-100 text-amber-700' }
                    :             { label: 'Fail',        cls: 'bg-red-100 text-red-700' };
                    return (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                          {new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800 max-w-[140px] truncate">{entry.system}</td>
                        <td className="px-4 py-3">
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium capitalize">{entry.mode}</span>
                        </td>
                        <td className="px-4 py-3">
                          {entry.source ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              entry.source === 'Passmedicine' ? 'bg-violet-100 text-violet-700'
                              : entry.source === 'Pastest' ? 'bg-teal-100 text-teal-700'
                              : 'bg-gray-100 text-gray-600'
                            }`}>{entry.source}</span>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 font-semibold">{entry.score}/{entry.total}</td>
                        <td className="px-4 py-3">
                          <span className={`font-bold text-sm ${pct >= 70 ? 'text-green-600' : pct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{pct}%</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${status.cls}`}>{status.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Empty state ────────────────────────────────────────────── */}
        {partAttempted === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">{cfg.icon}</div>
            <div className="text-lg font-semibold text-gray-600">No {cfg.label} data yet</div>
            <div className="text-sm mt-1">Complete some {cfg.label} quizzes to see your performance here</div>
          </div>
        )}

      </div>
    </div>
  );
}
