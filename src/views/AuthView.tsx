import { useState } from 'react';
import { signIn, signUp, AuthError } from '../authStore';
import { User } from '../types';
import {
  UserIcon, MailIcon, LockIcon, EyeIcon, EyeOffIcon,
  ActivityIcon, BookOpenIcon, BarChartIcon, LightbulbIcon,
  SettingsIcon, AlertTriangleIcon, CheckCircleIcon, SpinnerIcon,
} from '../components/Icons';

interface Props {
  onAuth: (user: User) => void;
}

export default function AuthView({ onAuth }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  function reset() {
    setName(''); setEmail(''); setPassword(''); setConfirmPassword('');
    setError(null); setSuccessMsg('');
  }

  function switchMode(m: 'login' | 'signup') {
    setMode(m);
    reset();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg('');
    setLoading(true);

    await new Promise((r) => setTimeout(r, 400)); // simulate async

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setError({ field: 'confirmPassword', message: 'Passwords do not match.' });
        setLoading(false);
        return;
      }
      const { user, error: err } = signUp(name, email, password);
      if (err) { setError(err); setLoading(false); return; }
      if (user) {
        setSuccessMsg('Account created! Signing you in…');
        setTimeout(() => onAuth(user), 700);
      }
    } else {
      const { user, error: err } = await signIn(email, password);
      if (err) { setError(err); setLoading(false); return; }
      if (user) onAuth(user);
    }

    setLoading(false);
  }

  const fieldErr = (field: string) =>
    error?.field === field ? error.message : '';

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 overflow-hidden">
      {/* Left Panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -right-20 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 left-1/4 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="bg-blue-600 rounded-2xl p-3 shadow-lg">
              <ActivityIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-2xl">MRCP QBank</div>
              <div className="text-blue-300 text-sm">Past Papers · System-wise</div>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-4xl font-extrabold text-white leading-tight mb-6">
            Master MRCP<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
              Part 1 &amp; Part 2
            </span>
          </h1>
          <p className="text-blue-200 text-lg leading-relaxed mb-10">
            Comprehensive question bank with past papers organised by system, detailed explanations, and performance analytics to track your progress.
          </p>

          {/* Feature pills */}
          <div className="space-y-3">
            {[
              { icon: <BookOpenIcon className="w-5 h-5" />, text: '18+ Systems Covered — Cardiology to Palliative Medicine' },
              { icon: <BarChartIcon className="w-5 h-5" />, text: 'Timed & Tutor mode quizzes' },
              { icon: <ActivityIcon className="w-5 h-5" />, text: 'System-wise performance analytics' },
              { icon: <LightbulbIcon className="w-5 h-5" />, text: 'Detailed clinical explanations' },
              { icon: <SettingsIcon className="w-5 h-5" />, text: 'Admin panel with JSON bulk upload' },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3 text-blue-100">
                <div className="text-blue-400 flex-shrink-0">{f.icon}</div>
                <span className="text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom stats */}
        <div className="relative z-10 flex gap-8">
          {[
            { value: '17+', label: 'Systems' },
            { value: '2', label: 'MRCP Parts' },
            { value: '∞', label: 'Questions' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-extrabold text-white">{s.value}</div>
              <div className="text-blue-300 text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8 justify-center">
            <div className="bg-blue-600 rounded-xl p-2 shadow-lg">
              <ActivityIcon className="w-6 h-6 text-white" />
            </div>
            <div className="text-white font-bold text-xl">MRCP QBank</div>
          </div>

          {/* Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
            {/* Tab switcher */}
            <div className="flex bg-white/5 rounded-2xl p-1 mb-8 border border-white/10">
              {(['login', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    mode === m
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg'
                      : 'text-blue-200 hover:text-white'
                  }`}
                >
                  {m === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>

            {/* Heading */}
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-white">
                {mode === 'login' ? 'Welcome back!' : 'Join MRCP QBank'}
              </h2>
              <p className="text-blue-300 text-sm mt-1">
                {mode === 'login'
                  ? 'Sign in to continue your MRCP preparation.'
                  : 'Create your free account to start practising.'}
              </p>
            </div>

            {/* Global error */}
            {error && !error.field && (
              <div className="mb-4 bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-3 text-red-300 text-sm flex items-center gap-2">
                <AlertTriangleIcon className="w-4 h-4 flex-shrink-0" /> {error.message}
              </div>
            )}

            {/* Success */}
            {successMsg && (
              <div className="mb-4 bg-emerald-500/20 border border-emerald-400/30 rounded-xl px-4 py-3 text-emerald-300 text-sm flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 flex-shrink-0" /> {successMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name — signup only */}
              {mode === 'signup' && (
                <div>
                  <label className="block text-blue-200 text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Dr. John Smith"
                      autoComplete="name"
                      className={`w-full bg-white/5 border rounded-xl pl-10 pr-4 py-3 text-white placeholder-blue-400/50 text-sm focus:outline-none focus:ring-2 transition ${
                        fieldErr('name')
                          ? 'border-red-400/60 focus:ring-red-400/40'
                          : 'border-white/10 focus:ring-blue-400/40 focus:border-blue-400/50'
                      }`}
                    />
                  </div>
                  {fieldErr('name') && (
                    <p className="mt-1.5 text-red-400 text-xs flex items-center gap-1">
                      <AlertTriangleIcon className="w-3.5 h-3.5" /> {fieldErr('name')}
                    </p>
                  )}
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-blue-200 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400">
                    <MailIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="doctor@example.com"
                    autoComplete="email"
                    className={`w-full bg-white/5 border rounded-xl pl-10 pr-4 py-3 text-white placeholder-blue-400/50 text-sm focus:outline-none focus:ring-2 transition ${
                      fieldErr('email')
                        ? 'border-red-400/60 focus:ring-red-400/40'
                        : 'border-white/10 focus:ring-blue-400/40 focus:border-blue-400/50'
                    }`}
                  />
                </div>
                {fieldErr('email') && (
                  <p className="mt-1.5 text-red-400 text-xs flex items-center gap-1">
                    <AlertTriangleIcon className="w-3.5 h-3.5" /> {fieldErr('email')}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-blue-200 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400">
                    <LockIcon className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'Min 6 characters' : 'Enter your password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className={`w-full bg-white/5 border rounded-xl pl-10 pr-12 py-3 text-white placeholder-blue-400/50 text-sm focus:outline-none focus:ring-2 transition ${
                      fieldErr('password')
                        ? 'border-red-400/60 focus:ring-red-400/40'
                        : 'border-white/10 focus:ring-blue-400/40 focus:border-blue-400/50'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-200 transition"
                  >
                    {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErr('password') && (
                  <p className="mt-1.5 text-red-400 text-xs flex items-center gap-1">
                    <AlertTriangleIcon className="w-3.5 h-3.5" /> {fieldErr('password')}
                  </p>
                )}
              </div>

              {/* Confirm Password — signup only */}
              {mode === 'signup' && (
                <div>
                  <label className="block text-blue-200 text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400">
                      <LockIcon className="w-4 h-4" />
                    </div>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      autoComplete="new-password"
                      className={`w-full bg-white/5 border rounded-xl pl-10 pr-12 py-3 text-white placeholder-blue-400/50 text-sm focus:outline-none focus:ring-2 transition ${
                        fieldErr('confirmPassword')
                          ? 'border-red-400/60 focus:ring-red-400/40'
                          : 'border-white/10 focus:ring-blue-400/40 focus:border-blue-400/50'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-200 transition"
                    >
                      {showConfirm ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErr('confirmPassword') && (
                    <p className="mt-1.5 text-red-400 text-xs flex items-center gap-1">
                      <AlertTriangleIcon className="w-3.5 h-3.5" /> {fieldErr('confirmPassword')}
                    </p>
                  )}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 text-sm"
              >
                {loading ? (
                  <>
                    <SpinnerIcon className="w-4 h-4" />
                    {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                  </>
                ) : (
                  <>{mode === 'login' ? 'Sign In' : 'Create Account'}</>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-blue-400 text-xs">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Switch mode */}
              <p className="text-center text-blue-300 text-sm">
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  type="button"
                  onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                  className="text-blue-400 hover:text-white font-bold underline underline-offset-2 transition"
                >
                  {mode === 'login' ? 'Create one free' : 'Sign in'}
                </button>
              </p>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
