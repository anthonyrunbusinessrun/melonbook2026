'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, ArrowLeftRight, Users,
  RefreshCw, Settings, ChevronLeft, ChevronRight,
  Truck, Package, AlertTriangle, Database, Moon, Sun,
} from 'lucide-react';

const nav = [
  { href: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard',      group: 'main' },
  { href: '/ar-report',    icon: FileText,         label: 'AR Report',      group: 'main' },
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
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const stored = window.localStorage.getItem('melonops-theme') as 'dark' | 'light' | null;
    const initial = stored || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    setTheme(initial);
    document.documentElement.classList.toggle('light', initial === 'light');
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    window.localStorage.setItem('melonops-theme', next);
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
              <div className="font-display text-brand-cream text-sm font-semibold leading-tight">MelonOps</div>
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
              {nav.filter(n => n.group === group).map(item => {
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
        <div className={`p-2 border-t border-brand-green/20 flex ${collapsed ? 'flex-col items-center gap-2' : 'items-center justify-between'}`}>
          {!collapsed && (
            <div className="text-xs text-brand-warm/40 px-2">
              <div>v1.0.0</div>
            </div>
          )}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded text-brand-sage/60 hover:text-brand-cream hover:bg-brand-green/20 transition-colors"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded text-brand-sage/50 hover:text-brand-cream hover:bg-brand-green/20 transition-colors"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
