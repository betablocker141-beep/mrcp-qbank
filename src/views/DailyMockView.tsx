import { useState, useEffect, useMemo } from 'react';
import { Question, MRCPPart, User } from '../types';
import {
  getDailyQuestions, getTodayResult, getLeaderboard, secondsUntilReset,
  DAILY_QUESTION_COUNT, DailyMockResult, getTodayUTC,
} from '../dailyMockStore';

interface DailyMockViewProps {
  questions: Question[];
  user: User;
  onStart: (part: MRCPPart, dailyQuestions: Question[]) => void;
  isLoading?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function gradeLabel(pct: number): { label: string; color: string; bg: string } {
  if (pct >= 80) return { label: 'Excellent', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
  if (pct >= 60) return { label: 'Pass', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' };
  if (pct >= 50) return { label: 'Borderline', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
  return { label: 'Fail', color: 'text-red-700', bg: 'bg-red-50 border-red-200' };
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Score Card (shown after completion) ───────────────────────────────────────
function ScoreCard({ result }: { result: DailyMockResult }) {
  const grade = gradeLabel(result.percentage);
  return (
    <div className={`rounded-2xl border-2 p-5 ${grade.bg}`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-bold uppercase tracking-wider ${grade.color}`}>
          Today's Score
        </span>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${grade.bg} ${grade.color}`}>
          {grade.label}
        </span>
      </div>
      <div className={`text-5xl font-extrabold ${grade.color} mb-1`}>
        {result.percentage}%
      </div>
      <div className="text-gray-600 text-sm mb-3">
        {result.score} / {result.total} correct
      </div>
      {/* Score bar */}
      <div className="w-full bg-white/70 rounded-full h-2.5 mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            result.percentage >= 80 ? 'bg-emerald-500'
            : result.percentage >= 60 ? 'bg-blue-500'
            : result.percentage >= 50 ? 'bg-amber-500'
            : 'bg-red-500'
          }`}
          style={{ width: `${result.percentage}%` }}
        />
      </div>
      <div className="text-xs text-gray-500">
        Completed in {formatTime(result.timeTaken)} · {new Date(result.completedAt).toLocaleTimeString()}
      </div>
    </div>
  );
}

// ── Exam Card (one per part) ──────────────────────────────────────────────────
function ExamCard({
  part,
  questions,
  onStart,
  isLoading,
}: {
  part: MRCPPart;
  questions: Question[];
  onStart: (part: MRCPPart, qs: Question[]) => void;
  isLoading?: boolean;
}) {
  const result = getTodayResult(part);
  const dailyQs = useMemo(() => getDailyQuestions(questions, part), [questions, part]);
  const available = dailyQs.length;
  const isPart1 = part === 'Part 1';

  const cardGrad = isPart1
    ? 'from-blue-900 via-blue-800 to-indigo-900'
    : 'from-emerald-900 via-teal-800 to-green-900';
  const accentColor = isPart1 ? 'bg-sky-400' : 'bg-emerald-400';
  const btnColor = isPart1
    ? 'bg-white text-blue-900 hover:bg-blue-50'
    : 'bg-white text-emerald-900 hover:bg-emerald-50';

  return (
    <div className={`relative rounded-3xl overflow-hidden bg-gradient-to-br ${cardGrad} text-white shadow-2xl`}>
      <div className={`h-1 w-full ${accentColor}`} />
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-2xl mb-1">{isPart1 ? '📘' : '📗'}</div>
            <h2 className="text-xl font-extrabold tracking-tight">MRCP {part}</h2>
            <p className="text-white/60 text-xs mt-0.5">
              {isPart1 ? 'Basic Sciences · Pharmacology' : 'Clinical Medicine · Specialties'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-white/50 mb-1">Today</div>
            <div className="text-sm font-bold text-white/80">{getTodayUTC()}</div>
          </div>
        </div>

        {/* Info pills */}
        <div className="flex flex-wrap gap-2 mb-5">
          {[
            { icon: '❓', text: `${DAILY_QUESTION_COUNT} Questions` },
            { icon: '⏱️', text: `${DAILY_QUESTION_COUNT * 90 / 60} min` },
            { icon: '🔒', text: 'Same for everyone' },
          ].map((p) => (
            <div key={p.text} className="inline-flex items-center gap-1 bg-white/10 border border-white/15 text-white/80 text-xs px-2.5 py-1 rounded-full">
              <span>{p.icon}</span> {p.text}
            </div>
          ))}
        </div>

        {/* Result OR Start button */}
        {result ? (
          <ScoreCard result={result} />
        ) : (
          <div>
            {available < DAILY_QUESTION_COUNT && !isLoading && (
              <div className="mb-3 text-xs text-white/60 bg-white/10 rounded-xl p-3">
                ⚠️ Only {available} questions available for {part} — the full pool will expand as more questions are added.
              </div>
            )}
            <button
              onClick={() => onStart(part, dailyQs)}
              disabled={available === 0 || isLoading}
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-extrabold text-sm shadow-xl transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed ${btnColor}`}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              {isLoading ? 'Loading questions…' : `Start ${part} Daily Mock`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
function Leaderboard({ userId }: { userId: string }) {
  const [part, setPart] = useState<MRCPPart>('Part 1');
  const [results, setResults] = useState<DailyMockResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getLeaderboard(part).then((data) => {
      setResults(data);
      setLoading(false);
    });
  }, [part]);

  return (
    <div className="bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-blue-900 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-white font-extrabold text-lg">Today's Leaderboard</h3>
          <p className="text-white/50 text-xs mt-0.5">{getTodayUTC()} · Top 50</p>
        </div>
        <div className="flex bg-white/10 rounded-xl p-1 gap-1">
          {(['Part 1', 'Part 2'] as MRCPPart[]).map((p) => (
            <button
              key={p}
              onClick={() => setPart(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                part === p ? 'bg-white text-slate-900 shadow' : 'text-white/70 hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin mr-2" />
          Loading leaderboard…
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">🏆</div>
          <div className="text-gray-600 font-semibold">No results yet today</div>
          <div className="text-gray-400 text-sm mt-1">Be the first to complete the {part} mock!</div>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {results.map((r, i) => {
            const grade = gradeLabel(r.percentage);
            const isMe = r.userId === userId;
            return (
              <div
                key={`${r.userId}-${i}`}
                className={`flex items-center gap-4 px-6 py-3.5 transition-colors ${isMe ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                {/* Rank */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold flex-shrink-0 ${
                  i === 0 ? 'bg-amber-100 text-amber-700'
                  : i === 1 ? 'bg-gray-100 text-gray-600'
                  : i === 2 ? 'bg-orange-100 text-orange-700'
                  : 'bg-gray-50 text-gray-500'
                }`}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-bold truncate ${isMe ? 'text-blue-700' : 'text-gray-800'}`}>
                    {r.userName} {isMe && <span className="text-xs font-normal text-blue-500">(you)</span>}
                  </div>
                  <div className="text-xs text-gray-400">{formatTime(r.timeTaken)}</div>
                </div>

                {/* Score */}
                <div className="text-right flex-shrink-0">
                  <div className={`text-lg font-extrabold ${grade.color}`}>{r.percentage}%</div>
                  <div className="text-xs text-gray-400">{r.score}/{r.total}</div>
                </div>

                {/* Grade badge */}
                <div className={`hidden sm:block text-xs font-bold px-2.5 py-1 rounded-full border ${grade.bg} ${grade.color} flex-shrink-0`}>
                  {grade.label}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Countdown ─────────────────────────────────────────────────────────────────
function Countdown() {
  const [secs, setSecs] = useState(secondsUntilReset);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="inline-flex items-center gap-2 bg-slate-800 border border-white/10 text-white px-4 py-2 rounded-full text-sm font-mono font-bold">
      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
      Resets in {formatCountdown(secs)}
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────
export default function DailyMockView({ questions, user, onStart, isLoading }: DailyMockViewProps) {
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-indigo-500/10 pointer-events-none" />
        <div className="absolute -bottom-10 left-1/3 w-56 h-56 rounded-full bg-blue-500/8 pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 py-10">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-4">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Daily Challenge · Resets at Midnight UTC
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-2">
            Daily Mock Exam
          </h1>
          <p className="text-blue-200 text-base max-w-xl mb-5">
            20 questions · Same questions for every user · Results ranked live on the leaderboard.
          </p>
          <Countdown />
        </div>
      </div>

      {/* ── Exam Cards ── */}
      <div className="max-w-5xl mx-auto px-4 pt-8 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {(['Part 1', 'Part 2'] as MRCPPart[]).map((part) => (
            <ExamCard
              key={part}
              part={part}
              questions={questions}
              onStart={onStart}
              isLoading={isLoading}
            />
          ))}
        </div>
      </div>

      {/* ── Rules ── */}
      <div className="max-w-5xl mx-auto px-4 pb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 flex flex-wrap gap-6">
          {[
            { icon: '👥', title: 'Same Questions', desc: 'Everyone gets identical questions each day — randomised by date' },
            { icon: '⏱️', title: '90 Seconds Each', desc: 'Timed exam mode — no answer feedback during the test' },
            { icon: '1️⃣', title: 'One Attempt', desc: 'One attempt per part per day — resets at midnight UTC' },
            { icon: '📊', title: 'Live Ranking', desc: 'Your percentage appears instantly on the leaderboard' },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 min-w-[200px] flex-1">
              <span className="text-xl mt-0.5">{item.icon}</span>
              <div>
                <div className="text-sm font-bold text-gray-800">{item.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Leaderboard ── */}
      <div className="max-w-5xl mx-auto px-4 pb-16">
        <Leaderboard userId={user.id} />
      </div>
    </div>
  );
}
