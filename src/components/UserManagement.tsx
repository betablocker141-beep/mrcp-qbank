import { useState, useEffect } from 'react';
import { getAllUsers, deleteUser, updateUserRole } from '../authStore';
import { User, UserRole } from '../types';
import { getSession } from '../authStore';

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function avatarColor(name: string) {
  const colors = [
    'from-blue-500 to-indigo-500',
    'from-emerald-500 to-teal-500',
    'from-amber-500 to-orange-500',
    'from-rose-500 to-pink-500',
    'from-violet-500 to-purple-500',
    'from-cyan-500 to-blue-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'student'>('all');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const currentUser = getSession();

  useEffect(() => {
    setUsers(getAllUsers());
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handlePromote = (user: User) => {
    const newRole: UserRole = user.role === 'admin' ? 'student' : 'admin';
    updateUserRole(user.id, newRole);
    setUsers(getAllUsers());
    showToast(`${user.name} is now ${newRole === 'admin' ? 'an Admin' : 'a Student'}`);
  };

  const handleDelete = (id: string) => {
    deleteUser(id);
    setUsers(getAllUsers());
    setConfirmDelete(null);
    showToast('User deleted successfully');
  };

  const filtered = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const stats = {
    total: users.length,
    admins: users.filter((u) => u.role === 'admin').length,
    students: users.filter((u) => u.role === 'student').length,
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl font-semibold text-sm flex items-center gap-2 animate-bounce">
          ✓ {toast}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Users', value: stats.total, icon: '👥', color: 'bg-blue-50 border-blue-200 text-blue-700' },
          { label: 'Admins', value: stats.admins, icon: '⚙️', color: 'bg-amber-50 border-amber-200 text-amber-700' },
          { label: 'Students', value: stats.students, icon: '🎓', color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border p-4 ${s.color} flex items-center gap-4`}>
            <span className="text-3xl">{s.icon}</span>
            <div>
              <div className="text-2xl font-extrabold">{s.value}</div>
              <div className="text-sm font-medium opacity-75">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div className="flex rounded-xl border border-gray-200 overflow-hidden">
          {(['all', 'admin', 'student'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-4 py-2.5 text-sm font-semibold capitalize transition ${
                roleFilter === r
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {r === 'all' ? '👥 All' : r === 'admin' ? '⚙️ Admins' : '🎓 Students'}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wide">
                  User
                </th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Role
                </th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wide hidden md:table-cell">
                  Joined
                </th>
                <th className="text-right px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-16 text-gray-400">
                    <div className="text-4xl mb-2">👤</div>
                    <div className="text-sm">No users found</div>
                  </td>
                </tr>
              )}
              {filtered.map((user) => {
                const isSelf = user.id === currentUser?.id;
                const isDefaultAdmin = user.email === 'admin@mrcpqbank.com';
                return (
                  <tr
                    key={user.id}
                    className={`hover:bg-gray-50 transition ${isSelf ? 'bg-indigo-50/50' : ''}`}
                  >
                    {/* User Info */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${avatarColor(user.name)} flex items-center justify-center text-white font-bold text-sm shadow`}
                        >
                          {getInitials(user.name)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 text-sm">{user.name}</span>
                            {isSelf && (
                              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                                You
                              </span>
                            )}
                            {isDefaultAdmin && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">{user.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${
                          user.role === 'admin'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {user.role === 'admin' ? '⚙️ Admin' : '🎓 Student'}
                      </span>
                    </td>

                    {/* Joined */}
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className="text-sm text-gray-400">{formatDate(user.createdAt)}</span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* Promote/Demote */}
                        {!isSelf && !isDefaultAdmin && (
                          <button
                            onClick={() => handlePromote(user)}
                            title={user.role === 'admin' ? 'Demote to Student' : 'Promote to Admin'}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                              user.role === 'admin'
                                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                            }`}
                          >
                            {user.role === 'admin' ? '⬇️ Demote' : '⬆️ Promote'}
                          </button>
                        )}

                        {/* Delete */}
                        {!isSelf && !isDefaultAdmin && (
                          confirmDelete === user.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(user.id)}
                                className="px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-300 transition"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(user.id)}
                              title="Delete user"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition"
                            >
                              🗑️ Delete
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

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-3 bg-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Showing {filtered.length} of {users.length} users
          </span>
          <span className="text-xs text-gray-400">
            🔒 Default admin & your own account are protected
          </span>
        </div>
      </div>
    </div>
  );
}
