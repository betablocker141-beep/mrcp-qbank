import { useState, useEffect } from 'react';
import {
  getAllUsers, deleteUser, updateUserRole,
  getAllSubscriptions, setSubscription, getSession,
  adminCreateAccount, adminResetPassword,
} from '../authStore';
import { User, UserRole } from '../types';

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function avatarColor(name: string) {
  const colors = [
    'from-blue-500 to-indigo-500', 'from-emerald-500 to-teal-500',
    'from-amber-500 to-orange-500', 'from-rose-500 to-pink-500',
    'from-violet-500 to-purple-500', 'from-cyan-500 to-blue-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [subs, setSubs] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'subscribed' | 'free' | 'admin'>('all');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [loadingSub, setLoadingSub] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<string | null>(null); // email (table row)
  const [resetPass, setResetPass] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  // Reset password by email (for users not in table)
  const [resetByEmail, setResetByEmail] = useState('');
  const [resetByPass, setResetByPass] = useState('');
  const [showResetByPass, setShowResetByPass] = useState(false);
  const [resetByLoading, setResetByLoading] = useState(false);
  const [resetByError, setResetByError] = useState('');
  // Manual grant by email
  const [grantEmail, setGrantEmail] = useState('');
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantError, setGrantError] = useState('');
  // Create account
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPass, setCreatePass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const currentUser = getSession();

  const reload = async () => {
    const u = getAllUsers();
    setUsers(u);
    const rows = await getAllSubscriptions();
    const map: Record<string, boolean> = {};
    for (const r of rows) map[r.email] = r.subscribed;
    setSubs(map);
  };

  useEffect(() => { reload(); }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleToggleRole = (user: User) => {
    const newRole: UserRole = user.role === 'admin' ? 'student' : 'admin';
    updateUserRole(user.id, newRole);
    reload();
    showToast(`${user.name} is now ${newRole === 'admin' ? 'an Admin' : 'a Student'}`);
  };

  const handleToggleSub = async (user: User) => {
    const current = subs[user.email] ?? false;
    setLoadingSub(user.email);
    await setSubscription(user.email, !current, currentUser?.name ?? 'admin');
    await reload();
    setLoadingSub(null);
    showToast(`${user.name}: subscription ${!current ? 'activated ✓' : 'revoked'}`);
  };

  const handleCreateAccount = async () => {
    setCreateError('');
    setCreateLoading(true);
    const { ok, error } = await adminCreateAccount(
      createName, createEmail, createPass, currentUser?.name ?? 'admin',
    );
    setCreateLoading(false);
    if (!ok) { setCreateError(error ?? 'Something went wrong.'); return; }
    setCreateName(''); setCreateEmail(''); setCreatePass('');
    await reload();
    showToast(`Account created for ${createEmail} — subscribed ✓`);
  };

  const handleResetPassword = async () => {
    if (!resetTarget || resetPass.length < 6) return;
    setResetLoading(true);
    const { ok, error } = await adminResetPassword(resetTarget, resetPass);
    setResetLoading(false);
    if (!ok) { showToast(`Error: ${error}`); return; }
    setResetTarget(null);
    setResetPass('');
    showToast(`Password reset for ${resetTarget} ✓`);
  };

  const handleResetByEmail = async () => {
    const email = resetByEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setResetByError('Please enter a valid email address.');
      return;
    }
    if (resetByPass.length < 6) {
      setResetByError('Password must be at least 6 characters.');
      return;
    }
    setResetByError('');
    setResetByLoading(true);
    const { ok, error } = await adminResetPassword(email, resetByPass);
    setResetByLoading(false);
    if (!ok) { setResetByError(error ?? 'Could not reset — make sure the account exists first.'); return; }
    setResetByEmail('');
    setResetByPass('');
    showToast(`Password reset for ${email} ✓`);
  };

  const handleGrantByEmail = async () => {
    const email = grantEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setGrantError('Please enter a valid email address.');
      return;
    }
    setGrantError('');
    setGrantLoading(true);
    await setSubscription(email, true, currentUser?.name ?? 'admin');
    await reload();
    setGrantLoading(false);
    setGrantEmail('');
    showToast(`Access granted to ${email} ✓`);
  };

  const handleDelete = (id: string) => {
    deleteUser(id);
    reload();
    setConfirmDelete(null);
    showToast('User deleted');
  };

  const filtered = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const sub = subs[u.email] ?? false;
    if (filter === 'subscribed') return matchSearch && sub && u.role !== 'admin';
    if (filter === 'free')       return matchSearch && !sub && u.role !== 'admin';
    if (filter === 'admin')      return matchSearch && u.role === 'admin';
    return matchSearch;
  });

  const totalStudents = users.filter((u) => u.role === 'student').length;
  const subscribedCount = users.filter((u) => u.role === 'student' && (subs[u.email] ?? false)).length;

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl font-semibold text-sm flex items-center gap-2">
          ✓ {toast}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Users',  value: users.length,                                          icon: '👥', color: 'bg-blue-50 border-blue-200 text-blue-700' },
          { label: 'Subscribed',   value: subscribedCount,                                       icon: '✅', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
          { label: 'Free Users',   value: totalStudents - subscribedCount,                       icon: '🔒', color: 'bg-amber-50 border-amber-200 text-amber-700' },
          { label: 'Admins',       value: users.filter((u) => u.role === 'admin').length,        icon: '⚙️', color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border p-4 ${s.color} flex items-center gap-3`}>
            <span className="text-2xl">{s.icon}</span>
            <div>
              <div className="text-2xl font-extrabold">{s.value}</div>
              <div className="text-xs font-medium opacity-75">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Create Account for Student ── */}
      <div className="bg-white border-2 border-blue-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">👤</span>
          <div>
            <h3 className="font-bold text-gray-800 text-sm">Create Account for Student</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Creates a Supabase-backed account — student can log in from any device with these credentials.
              Subscription is granted automatically.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <input
            type="text"
            value={createName}
            onChange={(e) => { setCreateName(e.target.value); setCreateError(''); }}
            placeholder="Full name"
            className="px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50"
          />
          <input
            type="email"
            value={createEmail}
            onChange={(e) => { setCreateEmail(e.target.value); setCreateError(''); }}
            placeholder="Email address"
            className="px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50"
          />
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              value={createPass}
              onChange={(e) => { setCreatePass(e.target.value); setCreateError(''); }}
              placeholder="Set password"
              className="w-full px-4 py-2.5 pr-10 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            >
              {showPass ? '🙈' : '👁️'}
            </button>
          </div>
        </div>
        {createError && <p className="text-xs text-red-600 mb-2">{createError}</p>}
        <button
          onClick={handleCreateAccount}
          disabled={createLoading || !createName.trim() || !createEmail.trim() || !createPass}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {createLoading
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : '👤'}
          Create Account &amp; Grant Access
        </button>
      </div>

      {/* ── Reset Password by Email ── */}
      <div className="bg-white border-2 border-orange-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🔑</span>
          <div>
            <h3 className="font-bold text-gray-800 text-sm">Reset Password by Email</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Update the password for any existing account — works even if the student isn't listed in the table below.
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-start flex-wrap">
          <input
            type="email"
            value={resetByEmail}
            onChange={(e) => { setResetByEmail(e.target.value); setResetByError(''); }}
            placeholder="student@email.com"
            className="flex-1 min-w-[180px] px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-gray-50"
          />
          <div className="relative flex-1 min-w-[180px]">
            <input
              type={showResetByPass ? 'text' : 'password'}
              value={resetByPass}
              onChange={(e) => { setResetByPass(e.target.value); setResetByError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleResetByEmail()}
              placeholder="New password"
              className="w-full px-4 py-2.5 pr-10 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-gray-50"
            />
            <button type="button" onClick={() => setShowResetByPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
              {showResetByPass ? '🙈' : '👁️'}
            </button>
          </div>
          <button
            onClick={handleResetByEmail}
            disabled={resetByLoading || !resetByEmail.trim() || resetByPass.length < 6}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm whitespace-nowrap"
          >
            {resetByLoading
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : '🔑'}
            Reset Password
          </button>
        </div>
        {resetByError && <p className="text-xs text-red-600 mt-2">{resetByError}</p>}
      </div>

      {/* ── Grant Access by Email ── */}
      <div className="bg-white border-2 border-emerald-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">✅</span>
          <div>
            <h3 className="font-bold text-gray-800 text-sm">Grant Access by Email</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Enter the student's registered email to activate their subscription — works even if they don't appear in the list below.
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-start">
          <div className="flex-1">
            <input
              type="email"
              value={grantEmail}
              onChange={(e) => { setGrantEmail(e.target.value); setGrantError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleGrantByEmail()}
              placeholder="student@email.com"
              className={`w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition ${
                grantError ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'
              }`}
            />
            {grantError && <p className="text-xs text-red-600 mt-1">{grantError}</p>}
          </div>
          <button
            onClick={handleGrantByEmail}
            disabled={grantLoading || !grantEmail.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-sm"
          >
            {grantLoading
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : '✅'}
            Grant Access
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
        <span className="text-2xl">💳</span>
        <div>
          <div className="font-bold text-blue-800 text-sm">Manual Subscription Activation</div>
          <div className="text-blue-600 text-xs mt-0.5">
            Students pay <strong>$30 USD</strong> to <strong>salvahardin492@gmail.com</strong>, then use the
            {' '}<strong>Grant Access by Email</strong> box above or the <strong>✅ Subscribe</strong> button in the table.
            Note: the table only shows users from this browser — use the email box for anyone not listed.
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs">
          {([
            ['all', '👥 All'], ['subscribed', '✅ Subscribed'],
            ['free', '🔒 Free'], ['admin', '⚙️ Admin'],
          ] as const).map(([v, label]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3 py-2.5 font-semibold transition whitespace-nowrap ${
                filter === v ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wide">User</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wide hidden md:table-cell">Joined</th>
                <th className="text-right px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-400">
                    <div className="text-3xl mb-2">👤</div>
                    <div className="text-sm">No users found</div>
                  </td>
                </tr>
              )}
              {filtered.map((user) => {
                const isSelf = user.id === currentUser?.id;
                const isDefaultAdmin = user.email === 'admin@mrcpqbank.com';
                const isAdmin = user.role === 'admin';
                const subscribed = isAdmin || (subs[user.email] ?? false);
                const isLoadingThis = loadingSub === user.email;

                return (
                  <tr key={user.id} className={`hover:bg-gray-50 transition ${isSelf ? 'bg-indigo-50/40' : ''}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${avatarColor(user.name)} flex items-center justify-center text-white font-bold text-sm shadow`}>
                          {getInitials(user.name)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-gray-900 text-sm">{user.name}</span>
                            {isSelf && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">You</span>}
                          </div>
                          <div className="text-xs text-gray-400">{user.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full w-fit ${
                          isAdmin ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {isAdmin ? '⚙️ Admin' : '🎓 Student'}
                        </span>
                        {!isAdmin && (
                          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full w-fit ${
                            subscribed ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {subscribed ? '✅ Subscribed' : '🔒 Free'}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className="text-sm text-gray-400">{formatDate(user.createdAt)}</span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        {/* Reset password */}
                        {!isSelf && !isDefaultAdmin && (
                          resetTarget === user.email ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={resetPass}
                                onChange={(e) => setResetPass(e.target.value)}
                                placeholder="New password"
                                className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                autoFocus
                              />
                              <button
                                onClick={handleResetPassword}
                                disabled={resetLoading || resetPass.length < 6}
                                className="px-2 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition"
                              >
                                {resetLoading ? '…' : '✓'}
                              </button>
                              <button onClick={() => { setResetTarget(null); setResetPass(''); }} className="px-2 py-1 bg-gray-200 text-gray-700 rounded-lg text-xs">✕</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setResetTarget(user.email); setResetPass(''); }}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition"
                            >
                              🔑 Reset PW
                            </button>
                          )
                        )}

                        {!isAdmin && !isSelf && (
                          <button
                            onClick={() => handleToggleSub(user)}
                            disabled={isLoadingThis}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all disabled:opacity-50 ${
                              subscribed
                                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            {isLoadingThis
                              ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                              : subscribed ? '🔒 Revoke' : '✅ Subscribe'}
                          </button>
                        )}

                        {!isSelf && !isDefaultAdmin && (
                          <button onClick={() => handleToggleRole(user)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                              isAdmin
                                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                            }`}>
                            {isAdmin ? '⬇️ Demote' : '⬆️ Admin'}
                          </button>
                        )}

                        {!isSelf && !isDefaultAdmin && (
                          confirmDelete === user.id ? (
                            <div className="flex gap-1">
                              <button onClick={() => handleDelete(user.id)} className="px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition">Confirm</button>
                              <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDelete(user.id)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition">
                              🗑️
                            </button>
                          )
                        )}

                        {(isSelf || isDefaultAdmin) && (
                          <span className="text-xs text-gray-300 italic">Protected</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100 px-5 py-3 bg-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-400">Showing {filtered.length} of {users.length} users</span>
          <span className="text-xs text-gray-400">🔒 Protected accounts cannot be modified</span>
        </div>
      </div>
    </div>
  );
}
