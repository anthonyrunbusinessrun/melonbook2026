'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Database,
  FilePlus2,
  FileText,
  Layout,
  LayoutDashboard,
  Layers,
  LogOut,
  Moon,
  Package,
  Receipt,
  RefreshCw,
  Settings,
  ShoppingCart,
  Sun,
  Truck,
  UserRoundCheck,
  Users,
  Zap,
} from 'lucide-react';

const nav = [
  { href: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard',       group: 'accounting' },
  { href: '/ar-report',     icon: FileText,        label: 'AR Report',       group: 'accounting' },
  { href: '/ar-input',      icon: FilePlus2,       label: 'AR Input',        group: 'accounting' },
  { href: '/transactions',  icon: ArrowLeftRight,  label: 'Transactions',    group: 'accounting' },
  { href: '/accounts',      icon: BarChart3,       label: 'Accounts',        group: 'accounting' },
  { href: '/vouchers',      icon: Receipt,         label: 'Vouchers',        group: 'accounting' },
  { href: '/contacts',      icon: Users,           label: 'Contacts',        group: 'ops' },
  { href: '/loads',         icon: Truck,           label: 'Loads / Folios',  group: 'ops' },
  { href: '/batches',       icon: Layers,          label: 'Batches',         group: 'ops' },
  { href: '/inventory',     icon: Package,         label: 'Inventory',       group: 'ops' },
  { href: '/items',         icon: ShoppingCart,    label: 'Items',           group: 'ops' },
  { href: '/forms-list',    icon: Layout,          label: 'Forms',           group: 'ops' },
  { href: '/encoder',       icon: Zap,             label: 'Encoder Station', group: 'tools' },
  { href: '/data-explorer', icon: Database,        label: 'Airtable Grid',   group: 'tools' },
  { href: '/anomalies',     icon: AlertTriangle,   label: 'Anomalies',       group: 'tools' },
  { href: '/sync',          icon: RefreshCw,       label: 'Sync Center',     group: 'system' },
  { href: '/admin',         icon: Settings,        label: 'Admin',           group: 'system' },
];

const GROUP_LABELS: Record<string, string> = {
  accounting: 'Accounting',
  ops: 'Operations',
  tools: 'Tools',
  system: 'System',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = String((session?.user as { role?: string } | undefined)?.role || 'user');
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = window.localStorage.getItem('melonbook-theme') as 'dark' | 'light' | null;
    const preferred = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    const initial = saved || preferred;

    setTheme(initial);
    document.documentElement.classList.toggle('light', initial === 'light');
    document.documentElement.setAttribute('data-theme', initial);
    window.localStorage.setItem('melonbook-theme', initial);
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    window.localStorage.setItem('melonbook-theme', next);
    document.documentElement.classList.toggle('light', next === 'light');
    document.documentElement.setAttribute('data-theme', next);
  }

  const visibleNav = nav.filter(item => role === 'admin' || item.href !== '/admin');

  return (
    <div className="flex h-screen overflow-hidden bg-brand-dark" data-theme={theme}>
      <aside
        className={`flex flex-col border-r border-brand-green/20 bg-brand-forest shrink-0 transition-all duration-200 ${
          collapsed ? 'w-14' : 'w-64'
        }`}
      >
        <div className={`flex items-center gap-2.5 px-3 py-4 border-b border-brand-green/20 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 bg-brand-midgreen rounded flex items-center justify-center shrink-0">
            <span className="font-bold text-sm">🍉</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display text-brand-cream text-sm font-semibold leading-tight">MelonBook</div>
              <div className="text-brand-sage/50 text-xs">Raymon J Land</div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {['accounting', 'ops', 'tools', 'system'].map(group => (
            <div key={group}>
              {!collapsed && (
                <div className="text-[10px] font-semibold text-brand-sage/40 uppercase tracking-widest px-2 pt-3 pb-1">
                  {GROUP_LABELS[group]}
                </div>
              )}
              {visibleNav.filter(item => item.group === group).map(item => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-link ${active ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon size={15} className={active ? 'text-brand-sage' : ''} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && item.href === '/encoder' && (
                      <span className="ml-auto text-[9px] bg-brand-gold/20 text-brand-gold px-1 rounded">NEW</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={`shrink-0 p-2 border-t border-brand-green/20 space-y-2 ${collapsed ? 'flex flex-col items-center' : ''}`}>
          {!collapsed && (
            <div className="px-2">
              <div className="flex items-center gap-2 text-xs text-brand-warm/70">
                <UserRoundCheck size={13} className="text-brand-sage shrink-0" />
                <span className="truncate">{session?.user?.email || 'Staff user'}</span>
              </div>
              <div className="text-[10px] text-brand-sage/45 mt-0.5 capitalize">
                {role.replace(/_/g, ' ')} · v2.1.0
              </div>
            </div>
          )}
          <div className={`flex ${collapsed ? 'flex-col' : 'items-center justify-between'} gap-1`}>
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded text-brand-sage/60 hover:text-brand-cream hover:bg-brand-green/20 transition-colors"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              onClick={() => signOut({ callbackUrl: '/login?switch=1' })}
              className={`rounded text-brand-sage/60 hover:text-brand-cream hover:bg-brand-green/20 transition-colors ${
                collapsed ? 'p-1.5' : 'px-2 py-1.5 text-xs flex items-center gap-1'
              }`}
              title="Switch account"
            >
              <UserRoundCheck size={14} />
              {!collapsed && <span>Switch</span>}
            </button>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className={`rounded text-brand-sage/60 hover:text-brand-brightred hover:bg-brand-red/10 transition-colors ${
                collapsed ? 'p-1.5' : 'px-2 py-1.5 text-xs flex items-center gap-1'
              }`}
              title="Logout"
            >
              <LogOut size={14} />
              {!collapsed && <span>Logout</span>}
            </button>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded text-brand-sage/50 hover:text-brand-cream hover:bg-brand-green/20 transition-colors"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
        <header className="h-12 shrink-0 border-b border-brand-green/20 bg-brand-forest/80 px-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/ar-input" className="btn-gold h-8 px-3 text-xs inline-flex items-center gap-1.5">
              <FilePlus2 size={13} />
              AR Input
            </Link>
            <Link href="/data-explorer" className="btn-secondary h-8 px-3 text-xs inline-flex items-center gap-1.5">
              <Database size={13} />
              Airtable Grid
            </Link>
            <Link href="/encoder" className="btn-secondary h-8 px-3 text-xs inline-flex items-center gap-1.5">
              <Zap size={13} />
              Encoder Station
            </Link>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="hidden md:inline text-brand-sage/55 truncate max-w-64">{session?.user?.email || 'Staff user'}</span>
            <button
              onClick={toggleTheme}
              className="btn-secondary h-8 px-2 inline-flex items-center"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            </button>
            <button onClick={() => signOut({ callbackUrl: '/login?switch=1' })} className="btn-secondary h-8 px-3 inline-flex items-center gap-1.5">
              <UserRoundCheck size={13} />
              Switch
            </button>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="btn-secondary h-8 px-3 inline-flex items-center gap-1.5">
              <LogOut size={13} />
              Logout
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
