import { useState, useMemo } from 'react';
import { Question, MRCPPart, PART1_SYSTEMS, PART2_SYSTEMS, SYSTEM_ICONS } from '../types';
import { getAnsweredQuestionIds, resetAnsweredQuestionIds } from '../store';

interface MockTestViewProps {
  questions: Question[];
  activePart: MRCPPart;
  startQuiz: (questions: Question[], mode: 'tutor' | 'timed' | 'review') => void;
  isLoading?: boolean;
}

const PRESETS = [
  { label: '25 Qs', value: 25, desc: '~37 min', icon: '⚡' },
  { label: '50 Qs', value: 50, desc: '~75 min', icon: '🎯' },
  { label: '100 Qs', value: 100, desc: '~2.5 hrs', icon: '🏆' },
  { label: 'Full Exam', value: 200, desc: '~5 hrs', icon: '🎓' },
];

const SOURCE_OPTIONS = [
  { value: 'All',          label: 'All Sources',   icon: '📚', color: 'from-blue-600 to-indigo-700' },
  { value: 'Passmedicine', label: 'Passmedicine',  icon: '🟣', color: 'from-violet-600 to-purple-700' },
  { value: 'Pastest',      label: 'Pastest',       icon: '🟢', color: 'from-teal-500 to-cyan-600' },
] as const;

type SourceFilter = 'All' | 'Passmedicine' | 'Pastest';

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

