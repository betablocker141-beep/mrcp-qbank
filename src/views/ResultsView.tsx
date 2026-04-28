import { QuizSession } from '../types';
import {
  TrophyIcon, CheckCircleIcon, XCircleIcon, FlagIcon,
  TargetIcon, ClockIcon, BarChartIcon, CheckIcon, XIcon,
  ArrowRightIcon, BookOpenIcon, HomeIcon, SearchIcon,
} from '../components/Icons';

interface ResultsViewProps {
  session: QuizSession;
  onReview: () => void;
  onNewQuiz: () => void;
  onDashboard: () => void;
}

export default function ResultsView({ session, onReview, onNewQuiz, onDashboard }: ResultsViewProps) {
  const total = session.questions.length;
  const answered = Object.keys(session.answers).length;
  const correct = session.questions.filter((q) => session.answers[q.id] === q.correctAnswer).length;
  const incorrect = answered - correct;
  const unanswered = total - answered;
  const pct = answered > 0 ? Math.round((correct / total) * 100) : 0;

  const timeTaken = session.endTime ? Math.round((session.endTime - session.startTime) / 1000) : 0;
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  const grade =
    pct >= 75 ? { label: 'Excellent', sublabel: 'Outstanding performance', color: 'text-green-600', bg: 'bg-gradient-to-br from-green-50 to-emerald-50', border: 'border-green-200', barColor: 'from-green-400 to-emerald-500' }
    : pct >= 60 ? { label: 'Good Pass', sublabel: 'Well above the pass mark', color: 'text-blue-600', bg: 'bg-gradient-to-br from-blue-50 to-indigo-50', border: 'border-blue-200', barColor: 'from-blue-400 to-indigo-500' }
    : pct >= 50 ? { label: 'Borderline', sublabel: 'Close to the pass mark', color: 'text-amber-600', bg: 'bg-gradient-to-br from-amber-50 to-yellow-50', border: 'border-amber-200', barColor: 'from-amber-400 to-orange-500' }
    : { label: 'Needs Work', sublabel: 'Review these topics carefully', color: 'text-red-600', bg: 'bg-gradient-to-br from-red-50 to-rose-50', border: 'border-red-200', barColor: 'from-red-400 to-rose-500' };

  const systemBreakdown: Record<string, { correct: number; total: number }> = {};
  session.questions.forEach((q) => {
    if (!systemBreakdown[q.system]) systemBreakdown[q.system] = { correct: 0, total: 0 };
    systemBreakdown[q.system].total++;
    if (session.answers[q.id] === q.correctAnswer) systemBreakdown[q.system].correct++;
  });

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Score Card */}
        <div className={`${grade.bg} border-2 ${grade.border} rounded-3xl p-8 shadow-lg`}>
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Circular Progress */}
            <div className="relative w-36 h-36 flex-shrink-0">
              <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" stroke="#e5e7eb" strokeWidth="10" fill="none" />
                <circle
                  cx="60" cy="60" r="50"
                  stroke="url(#rGrad)" strokeWidth="10" fill="none"
                  strokeDasharray={`${(pct / 100) * 314} 314`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="rGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={pct >= 75 ? '#22c55e' : pct >= 60 ? '#3b82f6' : pct >= 50 ? '#f59e0b' : '#ef4444'} />
                    <stop offset="100%" stopColor={pct >= 75 ? '#10b981' : pct >= 60 ? '#6366f1' : pct >= 50 ? '#f97316' : '#f43f5e'} />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-black ${grade.color}`}>{pct}%</span>
                <span className="text-xs text-gray-400 font-medium">Score</span>
              </div>
            </div>

            <div className="text-center md:text-left">
              <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
                <TrophyIcon className={`w-6 h-6 ${grade.color}`} />
                <span className={`text-2xl font-black ${grade.color}`}>{grade.label}</span>
              </div>
              <p className="text-gray-500 text-sm mb-3">{grade.sublabel}</p>
              <p className="text-gray-700 text-sm font-medium">
                {correct} correct out of {total} questions
              </p>
              <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-500 justify-center md:justify-start">
                <ClockIcon className="w-4 h-4" />
                <span>{formatTime(timeTaken)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Correct', value: correct, icon: <CheckCircleIcon className="w-5 h-5 text-green-500" />, color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
            { label: 'Incorrect', value: incorrect, icon: <XCircleIcon className="w-5 h-5 text-red-500" />, color: 'text-red-600', bg: 'bg-red-50 border-red-100' },
            { label: 'Unanswered', value: unanswered, icon: <TargetIcon className="w-5 h-5 text-gray-400" />, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-100' },
            { label: 'Flagged', value: session.flagged.size, icon: <FlagIcon className="w-5 h-5 text-amber-500" />, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-4 text-center ${s.bg}`}>
              <div className="flex justify-center mb-2">{s.icon}</div>
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-gray-500 text-xs mt-1 font-medium">{s.label}</div>
            </div>
          ))}
        </div>

        {/* System Breakdown */}
        {Object.keys(systemBreakdown).length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
              <BarChartIcon className="w-5 h-5 text-blue-500" />
              Performance by System
            </h3>
            <div className="space-y-3">
              {Object.entries(systemBreakdown).map(([sys, data]) => {
                const sysPct = Math.round((data.correct / data.total) * 100);
                return (
                  <div key={sys}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700">{sys}</span>
                      <span className={`text-sm font-bold ${sysPct >= 70 ? 'text-green-600' : sysPct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                        {data.correct}/{data.total} ({sysPct}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${sysPct >= 70 ? 'bg-green-500' : sysPct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ width: `${sysPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Question Summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BookOpenIcon className="w-5 h-5 text-blue-500" />
            Question Summary
          </h3>
          <div className="space-y-2">
            {session.questions.map((q, i) => {
              const ans = session.answers[q.id];
              const isCorrect = ans === q.correctAnswer;
              const flagged = session.flagged.has(q.id);
              return (
                <div key={q.id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                  !ans ? 'border-gray-100 bg-gray-50' :
                  isCorrect ? 'border-green-100 bg-green-50' : 'border-red-100 bg-red-50'
                }`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    !ans ? 'bg-gray-200 text-gray-500' :
                    isCorrect ? 'bg-green-500 text-white' : 'bg-red-400 text-white'
                  }`}>
                    {!ans ? (
                      <span className="text-xs font-bold">{i + 1}</span>
                    ) : isCorrect ? (
                      <CheckIcon className="w-3.5 h-3.5" />
                    ) : (
                      <XIcon className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-700 truncate">{q.stem.substring(0, 80)}...</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">{q.system}</span>
                      {!ans && <span className="text-xs text-gray-400">Not answered</span>}
                      {ans && <span className="text-xs text-gray-500">Your: <strong>{ans}</strong> · Correct: <strong>{q.correctAnswer}</strong></span>}
                      {flagged && <FlagIcon className="w-3 h-3 text-amber-500" filled />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 justify-center pb-8">
          <button onClick={onReview}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg">
            <SearchIcon className="w-4 h-4" /> Review Answers
          </button>
          <button onClick={onNewQuiz}
            className="flex items-center gap-2 bg-white border-2 border-blue-600 text-blue-700 px-6 py-3 rounded-xl font-bold hover:bg-blue-50 transition shadow">
            <ArrowRightIcon className="w-4 h-4" /> New Quiz
          </button>
          <button onClick={onDashboard}
            className="flex items-center gap-2 bg-slate-100 text-slate-700 px-6 py-3 rounded-xl font-bold hover:bg-slate-200 transition">
            <HomeIcon className="w-4 h-4" /> Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
