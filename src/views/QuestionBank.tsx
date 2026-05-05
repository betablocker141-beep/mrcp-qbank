import { useState, useMemo } from 'react';
import { PART1_SYSTEMS, PART2_SYSTEMS, Difficulty, Question, MRCPPart, QBankSource, QBANK_SOURCES, QBANK_SOURCE_COLORS, QBANK_SOURCE_ICONS } from '../types';
import QuestionImage from '../components/QuestionImage';
import RichText from '../components/RichText';
import { getAnsweredQuestionIds, resetAnsweredQuestionIds } from '../store';
import {
  SearchIcon, PlayIcon, ChevronDownIcon, LightbulbIcon,
  BookIcon, CheckIcon, ImageIcon,
} from '../components/Icons';

interface QuestionBankProps {
  activePart: MRCPPart;
  selectedSystem: string;
  setSelectedSystem: (s: string) => void;
  startQuiz: (questions: Question[], mode: 'tutor' | 'timed' | 'review') => void;
  questions: Question[];
  activeSource?: 'All' | 'Passmedicine' | 'Pastest';
}

const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];

export default function QuestionBank({ activePart, selectedSystem, setSelectedSystem, startQuiz, questions, activeSource = 'All' }: QuestionBankProps) {
  // For QBank sources: show all parts; for MRCP: filter by part
  const partQuestions = useMemo(() => {
    if (activeSource === 'Passmedicine' || activeSource === 'Pastest') {
      return questions.filter((q) => q.source === activeSource);
    }
    // MRCP native: exclude Passmedicine/Pastest
    return questions.filter(
      (q) => q.part === activePart && q.source !== 'Passmedicine' && q.source !== 'Pastest'
    );
  }, [questions, activePart, activeSource]);

  const [search, setSearch] = useState('');
  const [diffFilter, setDiffFilter] = useState<Difficulty | 'All'>('All');
  const [yearFilter, setYearFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState<QBankSource | 'All'>('All');
  const [imagesOnly, setImagesOnly] = useState(false);
  const [quizMode, setQuizMode] = useState<'tutor' | 'timed'>('tutor');
  const [quizCount, setQuizCount] = useState(10);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [skipAnswered, setSkipAnswered] = useState(true);
  // Bumped after reset to force the answered-ids re-read.
  const [answeredVersion, setAnsweredVersion] = useState(0);
  const answeredIds = useMemo(
    () => getAnsweredQuestionIds(),
    [answeredVersion, partQuestions]
  );

  const partSystems = activePart === 'Part 1' ? [...PART1_SYSTEMS] : [...PART2_SYSTEMS];

  const years = useMemo(() => {
    const ys = [...new Set(partQuestions.map((q) => q.year).filter(Boolean))].sort().reverse();
    return ['All', ...ys] as string[];
  }, [partQuestions]);

  const filtered = useMemo(() => {
    return partQuestions.filter((q) => {
      const sysOk = selectedSystem === 'All Systems' || q.system === selectedSystem;
      const diffOk = diffFilter === 'All' || q.difficulty === diffFilter;
      const yearOk = yearFilter === 'All' || q.year === yearFilter;
      const srcOk = sourceFilter === 'All' || q.source === sourceFilter;
      const imgOk = !imagesOnly || !!q.imageUrl;
      const searchOk =
        search.trim() === '' ||
        q.stem.toLowerCase().includes(search.toLowerCase()) ||
        q.topic.toLowerCase().includes(search.toLowerCase()) ||
        (q.tags ?? []).some((t) => t.toLowerCase().includes(search.toLowerCase()));
      return sysOk && diffOk && yearOk && srcOk && imgOk && searchOk;
    });
  }, [partQuestions, selectedSystem, diffFilter, yearFilter, sourceFilter, imagesOnly, search]);

  // Pool used to start a quiz batch — by default excludes questions
  // the user has already answered, so batches don't repeat.
  const quizPool = useMemo(() => {
    if (!skipAnswered) return filtered;
    return filtered.filter((q) => !answeredIds.has(q.id));
  }, [filtered, skipAnswered, answeredIds]);

  const completedInView = filtered.length - quizPool.length;

  const diffColor = (d: Difficulty) =>
    d === 'Easy' ? 'bg-green-100 text-green-700' : d === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';

  const handleStartQuiz = () => {
    if (quizPool.length === 0) return;
    const shuffled = [...quizPool].sort(() => Math.random() - 0.5).slice(0, quizCount);
    startQuiz(shuffled, quizMode);
  };

  const handleResetProgress = () => {
    if (answeredIds.size === 0) return;
    if (window.confirm(`Reset your progress? This will clear ${answeredIds.size} answered question${answeredIds.size === 1 ? '' : 's'} so you can practise them again. Your performance stats are not affected.`)) {
      resetAnsweredQuestionIds();
      setAnsweredVersion((v) => v + 1);
    }
  };

  const partColor = activePart === 'Part 1' ? 'bg-sky-600 hover:bg-sky-700' : 'bg-emerald-600 hover:bg-emerald-700';
  const partBadge = activePart === 'Part 1'
    ? 'bg-sky-100 text-sky-700 border border-sky-200'
    : 'bg-emerald-100 text-emerald-700 border border-emerald-200';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-5">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">Question Bank</h1>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${partBadge}`}>
                  {activePart}
                </span>
              </div>
              <p className="text-gray-500 text-sm">
                {filtered.length} of {partQuestions.length} questions
                {skipAnswered && completedInView > 0 && (
                  <> · <span className="text-emerald-600 font-semibold">{completedInView} completed</span> · <span className="text-blue-600 font-semibold">{quizPool.length} new</span></>
                )}
              </p>
            </div>

            {/* Quiz Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={quizMode}
                onChange={(e) => setQuizMode(e.target.value as any)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="tutor">Tutor Mode</option>
                <option value="timed">Timed Mode</option>
              </select>
              <select
                value={quizCount}
                onChange={(e) => setQuizCount(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[5, 10, 20, 30, 40].map((n) => (
                  <option key={n} value={n}>{n} Questions</option>
                ))}
                <option value={999}>All Questions</option>
              </select>
              <button
                onClick={handleStartQuiz}
                disabled={quizPool.length === 0}
                className={`${partColor} text-white px-5 py-2 rounded-lg text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed shadow flex items-center gap-2`}
              >
                <PlayIcon className="w-4 h-4" /> Start Quiz
              </button>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions, topics, tags..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* System */}
            <select
              value={selectedSystem}
              onChange={(e) => setSelectedSystem(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All Systems">All Systems</option>
              {partSystems.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Difficulty */}
            <div className="flex gap-1">
              {(['All', ...difficulties] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDiffFilter(d as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                    diffFilter === d
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* Year */}
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y === 'All' ? 'All Years' : y}</option>
              ))}
            </select>

            {/* QBank Source filter */}
            <div className="flex gap-1">
              {(['All', ...QBANK_SOURCES] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSourceFilter(s as QBankSource | 'All')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                    sourceFilter === s
                      ? s === 'Passmedicine' ? 'bg-violet-600 text-white border-violet-600'
                        : s === 'Pastest' ? 'bg-teal-600 text-white border-teal-600'
                        : s === 'Custom' ? 'bg-gray-600 text-white border-gray-600'
                        : 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {s === 'Passmedicine' ? '🟣 ' : s === 'Pastest' ? '🟢 ' : s === 'Custom' ? '⚙️ ' : ''}{s}
                </button>
              ))}
            </div>

            {/* Images Only toggle */}
            <button
              onClick={() => setImagesOnly((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                imagesOnly
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-violet-400'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Images Only
            </button>

            {/* Skip-answered toggle (no-repeat across batches) */}
            <button
              onClick={() => setSkipAnswered((v) => !v)}
              title={skipAnswered ? 'Already-answered questions are excluded from new batches' : 'All matching questions can appear in new batches'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                skipAnswered
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
              }`}
            >
              <CheckIcon className="w-3.5 h-3.5" />
              {skipAnswered ? 'Skipping answered' : 'Including answered'}
            </button>

            {/* Reset progress (per-user) */}
            {answeredIds.size > 0 && (
              <button
                onClick={handleResetProgress}
                title="Clear your answered-question history so all questions become available again"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border bg-white text-rose-600 border-rose-300 hover:bg-rose-50"
              >
                Reset progress ({answeredIds.size})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Question List */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <SearchIcon className="w-8 h-8 text-gray-400" />
            </div>
            <div className="text-xl font-semibold text-gray-600">No questions found</div>
            <div className="text-gray-400 mt-2">Try adjusting your filters</div>
          </div>
        ) : skipAnswered && quizPool.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckIcon className="w-8 h-8 text-emerald-600" />
            </div>
            <div className="text-xl font-semibold text-gray-700">You've answered every question in this filter</div>
            <div className="text-gray-500 mt-2">Toggle "Including answered" to revise, or reset progress to start over.</div>
            <div className="flex justify-center gap-3 mt-5">
              <button
                onClick={() => setSkipAnswered(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold"
              >
                Include answered
              </button>
              <button
                onClick={handleResetProgress}
                className="bg-white text-rose-600 border border-rose-300 hover:bg-rose-50 px-4 py-2 rounded-lg text-sm font-bold"
              >
                Reset progress
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((q, idx) => (
              <div key={q.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all">
                <button
                  onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                  className="w-full text-left p-5"
                >
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-100 text-blue-700 rounded-xl w-10 h-10 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${partBadge}`}>{q.part}</span>
                        {q.source && (
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${QBANK_SOURCE_COLORS[q.source]}`}>
                            {QBANK_SOURCE_ICONS[q.source]} {q.source}
                          </span>
                        )}
                        <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">{q.system}</span>
                        <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-0.5 rounded-full">{q.topic}</span>
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${diffColor(q.difficulty)}`}>{q.difficulty}</span>
                        {q.year && <span className="bg-purple-100 text-purple-700 text-xs font-medium px-2.5 py-0.5 rounded-full">{q.year}</span>}
                        {q.imageType && (
                          <span className="bg-slate-700 text-white text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" /> {q.imageType}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-sm leading-relaxed line-clamp-2">{
                        q.stem
                          .replace(/\|[^|]*\|/g, '')          // strip pipe table cells
                          .replace(/\*\*([^*]+)\*\*/g, '$1')  // strip **bold**
                          .replace(/\*([^*]+)\*/g, '$1')       // strip *italic*
                          .replace(/__([^_]+)__/g, '$1')       // strip __bold__
                          .replace(/_([^_]+)_/g, '$1')         // strip _italic_
                          .replace(/`([^`]+)`/g, '$1')         // strip `code`
                          .replace(/\s+/g, ' ')
                          .trim()
                      }</p>
                      {q.tags && q.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {q.tags.map((t) => (
                            <span key={t} className="text-xs bg-gray-50 text-gray-500 border border-gray-200 px-2 py-0.5 rounded">#{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <ChevronDownIcon className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${expandedId === q.id ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {expandedId === q.id && (
                  <div className="border-t border-gray-100 p-5 bg-gray-50">
                    <div className="mb-4">
                      <RichText text={q.stem} className="text-gray-800 text-[15px] mb-4" />
                      {/* Image in expanded view */}
                      {q.imageUrl && (
                        <div className="mb-4">
                          <QuestionImage
                            imageUrl={q.imageUrl}
                            imageType={q.imageType}
                            imageCaption={q.imageCaption}
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        {q.options.map((opt) => (
                          <div
                            key={opt.id}
                            className={`flex items-start gap-3 p-3 rounded-xl border ${
                              opt.id === q.correctAnswer
                                ? 'bg-green-50 border-green-300'
                                : 'bg-white border-gray-200'
                            }`}
                          >
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                              opt.id === q.correctAnswer ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                            }`}>
                              {opt.id === q.correctAnswer ? <CheckIcon className="w-4 h-4" /> : opt.id}
                            </span>
                            <span className={`text-sm ${opt.id === q.correctAnswer ? 'text-green-800 font-medium' : 'text-gray-700'}`}>
                              {opt.text}
                            </span>
                            {opt.id === q.correctAnswer && (
                              <span className="ml-auto text-green-600 text-xs font-bold whitespace-nowrap">Correct</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <div className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                        <LightbulbIcon className="w-4 h-4 text-amber-500" /> Explanation
                      </div>
                      <RichText text={q.explanation} className="text-blue-800 text-sm" />
                      {q.reference && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-blue-600 font-medium">
                          <BookIcon className="w-3.5 h-3.5" /> {q.reference}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end mt-4">
                      <button
                        onClick={() => startQuiz([q], 'tutor')}
                        className={`${partColor} text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2`}
                      >
                        <PlayIcon className="w-3.5 h-3.5" /> Practice This Question
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
