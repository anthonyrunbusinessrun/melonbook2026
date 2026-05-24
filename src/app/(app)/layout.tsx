'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard, FileText, ArrowLeftRight, Users,
  RefreshCw, Settings, ChevronLeft, ChevronRight,
  Truck, Package, AlertTriangle, Database, Moon, Sun,
  LogOut, UserRoundCheck, FilePlus2,
} from 'lucide-react';

const nav = [
  { href: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard',      group: 'main' },
  { href: '/ar-report',    icon: FileText,         label: 'AR Report',      group: 'main' },
  { href: '/ar-input',     icon: FilePlus2,        label: 'AR Input',       group: 'main' },
  { href: '/transactions', icon: ArrowLeftRight,   label: 'Transactions',   group: 'main' },
  { href: '/customers',    icon: Users,            label: 'Customers',      group: 'main' },
  { href: '/data-explorer', icon: Database,        label: 'Data Explorer',  group: 'main' },
  { href: '/loads',        icon: Truck,            label: 'Loads / Folios', group: 'ops'  },
  { href: '/products',     icon: Package,          label: 'Products',       group: 'ops'  },
  { href: '/anomalies',    icon: AlertTriangle,    label: 'Anomalies',      group: 'ops'  },
  { href: '/sync',         icon: RefreshCw,        label: 'Sync Center',    group: 'admin'},
  { href: '/admin',        icon: Settings,         label: 'Admin',          group: 'admin'},
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = String((session?.user as { role?: string } | undefined)?.role || 'user');
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const stored = window.localStorage.getItem('melonbook-theme') as 'dark' | 'light' | null;
    const initial = stored || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    setTheme(initial);
    document.documentElement.classList.toggle('light', initial === 'light');
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    window.localStorage.setItem('melonbook-theme', next);
    document.documentElement.classList.toggle('light', next === 'light');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-brand-dark">
      {/* Sidebar */}
      <aside className={`
        flex flex-col border-r border-brand-green/20 bg-brand-forest shrink-0
        transition-all duration-200
        ${collapsed ? 'w-14' : 'w-56'}
      `}>
        {/* Logo */}
        <div className={`flex items-center gap-2.5 px-3 py-4 border-b border-brand-green/20 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 bg-brand-midgreen rounded flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">🍉</span>
          </div>
          {!collapsed && (
            <div>
              <div className="font-display text-brand-cream text-sm font-semibold leading-tight">MelonBook</div>
              <div className="text-brand-sage/50 text-xs">Raymon J Land</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {['main', 'ops', 'admin'].map(group => (
            <div key={group}>
              {!collapsed && (
                <div className="text-[10px] font-semibold text-brand-sage/40 uppercase tracking-widest px-2 pt-3 pb-1">
                  {group === 'main' ? 'Accounting' : group === 'ops' ? 'Operations' : 'System'}
                </div>
              )}
              {nav.filter(n => n.group === group && (role === 'admin' || n.href !== '/admin')).map(item => {
                const active = pathname.startsWith(`/${item.href.slice(1)}`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-link ${active ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon size={15} className={active ? 'text-brand-sage' : ''} />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className={`p-2 border-t border-brand-green/20 space-y-2 ${collapsed ? 'flex flex-col items-center' : ''}`}>
          {!collapsed && (
            <div className="px-2">
              <div className="flex items-center gap-2 text-xs text-brand-warm/70">
                <UserRoundCheck size={13} className="text-brand-sage" />
                <span className="truncate">{session?.user?.email || 'Staff user'}</span>
              </div>
              <div className="text-[10px] text-brand-sage/45 mt-0.5 capitalize">
                {role.replace(/_/g, ' ')}
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
              className={`rounded text-brand-sage/60 hover:text-brand-cream hover:bg-brand-green/20 transition-colors ${collapsed ? 'p-1.5' : 'px-2 py-1.5 text-xs flex items-center gap-1'}`}
              title="Switch account"
            >
              <UserRoundCheck size={14} />
              {!collapsed && <span>Switch</span>}
            </button>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className={`rounded text-brand-sage/60 hover:text-brand-brightred hover:bg-brand-red/10 transition-colors ${collapsed ? 'p-1.5' : 'px-2 py-1.5 text-xs flex items-center gap-1'}`}
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

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
