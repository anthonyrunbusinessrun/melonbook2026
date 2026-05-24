'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, ArrowLeftRight, Users, RefreshCw, Settings,
  ChevronLeft, ChevronRight, Truck, Package, AlertTriangle, Database,
  Sun, Moon, BookOpen, Zap, Receipt, Layers, ShoppingCart, Paperclip, Layout,
  BarChart3,
} from 'lucide-react';

const nav = [
  // Accounting
  { href: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard',       group: 'accounting' },
  { href: '/ar-report',      icon: FileText,         label: 'AR Report',       group: 'accounting' },
  { href: '/transactions',   icon: ArrowLeftRight,   label: 'Transactions',    group: 'accounting' },
  { href: '/accounts',       icon: BarChart3,        label: 'Accounts',        group: 'accounting' },
  { href: '/vouchers',       icon: Receipt,          label: 'Vouchers',        group: 'accounting' },
  // Operations
  { href: '/contacts',       icon: Users,            label: 'Contacts',        group: 'ops' },
  { href: '/loads',          icon: Truck,            label: 'Loads / Folios',  group: 'ops' },
  { href: '/batches',        icon: Layers,           label: 'Batches',         group: 'ops' },
  { href: '/items',          icon: ShoppingCart,     label: 'Items',           group: 'ops' },
  { href: '/forms-list',     icon: Layout,           label: 'Forms',           group: 'ops' },
  // Tools
  { href: '/encoder',        icon: Zap,              label: 'Encoder Station', group: 'tools' },
  { href: '/data-explorer',  icon: Database,         label: 'Data Explorer',   group: 'tools' },
  { href: '/melonbook',      icon: BookOpen,         label: 'Melonbook™',      group: 'tools' },
  { href: '/anomalies',      icon: AlertTriangle,    label: 'Anomalies',       group: 'tools' },
  // System
  { href: '/sync',           icon: RefreshCw,        label: 'Sync Center',     group: 'system' },
  { href: '/admin',          icon: Settings,         label: 'Admin',           group: 'system' },
];

const GROUP_LABELS: Record<string, string> = {
  accounting: 'Accounting',
  ops: 'Operations',
  tools: 'Tools',
  system: 'System',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('melonops-theme') as 'dark' | 'light' | null;
    const preferred = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    const initial = saved || preferred;
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('melonops-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <div className={`flex h-screen overflow-hidden bg-brand-dark`} data-theme={theme}>
      <aside className={`flex flex-col border-r border-brand-green/20 bg-brand-forest shrink-0 transition-all duration-200 ${collapsed ? 'w-14' : 'w-56'}`}>
        {/* Logo */}
        <div className={`flex items-center gap-2.5 px-3 py-4 border-b border-brand-green/20 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 bg-brand-midgreen rounded flex items-center justify-center shrink-0">
            <span className="font-bold text-sm">🍉</span>
          </div>
          {!collapsed && (
            <div>
              <div className="font-display text-brand-cream text-sm font-semibold leading-tight">MelonOps</div>
              <div className="text-brand-sage/50 text-xs">Raymon J Land</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {['accounting', 'ops', 'tools', 'system'].map(group => (
            <div key={group}>
              {!collapsed && (
                <div className="text-[10px] font-semibold text-brand-sage/40 uppercase tracking-widest px-2 pt-3 pb-1">
                  {GROUP_LABELS[group]}
                </div>
              )}
              {nav.filter(n => n.group === group).map(item => {
                const active = pathname.startsWith(item.href) && item.href !== '/';
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-link ${active ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon size={15} className={active ? 'text-brand-sage' : ''} />
                    {!collapsed && <span>{item.label}</span>}
                    {!collapsed && item.href === '/encoder' && (
                      <span className="ml-auto text-[9px] bg-brand-gold/20 text-brand-gold px-1 rounded">NEW</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className={`p-2 border-t border-brand-green/20 flex ${collapsed ? 'flex-col items-center gap-2' : 'items-center justify-between'}`}>
          {!collapsed && <div className="text-xs text-brand-warm/40 px-2">v2.0.0</div>}
          <div className={`flex ${collapsed ? 'flex-col' : 'flex-row'} gap-1`}>
            <button onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="p-1.5 rounded text-brand-sage/50 hover:text-brand-cream hover:bg-brand-green/20 transition-colors">
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded text-brand-sage/50 hover:text-brand-cream hover:bg-brand-green/20 transition-colors">
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
