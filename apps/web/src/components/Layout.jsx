import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, MapPin, BarChart2, Zap,
  FileText, FolderOpen, Receipt, Battery, LogOut, ChevronRight,
  Briefcase, Target, Activity, TrendingUp, ClipboardList, Bell,
  ShieldCheck, Upload, Search, X, Sun, History,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { WavyBackground } from './ui/wavy-background.jsx';
import { Avatar, AvatarFallback } from './ui/avatar.jsx';
import { cn } from '../lib/utils.js';
import ThemeToggle from './ThemeToggle.jsx';

// ── Nav definitions ──────────────────────────────────────────────────────────

const BESS_CORE_NAV = [
  { label: 'Dashboard',         to: '/bess/dashboard',  icon: LayoutDashboard },
  { label: 'Clients',           to: '/bess/clients',    icon: Users },
  { label: 'BESS Configurator', to: '/bess/config',     icon: Zap },
  { label: 'Projects',          to: '/bess/projects',   icon: FolderOpen },
  { label: 'Proposals',         to: '/bess/proposals',  icon: FileText },
  { label: 'Tariff Structures', to: '/bess/tariffs',    icon: Receipt },
];

const BESS_BD_NAV = [
  { label: 'Clients',         to: '/bess/bd/pipeline',      icon: Users },
  { label: 'Activity Log',    to: '/bess/bd/activities',    icon: ClipboardList },
  { label: 'Follow-up Queue', to: '/bess/bd/follow-ups',    icon: Bell },
  { label: 'Approvals',       to: '/bess/bd/approvals',     icon: ShieldCheck },
  { label: 'Sheets Import',   to: '/bess/bd/import',        icon: Upload,   perm: 'import' },
  { label: 'Audit Log',       to: '/bess/bd/audit-log',     icon: History,  perm: 'audit'  },
];

const EPC_CORE_NAV = [
  { label: 'Dashboard',        to: '/epc/dashboard',  icon: LayoutDashboard },
  { label: 'Clients',          to: '/epc/clients',    icon: Users },
  { label: 'EPC Configurator', to: '/epc/config',     icon: Zap },
  { label: 'Projects',         to: '/epc/projects',   icon: FolderOpen },
  { label: 'Proposals',        to: '/epc/proposals',  icon: FileText },
  { label: 'Tariff Structures',to: '/epc/tariffs',    icon: Receipt },
];

const EPC_BD_NAV = [
  { label: 'Clients',         to: '/epc/bd/pipeline',      icon: Users },
  { label: 'Activity Log',    to: '/epc/bd/activities',    icon: ClipboardList },
  { label: 'Follow-up Queue', to: '/epc/bd/follow-ups',    icon: Bell },
  { label: 'Approvals',       to: '/epc/bd/approvals',     icon: ShieldCheck },
  { label: 'Sheets Import',   to: '/epc/bd/import',        icon: Upload,   perm: 'import' },
  { label: 'Audit Log',       to: '/epc/bd/audit-log',     icon: History,  perm: 'audit'  },
];

const ALL_PAGES = [...BESS_CORE_NAV, ...BESS_BD_NAV, ...EPC_CORE_NAV, ...EPC_BD_NAV];

// ── NavItem ───────────────────────────────────────────────────────────────────

