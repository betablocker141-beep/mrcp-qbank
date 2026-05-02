import { useState, useEffect } from 'react';
import {
  getAllUsers, deleteUser, updateUserRole,
  getAllSubscriptions, setSubscription, getSession,
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

      {/* Info banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
        <span className="text-2xl">💳</span>
        <div>
          <div className="font-bold text-blue-800 text-sm">Manual Subscription Activation</div>
          <div className="text-blue-600 text-xs mt-0.5">
            Students pay <strong>$30 USD</strong> to <strong>salvahardin492@gmail.com</strong>, then you activate them here.
            Use the <strong>✅ Subscribe</strong> button to grant access, or <strong>🔒 Revoke</strong> to remove it.
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
