export const dynamic = "force-dynamic";
import { getServerSession } from 'next-auth';
import { query } from '@/db';
import { Shield, Activity, Clock } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import { AdminUsersPanel, type AdminUserRow } from './AdminUsersPanel';

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string } | undefined;

  const [users, auditLog, syncStats] = await Promise.allSettled([
    query<{
      id: string; email: string; name: string; role: string;
      is_active: boolean; last_login_at: string | null; created_at: string; updated_at: string | null;
    }>('SELECT id, email, name, role, is_active, last_login_at, created_at, updated_at FROM app_users ORDER BY created_at'),

    query<{
      user_email: string; action: string; table_name: string;
      created_at: string;
    }>('SELECT user_email, action, table_name, created_at FROM audit_log ORDER BY created_at DESC LIMIT 25'),

    query<{ table_name: string; direction: string; count: number; last_run: string }>(
      `SELECT table_name, direction, COUNT(*) as count, MAX(started_at) as last_run
       FROM sync_runs GROUP BY table_name, direction ORDER BY last_run DESC`
    ),
  ]);

  const appUsers = users.status === 'fulfilled' ? users.value : [];
  const logs = auditLog.status === 'fulfilled' ? auditLog.value : [];
  const stats = syncStats.status === 'fulfilled' ? syncStats.value : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-brand-cream">Admin</h1>
        <p className="text-brand-sage/60 text-sm">User management, audit log, system health</p>
      </div>

      <AdminUsersPanel initialUsers={appUsers as AdminUserRow[]} currentUserId={sessionUser?.id} />

      {/* System info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={14} className="text-brand-sage" />
            <h3 className="text-sm font-semibold text-brand-cream">System Configuration</h3>
          </div>
          <div className="space-y-2 text-xs">
            {[
              { label: 'App', value: 'MelonBook v1.0.0' },
              { label: 'Airtable Base', value: 'appmnU55C5f7A50U4' },
              { label: 'Environment', value: process.env.NODE_ENV || 'unknown' },
              { label: 'Database', value: process.env.DATABASE_URL ? '✓ Configured' : '✗ Missing' },
              { label: 'Airtable API', value: process.env.AIRTABLE_API_KEY ? '✓ Configured' : '✗ Missing — set AIRTABLE_API_KEY' },
              { label: 'NextAuth Secret', value: process.env.NEXTAUTH_SECRET ? '✓ Configured' : '✗ Missing' },
              { label: 'Webhook Secret', value: process.env.AIRTABLE_WEBHOOK_SECRET ? '✓ Configured' : '⚠ Optional, unset' },
            ].map(row => (
              <div key={row.label} className="flex justify-between border-b border-brand-green/10 pb-1.5">
                <span className="text-brand-sage/60">{row.label}</span>
                <span className={`font-mono ${row.value.startsWith('✗') ? 'text-brand-brightred' : row.value.startsWith('⚠') ? 'text-brand-gold' : 'text-brand-warm/70'}`}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={14} className="text-brand-sage" />
            <h3 className="text-sm font-semibold text-brand-cream">Sync Statistics</h3>
          </div>
          {stats.length === 0 ? (
            <div className="text-xs text-brand-sage/40 py-4 text-center">No sync runs yet</div>
          ) : (
            <div className="space-y-1.5 text-xs">
              {stats.slice(0, 8).map((s, i) => (
                <div key={i} className="flex justify-between border-b border-brand-green/10 pb-1.5">
                  <span className="text-brand-sage/60">{s.table_name || 'all'} ({s.direction})</span>
                  <span className="text-brand-warm/70">
                    {Number(s.count)} runs · {s.last_run ? new Date(s.last_run).toLocaleDateString() : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Audit log */}
      <div className="card">
        <div className="px-4 py-3 border-b border-brand-green/20 flex items-center gap-2">
          <Clock size={14} className="text-brand-sage" />
          <h2 className="text-sm font-semibold text-brand-cream">Recent Audit Log</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Table</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-brand-sage/40">No audit entries yet</td></tr>
              ) : (
                logs.map((l, i) => (
                  <tr key={i}>
                    <td className="text-brand-warm/50">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="font-mono text-brand-sage/80">{l.user_email}</td>
                    <td className="text-brand-warm/70">{l.action}</td>
                    <td className="text-brand-warm/50">{l.table_name}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deployment instructions */}
      <div className="card p-4 border-brand-gold/20">
        <h3 className="text-sm font-semibold text-brand-gold mb-3">Railway Deployment Checklist</h3>
        <div className="grid grid-cols-2 gap-4 text-xs text-brand-warm/60">
          <div>
            <div className="text-brand-sage font-medium mb-2">Required Environment Variables</div>
            <ul className="space-y-1 font-mono">
              <li>DATABASE_URL</li>
              <li>AIRTABLE_API_KEY</li>
              <li>AIRTABLE_BASE_ID=appmnU55C5f7A50U4</li>
              <li>NEXTAUTH_SECRET (generate w/ openssl rand -base64 32)</li>
              <li>NEXTAUTH_URL (your Railway URL)</li>
            </ul>
          </div>
          <div>
            <div className="text-brand-sage font-medium mb-2">Setup Commands</div>
            <ul className="space-y-1 font-mono">
              <li>npm run db:migrate</li>
              <li>npm run db:seed</li>
              <li>npm run build</li>
              <li>npm run start</li>
              <li># Worker: node worker/index.js</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
