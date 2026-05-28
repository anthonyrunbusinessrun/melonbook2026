'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { BrandLogo } from '@/components/BrandLogo';
import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  Building2,
  ChevronLeft,
  ChevronRight,
  Database,
  FilePlus2,
  FileText,
  Gauge,
  Layout,
  LayoutDashboard,
  Layers,
  LogOut,
  Moon,
  Package,
  PlusCircle,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  ShoppingCart,
  Sun,
  Truck,
  UserRoundCheck,
  Users,
  Zap,
} from 'lucide-react';

const nav = [
  { href: '/dashboard',     icon: LayoutDashboard, label: 'Business Overview', group: 'overview' },
  { href: '/ar-input',      icon: FilePlus2,       label: 'Create AR Entry',   group: 'moneyIn', primary: true },
  { href: '/ar-report',     icon: FileText,        label: 'AR & Statements',   group: 'moneyIn' },
  { href: '/transactions',  icon: ArrowLeftRight,  label: 'Transactions',      group: 'moneyIn' },
  { href: '/customers',     icon: Building2,       label: 'Customers',         group: 'moneyIn' },
  { href: '/vouchers',      icon: Receipt,         label: 'Vouchers',          group: 'moneyOut' },
  { href: '/accounts',      icon: BarChart3,       label: 'Chart of Accounts', group: 'moneyOut' },
  { href: '/contacts',      icon: Users,           label: 'Contacts',          group: 'moneyOut' },
  { href: '/inventory',     icon: Package,         label: 'Inventory',         group: 'operations' },
  { href: '/items',         icon: ShoppingCart,    label: 'Items',             group: 'operations' },
  { href: '/loads',         icon: Truck,           label: 'Loads / Folios',    group: 'operations' },
  { href: '/batches',       icon: Layers,          label: 'Batches',           group: 'operations' },
  { href: '/forms-list',    icon: Layout,          label: 'Forms',             group: 'operations' },
  { href: '/encoder',       icon: Zap,             label: 'Encoder Station',   group: 'tools' },
  { href: '/data-explorer', icon: Database,        label: 'All Airtable Tables', group: 'tools' },
  { href: '/anomalies',     icon: AlertTriangle,   label: 'Review Flags',      group: 'tools' },
  { href: '/sync',          icon: RefreshCw,       label: 'Sync Center',       group: 'system' },
  { href: '/admin',         icon: Settings,        label: 'Users & Admin',     group: 'system' },
];

const GROUP_LABELS: Record<string, string> = {
  overview: 'Home',
  moneyIn: 'Money in',
  moneyOut: 'Money out',
  operations: 'Farm operations',
  tools: 'Work tools',
  system: 'Company settings',
};

const GROUP_ORDER = ['overview', 'moneyIn', 'moneyOut', 'operations', 'tools', 'system'];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = String((session?.user as { role?: string } | undefined)?.role || 'user');
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('light');

  useEffect(() => {
    const saved = window.localStorage.getItem('melonbook-theme') as 'dark' | 'light' | null;
    const initial = saved || 'light';

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
    <div className="accounting-shell flex h-screen overflow-hidden bg-brand-dark" data-theme={theme}>
      <aside
        className={`accounting-sidebar flex flex-col border-r border-brand-green/20 bg-brand-forest shrink-0 transition-all duration-200 ${
          collapsed ? 'w-14' : 'w-64'
        }`}
      >
        <div className={`flex items-center gap-2.5 px-3 py-3 border-b border-brand-green/20 ${collapsed ? 'justify-center' : ''}`}>
          {collapsed ? (
            <BrandLogo className="h-7 w-9 shrink-0" />
          ) : (
            <div className="min-w-0">
              <BrandLogo className="h-10 w-44 shrink-0" priority />
              <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-brand-sage/55">
                <Gauge size={11} />
                Accounting workspace
              </div>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="px-3 py-3 border-b border-brand-green/20">
            <Link href="/ar-input" className="create-button flex w-full items-center justify-center gap-2">
              <PlusCircle size={15} />
              New transaction
            </Link>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {GROUP_ORDER.map(group => (
            <div key={group} className="nav-section">
              {!collapsed && (
                <div className="nav-group-label">
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
                    {!collapsed && item.primary && (
                      <span className="ml-auto rounded bg-brand-gold/20 px-1.5 py-0.5 text-[9px] font-semibold text-brand-gold">FAST</span>
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
        <header className="accounting-topbar h-14 shrink-0 border-b border-brand-green/20 bg-brand-forest/80 px-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <details className="quick-create relative shrink-0">
              <summary className="create-button flex cursor-pointer list-none items-center gap-2 px-3">
                <PlusCircle size={15} />
                New
              </summary>
              <div className="quick-create-menu">
                <Link href="/ar-input" className="quick-create-item">
                  <FilePlus2 size={14} />
                  AR entry
                </Link>
                <Link href="/encoder" className="quick-create-item">
                  <Zap size={14} />
                  Guided encoder
                </Link>
                <Link href="/vouchers" className="quick-create-item">
                  <Receipt size={14} />
                  Voucher
                </Link>
                <Link href="/data-explorer" className="quick-create-item">
                  <Database size={14} />
                  Airtable table record
                </Link>
              </div>
            </details>

            <form action="/data-explorer" className="quick-search hidden md:flex">
              <Search size={15} className="text-brand-sage/65" />
              <input
                name="q"
                aria-label="Search MelonBook"
                placeholder="Search customers, lots, transactions, vouchers..."
                className="min-w-0 flex-1 bg-transparent text-sm text-brand-cream outline-none placeholder:text-brand-sage/35"
              />
            </form>

            <div className="hidden xl:flex items-center gap-2">
              <Link href="/transactions" className="topbar-link">
                <ArrowLeftRight size={13} />
                Transactions
              </Link>
              <Link href="/ar-report" className="topbar-link">
                <FileText size={13} />
                Reports
              </Link>
              <Link href="/sync" className="topbar-link">
                <RefreshCw size={13} />
                Sync
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs shrink-0">
            <Link href="/sync" className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-brand-green/25 bg-brand-dark/35 px-2.5 py-1.5 text-brand-sage">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-sage sync-pulse" />
              Live sync
            </Link>
            <span className="hidden md:inline text-brand-sage/55 truncate max-w-56">{session?.user?.email || 'Staff user'}</span>
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
        <div className="app-workspace flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
