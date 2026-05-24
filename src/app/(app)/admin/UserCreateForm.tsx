'use client';

import { useState } from 'react';
import { Loader2, Plus, UserRoundPlus } from 'lucide-react';

const initialForm = {
  name: '',
  email: '',
  role: 'user',
  password: '',
};

export function UserCreateForm() {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create user');
      setMessage('User created. Refresh the page to see them in the staff list.');
      setForm(initialForm);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <UserRoundPlus size={14} className="text-brand-sage" />
        <h2 className="text-sm font-semibold text-brand-cream">Create Staff Login</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="block">
          <span className="label block mb-1.5">Name</span>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input h-9" required />
        </label>
        <label className="block">
          <span className="label block mb-1.5">Email</span>
          <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input h-9" required />
        </label>
        <label className="block">
          <span className="label block mb-1.5">Role</span>
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="select h-9">
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label className="block">
          <span className="label block mb-1.5">Temporary Password</span>
          <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="input h-9" required minLength={10} />
        </label>
      </div>
      {message && <div className="rounded border border-brand-sage/30 bg-brand-green/10 px-3 py-2 text-xs text-brand-sage">{message}</div>}
      {error && <div className="rounded border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-xs text-brand-brightred">{error}</div>}
      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="btn-gold flex items-center gap-1.5">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Create User
        </button>
      </div>
    </form>
  );
}
