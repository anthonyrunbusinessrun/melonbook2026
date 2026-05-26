'use client';

import { useMemo, useState } from 'react';
import { CheckCircle, Loader2, Plus, Save, Trash2, UserRoundPlus, XCircle } from 'lucide-react';

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at?: string | null;
};

const roles = [
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'sales_logistics', label: 'Sales / Logistics' },
  { value: 'readonly', label: 'Read-only' },
];

const initialForm = {
  name: '',
  email: '',
  role: 'user',
  password: '',
};

function cloneUsers(users: AdminUserRow[]) {
  return users.map(user => ({ ...user, password: '' }));
}

function fmtDate(value: string | null | undefined) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

export function AdminUsersPanel({
  initialUsers,
  currentUserId,
}: {
  initialUsers: AdminUserRow[];
  currentUserId?: string;
}) {
  const [users, setUsers] = useState(() => cloneUsers(initialUsers));
  const [form, setForm] = useState(initialForm);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const activeCount = useMemo(() => users.filter(user => user.is_active).length, [users]);

  async function refreshUsers() {
    const response = await fetch('/api/admin/users', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not refresh users');
    setUsers(cloneUsers(data.users || []));
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create user');
      setForm(initialForm);
      await refreshUsers();
      setMessage('User created.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function saveUser(user: AdminUserRow & { password?: string }) {
    setBusyId(user.id);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.is_active,
          password: user.password || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update user');
      await refreshUsers();
      setMessage('User updated.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteUser(user: AdminUserRow) {
    if (!confirm(`Delete login access for ${user.email}? This deactivates the account and preserves audit history.`)) return;
    setBusyId(user.id);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not delete user');
      await refreshUsers();
      setMessage('User login deleted/deactivated.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  function updateUser(id: string, patch: Partial<AdminUserRow & { password: string }>) {
    setUsers(prev => prev.map(user => user.id === id ? { ...user, ...patch } : user));
  }

  return (
    <div className="space-y-4">
      <form onSubmit={createUser} className="card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <UserRoundPlus size={14} className="text-brand-sage" />
            <h2 className="text-sm font-semibold text-brand-cream">Create Staff Login</h2>
          </div>
          <span className="badge-green">{activeCount} active</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <label className="block">
            <span className="label block mb-1.5">Name</span>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input h-9" required />
          </label>
          <label className="block md:col-span-2">
            <span className="label block mb-1.5">Email</span>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input h-9" required />
          </label>
          <label className="block">
            <span className="label block mb-1.5">Role</span>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="select h-9">
              {roles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label block mb-1.5">Temporary Password</span>
            <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="input h-9" required minLength={10} />
          </label>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={creating} className="btn-gold flex items-center gap-1.5">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create User
          </button>
        </div>
      </form>

      {message && <div className="rounded border border-brand-sage/30 bg-brand-green/10 px-3 py-2 text-xs text-brand-sage">{message}</div>}
      {error && <div className="rounded border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-xs text-brand-brightred">{error}</div>}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-brand-green/20 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-brand-cream">Staff Users</h2>
          <span className="badge-gray">{users.length} users</span>
        </div>
        <div className="overflow-x-auto">
          <table className="ops-table min-w-[1100px]">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>New Password</th>
                <th>Last Login</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const isSelf = user.id === currentUserId;
                const busy = busyId === user.id;
                return (
                  <tr key={user.id}>
                    <td>
                      <input
                        value={user.name}
                        onChange={e => updateUser(user.id, { name: e.target.value })}
                        className="input h-8 min-w-44 text-xs"
                      />
                    </td>
                    <td>
                      <input
                        type="email"
                        value={user.email}
                        onChange={e => updateUser(user.id, { email: e.target.value })}
                        className="input h-8 min-w-64 text-xs font-mono"
                      />
                    </td>
                    <td>
                      <select
                        value={user.role}
                        disabled={isSelf}
                        onChange={e => updateUser(user.id, { role: e.target.value })}
                        className="select h-8 min-w-36 text-xs"
                        title={isSelf ? 'You cannot change your own admin role' : undefined}
                      >
                        {roles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <label className="inline-flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={user.is_active}
                          disabled={isSelf}
                          onChange={e => updateUser(user.id, { is_active: e.target.checked })}
                        />
                        {user.is_active ? (
                          <span className="flex items-center gap-1 text-brand-sage"><CheckCircle size={11} /> Active</span>
                        ) : (
                          <span className="flex items-center gap-1 text-brand-brightred"><XCircle size={11} /> Inactive</span>
                        )}
                      </label>
                    </td>
                    <td>
                      <input
                        type="password"
                        value={(user as AdminUserRow & { password?: string }).password || ''}
                        onChange={e => updateUser(user.id, { password: e.target.value } as Partial<AdminUserRow & { password: string }>)}
                        placeholder="Leave unchanged"
                        minLength={10}
                        className="input h-8 min-w-40 text-xs"
                      />
                    </td>
                    <td className="text-brand-warm/50 whitespace-nowrap">{fmtDate(user.last_login_at)}</td>
                    <td className="text-brand-warm/40 whitespace-nowrap">{new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => saveUser(user as AdminUserRow & { password?: string })} disabled={busy} className="btn-secondary h-8 px-2 inline-flex items-center gap-1 text-xs">
                          {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                          Save
                        </button>
                        <button
                          onClick={() => deleteUser(user)}
                          disabled={busy || isSelf}
                          className="h-8 px-2 rounded border border-brand-red/30 text-brand-brightred hover:bg-brand-red/10 disabled:opacity-40 inline-flex items-center gap-1 text-xs"
                          title={isSelf ? 'You cannot delete your own admin account' : 'Delete login access'}
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-brand-green/10 text-xs text-brand-sage/50">
          Delete deactivates the login so audit history and AR entry ownership remain intact.
        </div>
      </div>
    </div>
  );
}