export default function MockTestView({ questions, activePart, startQuiz, isLoading }: MockTestViewProps) {
  const [part, setPart] = useState<MRCPPart>(activePart);
  const [source, setSource] = useState<SourceFilter>('All');
  const [system, setSystem] = useState<string>('All Systems');
  const [count, setCount] = useState<number>(50);
  const [customCount, setCustomCount] = useState<string>('');
  const [useCustom, setUseCustom] = useState(false);
  const [skipAnswered, setSkipAnswered] = useState(true);
  const [answeredVersion, setAnsweredVersion] = useState(0);
  const answeredIds = useMemo(() => getAnsweredQuestionIds(), [answeredVersion]);

  const systems = part === 'Part 1' ? PART1_SYSTEMS : PART2_SYSTEMS;

  const fullPool = useMemo(() => {
    return questions.filter((q) => {
      const partOk = q.source === 'Passmedicine' || q.source === 'Pastest'
        ? true
        : q.part === part;
      const srcOk = source === 'All' || q.source === source;
      const sysOk = system === 'All Systems' || q.system === system;
      return partOk && srcOk && sysOk;
    });
  }, [questions, part, source, system]);

  // By default, exclude questions the user has already answered so
  // batches don't repeat across sessions.
  const pool = useMemo(() => {
    if (!skipAnswered) return fullPool;
    return fullPool.filter((q) => !answeredIds.has(q.id));
  }, [fullPool, skipAnswered, answeredIds]);

  const completedInPool = fullPool.length - pool.length;

  const finalCount = useCustom
    ? Math.min(Math.max(parseInt(customCount) || 0, 1), pool.length)
    : Math.min(count, pool.length);

  const timeSeconds = finalCount * 90;
  const canStart = finalCount > 0 && !isLoading;

  const handleStart = () => {
    if (!canStart) return;
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, finalCount);
    startQuiz(shuffled, 'timed');
  };

  const handleResetProgress = () => {
    if (answeredIds.size === 0) return;
    if (window.confirm(`Reset your progress? This will clear ${answeredIds.size} answered question${answeredIds.size === 1 ? '' : 's'} so you can practise them again. Your performance stats are not affected.`)) {
      resetAnsweredQuestionIds();
      setAnsweredVersion((v) => v + 1);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-blue-500/10 pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full bg-indigo-500/10 pointer-events-none" />
        <div className="absolute top-8 right-48 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 py-10">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-4">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Timed Exam Simulation
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-3">
            Mock Tests
          </h1>
          <p className="text-blue-200 text-base max-w-xl">
            Simulate real MRCP exam conditions. Timed questions, no live feedback — just like the real thing.
          </p>

          {/* Key info pills */}
          <div className="flex flex-wrap gap-2 mt-5">
            {[
              { icon: '⏱️', text: '90 seconds per question' },
              { icon: '🚫', text: 'No answer feedback during test' },
              { icon: '📊', text: 'Full results & review after' },
              { icon: '🚩', text: 'Flag questions to review' },
            ].map((item) => (
              <div key={item.text} className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 text-white/80 text-xs font-medium px-3 py-1.5 rounded-full">
                <span>{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Setup Card ── */}
      <div className="max-w-4xl mx-auto px-4 -mt-4 pb-16 space-y-5">

        {/* Part selector */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Exam Part</h2>
          <div className="grid grid-cols-2 gap-3">
            {(['Part 1', 'Part 2'] as MRCPPart[]).map((p) => (
              <button
                key={p}
                onClick={() => { setPart(p); setSystem('All Systems'); }}
                className={`relative flex items-center gap-3 px-4 py-4 rounded-xl border-2 font-bold text-sm transition-all ${
                  part === p
                    ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-md'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-300 hover:bg-blue-50/50'
                }`}
              >
                <span className="text-2xl">{p === 'Part 1' ? '📘' : '📗'}</span>
                <div className="text-left">
                  <div className="font-extrabold">MRCP {p}</div>
                  <div className="text-xs font-normal text-gray-500 mt-0.5">
                    {p === 'Part 1' ? 'Basic Sciences · Pharmacology' : 'Clinical Medicine · Specialties'}
                  </div>
                </div>
                {part === p && (
                  <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Source selector */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Question Source</h2>
          <div className="grid grid-cols-3 gap-3">
            {SOURCE_OPTIONS.map((opt) => {
              const srcCount = questions.filter((q) =>
                opt.value === 'All' ? true : q.source === opt.value
              ).length;
              return (
                <button
                  key={opt.value}
                  onClick={() => setSource(opt.value)}
                  className={`relative flex flex-col items-center gap-2 px-3 py-4 rounded-xl border-2 font-bold text-sm transition-all ${
                    source === opt.value
                      ? `border-transparent text-white bg-gradient-to-br ${opt.color} shadow-lg`
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <span className="font-extrabold text-xs text-center">{opt.label}</span>
                  <span className={`text-xs font-semibold ${source === opt.value ? 'text-white/70' : 'text-gray-400'}`}>
                    {srcCount.toLocaleString()} Qs
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* System selector */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">System <span className="text-gray-400 font-normal normal-case">(optional — default: all)</span></h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSystem('All Systems')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                system === 'All Systems'
                  ? 'border-blue-600 bg-blue-600 text-white shadow'
                  : 'border-gray-200 text-gray-600 hover:border-blue-300'
              }`}
            >
              📚 All Systems
            </button>
            {systems.map((s) => (
              <button
                key={s}
                onClick={() => setSystem(s)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                  system === s
                    ? 'border-blue-600 bg-blue-600 text-white shadow'
                    : 'border-gray-200 text-gray-600 hover:border-blue-300'
                }`}
              >
                <span>{SYSTEM_ICONS[s] ?? ''}</span> {s}
              </button>
            ))}
          </div>
        </div>

        {/* Question count */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Number of Questions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            {PRESETS.map((p) => {
              const active = !useCustom && count === p.value;
              return (
                <button
                  key={p.value}
                  onClick={() => { setUseCustom(false); setCount(p.value); }}
                  className={`flex flex-col items-center gap-1 py-4 rounded-xl border-2 font-bold transition-all ${
                    active
                      ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-md'
                      : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50/40'
                  }`}
                >
                  <span className="text-xl">{p.icon}</span>
                  <span className="text-base font-extrabold">{p.label}</span>
                  <span className={`text-xs ${active ? 'text-blue-500' : 'text-gray-400'}`}>{p.desc}</span>
                </button>
              );
            })}
          </div>

          {/* Custom count */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setUseCustom((v) => !v)}
              className={`text-xs font-bold px-3 py-2 rounded-xl border-2 transition-all ${
                useCustom
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              Custom
            </button>
            {useCustom && (
              <input
                type="number"
                min={1}
                max={pool.length}
                value={customCount}
                onChange={(e) => setCustomCount(e.target.value)}
                placeholder={`1–${pool.length}`}
                className="w-32 border-2 border-blue-300 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
                autoFocus
              />
            )}
            <span className="text-sm text-gray-500 font-medium">
              {pool.length.toLocaleString()} questions available in this selection
              {skipAnswered && completedInPool > 0 && (
                <span className="text-emerald-600 font-semibold"> · {completedInPool.toLocaleString()} already answered</span>
              )}
            </span>
          </div>

          {/* No-repeat controls (per user) */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={() => setSkipAnswered((v) => !v)}
              title={skipAnswered ? 'Already-answered questions are excluded from new mock tests' : 'All matching questions can appear in new mock tests'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
                skipAnswered
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300'
              }`}
            >
              ✓ {skipAnswered ? 'Skipping answered' : 'Including answered'}
            </button>
            {answeredIds.size > 0 && (
              <button
                onClick={handleResetProgress}
                title="Clear your answered-question history so all questions become available again"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border-2 border-rose-200 bg-white text-rose-600 hover:bg-rose-50 transition-all"
              >
                Reset progress ({answeredIds.size})
              </button>
            )}
          </div>
        </div>

        {/* Summary + Start */}
        <div className={`rounded-2xl border-2 p-6 transition-all ${
          canStart
            ? 'bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border-blue-700 shadow-xl'
            : 'bg-gray-100 border-gray-200'
        }`}>
          {canStart ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div>
                <div className="text-white font-extrabold text-xl mb-1">Ready to start</div>
                <div className="flex flex-wrap gap-3 mt-2">
                  {[
                    { icon: '📋', label: `${finalCount} questions` },
                    { icon: '⏱️', label: formatTime(timeSeconds) },
                    { icon: '📚', label: source === 'All' ? 'All Sources' : source },
                    { icon: '🏥', label: system === 'All Systems' ? 'All Systems' : system },
                    { icon: part === 'Part 1' ? '📘' : '📗', label: `MRCP ${part}` },
                  ].map((item) => (
                    <div key={item.label} className="inline-flex items-center gap-1.5 bg-white/15 border border-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                      <span>{item.icon}</span> {item.label}
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={handleStart}
                className="inline-flex items-center gap-3 bg-white text-slate-900 font-extrabold text-base px-8 py-4 rounded-2xl shadow-2xl hover:shadow-blue-500/30 hover:scale-105 transition-all whitespace-nowrap"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Start Mock Test
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-gray-400 text-4xl mb-2">
                {!isLoading && skipAnswered && fullPool.length > 0 ? '✅' : '🔍'}
              </div>
              <div className="text-gray-600 font-semibold">
                {isLoading
                  ? 'Loading questions…'
                  : skipAnswered && fullPool.length > 0
                  ? "You've answered every question matching this selection"
                  : 'No questions match your selection'}
              </div>
              <div className="text-gray-400 text-sm mt-1">
                {!isLoading && skipAnswered && fullPool.length > 0
                  ? 'Switch to "Including answered" to revise, or reset progress to start over.'
                  : 'Try adjusting the filters above'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