function NavItem({ label, to, icon: Icon }) {
  return (
    <NavLink
      to={to}
      end={to === '/bess/bd' || to === '/epc/bd'}
      className={({ isActive }) => cn(
        'group flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-[12.5px] font-medium transition-all duration-150',
        isActive
          ? 'bg-[#F26B4E]/15 text-[#F26B4E] font-bold'
          : 'text-white/50 hover:text-white/90 hover:bg-white/5'
      )}
    >
      {({ isActive }) => (
        <>
          <Icon size={14} className={cn('shrink-0 transition-colors', isActive ? 'text-[#F26B4E]' : 'text-white/35 group-hover:text-white/70')} />
          <span className="truncate">{label}</span>
          {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F26B4E] shrink-0" />}
        </>
      )}
    </NavLink>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout, can } = useAuth();
  const { theme } = useTheme();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');

  // Derive active product from URL; default to 'bess'
  const activeProduct = pathname.startsWith('/epc') ? 'epc' : 'bess';

  const coreNav = activeProduct === 'epc' ? EPC_CORE_NAV : BESS_CORE_NAV;
  const bdNav   = (activeProduct === 'epc' ? EPC_BD_NAV : BESS_BD_NAV)
    .filter(item => !item.perm || can(item.perm));

  const pageTitle =
    ALL_PAGES.find(n => pathname === n.to || pathname.startsWith(n.to + '/'))?.label
    ?? (activeProduct === 'epc' ? 'Solar EPC' : 'BESS Portal');

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'KB';

  // Cmd+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(o => !o); }
      if (e.key === 'Escape') setCmdOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filteredPages = cmdQuery
    ? ALL_PAGES.filter(p => p.label.toLowerCase().includes(cmdQuery.toLowerCase()))
    : [...coreNav, ...bdNav];

  function handleProductSwitch(product) {
    if (product === activeProduct) return;
    navigate(product === 'epc' ? '/epc/dashboard' : '/bess/dashboard');
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <WavyBackground fixed={true} backgroundFill={theme === 'dark' ? '#080808' : theme === 'solar' ? '#3d2b1a' : '#1a1a1a'} waveOpacity={0.45} blur={14} speed="slow" />

      {/* Command Palette */}
      {cmdOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCmdOpen(false)} />
          <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl border border-border/60 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
              <Search size={15} className="text-muted-foreground shrink-0" />
              <input
                autoFocus
                value={cmdQuery}
                onChange={e => setCmdQuery(e.target.value)}
                placeholder="Go to page…"
                className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              />
              <button onClick={() => setCmdOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={14} />
              </button>
            </div>
            <div className="py-1.5 max-h-72 overflow-y-auto">
              {filteredPages.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">No pages found.</p>
              ) : (
                filteredPages.map(({ label, to, icon: Icon }) => (
                  <button
                    key={to}
                    onClick={() => { navigate(to); setCmdOpen(false); setCmdQuery(''); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-orange-50 hover:text-orange-600 transition-colors text-left group"
                  >
                    <Icon size={14} className="text-muted-foreground group-hover:text-orange-500" />
                    <span className="font-medium">{label}</span>
                    <ChevronRight size={12} className="ml-auto text-muted-foreground/50" />
                  </button>
                ))
              )}
            </div>
            <div className="px-4 py-2 border-t border-border/40 flex items-center gap-3 bg-muted/30">
              <kbd className="text-[10px] bg-white border border-border rounded px-1.5 py-0.5 font-mono text-muted-foreground">↑↓</kbd>
              <span className="text-[11px] text-muted-foreground">navigate</span>
              <kbd className="text-[10px] bg-white border border-border rounded px-1.5 py-0.5 font-mono text-muted-foreground ml-2">↵</kbd>
              <span className="text-[11px] text-muted-foreground">open</span>
              <kbd className="text-[10px] bg-white border border-border rounded px-1.5 py-0.5 font-mono text-muted-foreground ml-auto">esc</kbd>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative', zIndex: 1 }}>

        {/* ── Sidebar ── */}
        <aside style={{
          width: 224,
          background: 'rgba(18,18,18,0.82)',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          borderRight: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}>

          {/* Logo */}
          <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/[0.06]">
            <div style={{
              background: 'linear-gradient(135deg,#F26B4E,#e04d2e)',
              borderRadius: 10, width: 34, height: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: '0 2px 12px rgba(242,107,78,0.45)',
            }}>
              {activeProduct === 'epc'
                ? <Sun size={17} color="white" />
                : <Battery size={17} color="white" />
              }
            </div>
            <div>
              <div className="text-[13px] font-black text-white tracking-tight">
                {activeProduct === 'epc' ? 'Solar EPC' : 'UnityESS'}
              </div>
              <div className="text-[10px] text-white/35 font-medium mt-0.5">
                {activeProduct === 'epc' ? 'EPC Portal' : 'BESS Sizing Portal'}
              </div>
            </div>
          </div>

          {/* Product Switcher */}
          <div className="mx-3 my-2.5 flex rounded-lg bg-white/[0.06] border border-white/[0.08] p-0.5 gap-0.5">
            <button
              onClick={() => handleProductSwitch('bess')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-bold transition-all duration-200',
                activeProduct === 'bess'
                  ? 'bg-[#F26B4E] text-white shadow-sm'
                  : 'text-white/40 hover:text-white/70'
              )}
            >
              <Battery size={11} />
              BESS
            </button>
            <button
              onClick={() => handleProductSwitch('epc')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-bold transition-all duration-200',
                activeProduct === 'epc'
                  ? 'bg-[#F26B4E] text-white shadow-sm'
                  : 'text-white/40 hover:text-white/70'
              )}
            >
              <Sun size={11} />
              Solar EPC
            </button>
          </div>

          {/* Quick nav */}
          <button
            onClick={() => setCmdOpen(true)}
            className="mx-3 mb-1.5 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.07] text-white/40 hover:text-white/70 hover:bg-white/[0.07] transition-all text-[12px]"
          >
            <Search size={12} />
            <span className="flex-1 text-left">Quick nav…</span>
            <kbd className="text-[10px] bg-white/10 rounded px-1.5 py-0.5 font-mono">⌘K</kbd>
          </button>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto pb-2">
            <div className="px-4 pt-2 pb-1 text-[9px] text-white/25 font-bold tracking-[1.2px] uppercase">
              {activeProduct === 'epc' ? 'Solar EPC' : 'BESS Sizing'}
            </div>
            {coreNav.map(item => <NavItem key={item.to} {...item} />)}

            <div className="px-4 pt-4 pb-1 text-[9px] text-white/25 font-bold tracking-[1.2px] uppercase border-t border-white/[0.05] mt-2">
              Business Development
            </div>
            {bdNav.map(item => <NavItem key={item.to} {...item} />)}
          </nav>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-white/[0.06]">
            <div className="text-[10px] font-bold text-white/35">Ornate Solar</div>
            <div className="text-[10px] text-white/20 mt-0.5">v1.1.0 · {new Date().getFullYear()}</div>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Topbar */}
          <header style={{
            background: 'var(--topbar-bg)',
            borderBottom: '1px solid var(--topbar-border)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }} className="flex items-center justify-between px-6 h-[52px] shrink-0 shadow-sm">
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-muted-foreground text-[12px]">
                {activeProduct === 'epc' ? 'Solar EPC' : 'BESS Sizing'}
              </span>
              <ChevronRight size={11} className="text-muted-foreground/60" />
              <span className="text-foreground font-bold text-[13px]">{pageTitle}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ThemeToggle />
              <span className="text-[10px] font-bold tracking-wide bg-[#F26B4E]/10 text-[#F26B4E] border border-[#F26B4E]/20 rounded-full px-3 py-1">
                INTERNAL
              </span>
              {user && (
                <div className="flex items-center gap-2.5 pl-2 border-l border-border/50">
                  <div className="text-right">
                    <div className="text-[12px] font-bold text-foreground leading-tight">{user.name}</div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{user.role}</div>
                  </div>
                  <Avatar className="w-[30px] h-[30px] shrink-0">
                    <AvatarFallback className="text-[11px]">{initials}</AvatarFallback>
                  </Avatar>
                  <button
                    onClick={handleLogout}
                    title="Sign out"
                    className="p-1.5 rounded-lg border border-border hover:border-[#F26B4E] hover:text-[#F26B4E] text-muted-foreground transition-all"
                  >
                    <LogOut size={13} />
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* Content */}
          <main style={{
            flex: 1, overflowY: 'auto',
            padding: '24px',
            background: 'var(--main-bg)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}>
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
