import { useState, useCallback, useEffect } from 'react';
import { Question, QuizSession, MRCPPart, User } from './types';
import { saveSession, getQuestions, syncFromSupabase } from './store';
import { getSession, signOut } from './authStore';
import Dashboard from './views/Dashboard';
import QuestionBank from './views/QuestionBank';
import QuizView from './views/QuizView';
import ResultsView from './views/ResultsView';
import StatsView from './views/StatsView';
import AdminPanel from './views/AdminPanel';
import AuthView from './views/AuthView';
import TextbookView from './views/TextbookView';
import OneLinerView from './views/OneLinerView';
import {
  HomeIcon, BookOpenIcon, BarChartIcon, SettingsIcon,
  LogOutIcon, ChevronDownIcon, ActivityIcon, LockIcon,
} from './components/Icons';

export type View = 'dashboard' | 'bank' | 'quiz' | 'results' | 'stats' | 'admin' | 'textbooks' | 'oneliners';

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function avatarColor(name: string) {
  const colors = [
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-violet-500 to-purple-600',
    'from-cyan-500 to-blue-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function Navbar({
  currentView, setView, activePart, setActivePart, user, onLogout,
}: {
  currentView: View;
  setView: (v: View) => void;
  activePart: MRCPPart;
  setActivePart: (p: MRCPPart) => void;
  user: User;
  onLogout: () => void;
}) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const isAdmin = user.role === 'admin';

  const navItems: { label: string; view: View; icon: React.ReactNode }[] = [
    { label: 'Dashboard', view: 'dashboard', icon: <HomeIcon className="w-4 h-4" /> },
    { label: 'Question Bank', view: 'bank', icon: <BookOpenIcon className="w-4 h-4" /> },
    { label: 'Textbooks', view: 'textbooks', icon: <span className="text-sm">📚</span> },
    { label: 'Pearls', view: 'oneliners', icon: <span className="text-sm">💡</span> },
    { label: 'Performance', view: 'stats', icon: <BarChartIcon className="w-4 h-4" /> },
  ];

  return (
    <nav className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white shadow-xl sticky top-0 z-50 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <button
            onClick={() => setView('dashboard')}
            className="flex items-center gap-3 hover:opacity-90 transition shrink-0"
          >
            <div className="bg-blue-600 rounded-xl p-2 shadow-lg">
              <ActivityIcon className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <div className="font-bold text-base leading-tight tracking-wide">MRCP QBank</div>
              <div className="text-xs text-blue-300 leading-tight font-medium">Past Papers · System-wise</div>
            </div>
          </button>

          {/* Part Switcher */}
          <div className="flex items-center bg-white/10 rounded-xl p-1 gap-1 shrink-0 border border-white/10">
            {(['Part 1', 'Part 2'] as MRCPPart[]).map((part) => (
              <button
                key={part}
                onClick={() => { setActivePart(part); setView('dashboard'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activePart === part
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'text-blue-200 hover:text-white hover:bg-white/10'
                }`}
              >
                {part}
              </button>
            ))}
          </div>

          {/* Nav Items */}
          <div className="flex items-center gap-1 flex-1 justify-end">
            {navItems.map((item) => (
              <button
                key={item.view}
                onClick={() => setView(item.view)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentView === item.view
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-blue-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="hidden md:inline">{item.label}</span>
              </button>
            ))}

            {isAdmin && (
              <button
                onClick={() => setView('admin')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ml-1 border ${
                  currentView === 'admin'
                    ? 'bg-amber-500 text-white border-amber-400 shadow-md'
                    : 'text-amber-300 hover:bg-amber-500/20 border-amber-500/30'
                }`}
              >
                <SettingsIcon className="w-4 h-4" />
                <span className="hidden md:inline">Admin</span>
              </button>
            )}

            {/* User Menu */}
            <div className="relative ml-1">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl px-2.5 py-1.5 transition-all"
              >
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${avatarColor(user.name)} flex items-center justify-center text-white font-bold text-xs shadow`}>
                  {getInitials(user.name)}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-white text-xs font-semibold leading-tight max-w-[90px] truncate">{user.name}</div>
                  <div className="text-blue-400 text-[10px] leading-tight capitalize">{user.role}</div>
                </div>
                <ChevronDownIcon className={`w-3.5 h-3.5 text-blue-300 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
                  <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${avatarColor(user.name)} flex items-center justify-center text-white font-bold text-base shadow`}>
                        {getInitials(user.name)}
                      </div>
                      <div>
                        <div className="text-white font-bold text-sm">{user.name}</div>
                        <div className="text-blue-200 text-xs mt-0.5">{user.email}</div>
                        <span className={`mt-1 inline-block text-xs font-bold px-2 py-0.5 rounded-full ${
                          user.role === 'admin' ? 'bg-amber-400 text-amber-900' : 'bg-blue-400/30 text-blue-100'
                        }`}>
                          {user.role === 'admin' ? 'Administrator' : 'Student'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2">
                    <button onClick={() => { setView('stats'); setUserMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition text-sm font-medium">
                      <BarChartIcon className="w-4 h-4" /> My Performance
                    </button>
                    <button onClick={() => { setView('bank'); setUserMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition text-sm font-medium">
                      <BookOpenIcon className="w-4 h-4" /> Question Bank
                    </button>
                    <button onClick={() => { setView('textbooks'); setUserMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition text-sm font-medium">
                      <span>📚</span> Textbooks
                    </button>
                    <button onClick={() => { setView('oneliners'); setUserMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition text-sm font-medium">
                      <span>💡</span> One-Liners & Pearls
                    </button>
                    {isAdmin && (
                      <button onClick={() => { setView('admin'); setUserMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-amber-700 hover:bg-amber-50 transition text-sm font-medium">
                        <SettingsIcon className="w-4 h-4" /> Admin Panel
                      </button>
                    )}
                    <div className="border-t border-gray-100 my-1.5" />
                    <button onClick={() => { setUserMenuOpen(false); onLogout(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-600 hover:bg-red-50 transition text-sm font-medium">
                      <LogOutIcon className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Part indicator stripe */}
        <div className={`h-0.5 rounded-full transition-all ${activePart === 'Part 1' ? 'bg-sky-400' : 'bg-emerald-400'}`} />
      </div>

      {userMenuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
      )}
    </nav>
  );
}

function generateId() {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function App() {
  const [user, setUser] = useState<User | null>(() => getSession());
  const [view, setView] = useState<View>('dashboard');
  const [activePart, setActivePart] = useState<MRCPPart>('Part 1');
  const [selectedSystem, setSelectedSystem] = useState('All Systems');
  const [activeSession, setActiveSession] = useState<QuizSession | null>(null);
  const [completedSession, setCompletedSession] = useState<QuizSession | null>(null);
  const [_reviewMode, setReviewMode] = useState(false);
  const [questions, setQuestions] = useState<Question[]>(getQuestions);
  // Only show loading spinner if there's nothing cached — otherwise sync silently in background
  const [isLoading, setIsLoading] = useState(() => getQuestions().length === 0);
  // Track which qbank the user navigated from (for QuestionBank source pre-filter)
  const [activeSource, setActiveSource] = useState<'All' | 'Passmedicine' | 'Pastest'>('All');

  const refreshQuestions = useCallback((showLoading = false) => {
    if (showLoading) setIsLoading(true);
    syncFromSupabase()
      .then((qs) => { setQuestions(qs); })
      .catch(() => { setQuestions(getQuestions()); })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    // Show loading only if cache is empty; otherwise sync silently in background
    refreshQuestions(getQuestions().length === 0);
  }, []);

  function handleAuth(authedUser: User) {
    setUser(authedUser);
    setView('dashboard');
  }

  function handleLogout() {
    signOut();
    setUser(null);
    setView('dashboard');
    setActiveSession(null);
    setCompletedSession(null);
  }

  const startQuiz = useCallback(
    (questions: Question[], mode: 'tutor' | 'timed' | 'review') => {
      const session: QuizSession = {
        id: generateId(),
        questions,
        answers: {},
        flagged: new Set<string>(),
        startTime: Date.now(),
        mode,
        currentIndex: 0,
      };
      saveSession(session);
      setActiveSession(session);
      setReviewMode(false);
      setView('quiz');
    },
    []
  );

  const handleFinishQuiz = useCallback((session: QuizSession) => {
    setCompletedSession(session);
    setActiveSession(null);
    setView('results');
  }, []);

  const handleReviewAnswers = useCallback(() => {
    if (!completedSession) return;
    const reviewSession: QuizSession = {
      ...completedSession,
      mode: 'tutor',
      currentIndex: 0,
      flagged: new Set(completedSession.flagged),
    };
    setActiveSession(reviewSession);
    setReviewMode(true);
    setView('quiz');
  }, [completedSession]);

  const handleExitQuiz = useCallback(() => {
    setActiveSession(null);
    setView('bank');
  }, []);

  const navigateTo = (v: View) => {
    if (view === 'quiz') return;
    setView(v);
  };

  if (!user) {
    return <AuthView onAuth={handleAuth} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {view !== 'quiz' && (
        <Navbar
          currentView={view}
          setView={navigateTo}
          activePart={activePart}
          setActivePart={(p) => { setActivePart(p); setSelectedSystem('All Systems'); }}
          user={user}
          onLogout={handleLogout}
        />
      )}

      {view === 'dashboard' && (
        <Dashboard
          activePart={activePart}
          setActivePart={(p) => { setActivePart(p); setActiveSource('All'); }}
          setView={(v) => setView(v as View)}
          setSelectedSystem={setSelectedSystem}
          setActiveSource={setActiveSource}
          questions={questions}
          isLoading={isLoading}
        />
      )}

      {view === 'bank' && (
        <QuestionBank
          activePart={activePart}
          selectedSystem={selectedSystem}
          setSelectedSystem={setSelectedSystem}
          startQuiz={startQuiz}
          questions={questions}
          activeSource={activeSource}
        />
      )}

      {view === 'quiz' && activeSession && (
        <QuizView
          session={activeSession}
          onFinish={handleFinishQuiz}
          onExit={handleExitQuiz}
        />
      )}

      {view === 'results' && completedSession && (
        <ResultsView
          session={completedSession}
          onReview={handleReviewAnswers}
          onNewQuiz={() => setView('bank')}
          onDashboard={() => setView('dashboard')}
        />
      )}

      {view === 'stats' && <StatsView activePart={activePart} />}

      {view === 'textbooks' && <TextbookView />}

      {view === 'oneliners' && <OneLinerView />}

      {view === 'admin' && user.role === 'admin' && <AdminPanel onDataChange={refreshQuestions} />}

      {view === 'admin' && user.role !== 'admin' && (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center bg-white rounded-2xl shadow-xl p-12 max-w-sm mx-auto">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <LockIcon className="w-8 h-8 text-red-500" />
            </div>
            <div className="text-xl font-bold text-gray-800 mb-2">Access Restricted</div>
            <p className="text-gray-500 text-sm mb-6">You don't have permission to view this page.</p>
            <button
              onClick={() => setView('dashboard')}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
