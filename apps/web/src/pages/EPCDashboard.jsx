import { useRef, useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import {
  Sun, FolderOpen, TrendingUp, FileText, Users,
  ArrowUpRight, ArrowRight, Activity, Sparkles, Clock,
  Bell, ShieldCheck, AlertTriangle, ChevronRight, RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { bdApi } from '../lib/api.js';
import { useApi } from '../hooks/useApi.js';
import { inr, date, daysSince } from '../lib/fmt.js';
import { Spinner, ErrorBanner } from '../components/Spinner.jsx';
import { SplineScene } from '@/components/ui/spline-scene';
import { SpotlightSVG, Spotlight } from '@/components/ui/spotlight';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Button } from '../components/ui/button.jsx';
import { Separator } from '../components/ui/separator.jsx';
import { Skeleton } from '../components/ui/skeleton.jsx';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table.jsx';

// ─────────────────────────────────────────────────────────────────────────────
const STAGE_ORDER = ['lead','proposal','negotiation','po_received','installation','commissioned','active'];

const PIPELINE_STAGES = [
  { key: 'first_connect',          label: 'First Connect',          color: '#94a3b8' },
  { key: 'requirement_captured',   label: 'Requirement Captured',   color: '#60a5fa' },
  { key: 'proposal_sent',          label: 'Proposal Sent',          color: '#a78bfa' },
  { key: 'technical_closure',      label: 'Technical Closure',      color: '#f59e0b' },
  { key: 'commercial_negotiation', label: 'Commercial Negotiation', color: '#F26B4E' },
  { key: 'po_received',            label: 'PO Received',            color: '#10b981' },
];

const STATUS_BADGE = {
  lead:         'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/60',
  proposal:     'bg-orange-50 text-orange-500 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/60',
  negotiation:  'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60',
  po_received:  'bg-green-50 text-green-600 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900/60',
  active:       'bg-green-50 text-green-600 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900/60',
  commissioned: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60',
  won:          'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
  lost:         'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60',
  draft:        'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800/60 dark:text-gray-400 dark:border-gray-700/60',
  sent:         'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/60',
};

function StatusBadge({ status }) {
  const cls = STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-500 border-gray-200';
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const target = typeof value === 'number' ? value : 0;
    let start = 0;
    const duration = 900;
    const step = (timestamp) => {
      if (!ref.current) return;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
      else setDisplay(target);
    };
    ref.current = true;
    requestAnimationFrame((ts) => { start = ts; step(ts); });
    return () => { ref.current = null; };
  }, [value]);
  return <>{display.toLocaleString('en-IN')}</>;
}

function KPICard({ icon: Icon, label, value, sub, iconBg, accentColor, rawValue }) {
  return (
    <Card className="relative overflow-hidden border border-border/50 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 bg-card backdrop-blur-sm group">
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)` }} />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top right, ${accentColor}08, transparent 60%)` }} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
            <p className="text-[28px] font-black text-foreground leading-none tabular-nums">
              {typeof rawValue === 'number' ? <AnimatedNumber value={rawValue} /> : value}
            </p>
            {sub && <p className="text-[11px] text-muted-foreground pt-1">{sub}</p>}
          </div>
          <div className={`${iconBg} p-2.5 rounded-xl shrink-0 group-hover:scale-110 transition-transform duration-300`}>
            <Icon size={18} />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground border-t border-border/40 pt-2.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-emerald-600 font-semibold">Live</span>
          <span>· synced now</span>
          <ArrowUpRight size={11} className="ml-auto" style={{ color: accentColor }} />
        </div>
      </CardContent>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-popover text-popover-foreground border border-border rounded-xl shadow-xl px-3 py-2.5 text-xs backdrop-blur-sm">
        <p className="font-bold text-foreground mb-1.5 border-b border-border/50 pb-1.5">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="font-semibold">{p.name}: <span className="text-foreground">{p.value}</span></p>
        ))}
      </div>
    );
  }
  return null;
};

// ── Pipeline stage bubbles ────────────────────────────────────────────────────
function StageBubbles({ opps, onRefetch }) {
  return (
    <Card className="border border-border/50 shadow-sm bg-card">
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 px-5 pt-5">
        <CardTitle className="text-[14px] font-bold">Pipeline by Stage</CardTitle>
        <button onClick={onRefetch} className="p-1 hover:bg-muted/50 rounded transition-colors">
          <RefreshCw size={13} className="text-muted-foreground" />
        </button>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4 pb-4 px-5">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
          {PIPELINE_STAGES.map(s => {
            const count = opps.filter(o => o.stage === s.key).length;
            const val   = opps.filter(o => o.stage === s.key).reduce((a, o) => a + Number(o.estimated_value ?? 0), 0);
            return (
              <div key={s.key} style={{
                background: count > 0 ? s.color + '12' : 'rgba(0,0,0,0.02)',
                border: `1px solid ${count > 0 ? s.color + '40' : 'rgba(0,0,0,0.06)'}`,
                borderRadius: 12, padding: '14px 10px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: count > 0 ? s.color : '#ccc' }}>{count}</div>
                <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', marginTop: 2, fontWeight: 600 }}>{inr(val)}</div>
                <div style={{ fontSize: 9, color: 'hsl(var(--muted-foreground))', marginTop: 3, lineHeight: 1.3 }}>{s.label}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Deal row ──────────────────────────────────────────────────────────────────
function DealRow({ opp, navigate }) {
  const stage = PIPELINE_STAGES.find(s => s.key === opp.stage);
  const days  = opp.stage_updated_at ? daysSince(opp.stage_updated_at) : null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px', borderRadius: 10,
      background: 'var(--card, rgba(255,255,255,0.85))', border: '1px solid rgba(128,128,128,0.12)',
      marginBottom: 6, cursor: 'pointer',
    }} onClick={() => navigate('/epc/bd/opportunities')}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: (stage?.color ?? '#ccc') + '20',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 800, color: stage?.color ?? '#ccc',
      }}>
        {(opp.company_name ?? opp.account_name ?? '?')[0].toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--foreground))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {opp.company_name ?? opp.account_name ?? '—'}
        </div>
        <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 1 }}>{opp.title}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>{inr(opp.estimated_value)}</div>
        <div style={{ fontSize: 10, color: stage?.color ?? 'hsl(var(--muted-foreground))', fontWeight: 600 }}>{stage?.label ?? opp.stage}</div>
      </div>
      {days !== null && (
        <div style={{
          fontSize: 10, fontWeight: 700, color: days > 14 ? '#ef4444' : '#10b981',
          background: days > 14 ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${days > 14 ? '#fecaca' : '#bbf7d0'}`,
          borderRadius: 6, padding: '2px 7px', flexShrink: 0,
        }}>{days}d</div>
      )}
      <ChevronRight size={12} style={{ color: '#ccc', flexShrink: 0 }} />
    </div>
  );
}

// ── Follow-up row ─────────────────────────────────────────────────────────────
function FuRow({ fu, navigate }) {
  const due     = fu.due_date ? new Date(fu.due_date) : null;
  const overdue = due && due < new Date();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
      borderRadius: 10, background: overdue ? '#fef2f2' : 'var(--card, rgba(255,255,255,0.85))',
      border: `1px solid ${overdue ? '#fecaca' : 'rgba(0,0,0,0.05)'}`,
      marginBottom: 6, cursor: 'pointer',
    }} onClick={() => navigate('/epc/bd/follow-ups')}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: overdue ? '#fee2e2' : '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Clock size={13} style={{ color: overdue ? '#ef4444' : '#f97316' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--foreground))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {fu.company_name ?? '—'}
        </div>
        <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{fu.opp_title ?? '—'}</div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: overdue ? '#ef4444' : '#6b7280', flexShrink: 0 }}>
        {due ? due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
      </div>
      <ChevronRight size={12} style={{ color: '#ccc', flexShrink: 0 }} />
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function EPCDashboard() {
  const navigate = useNavigate();
  const { data: dashData, loading: dashLoading, refetch } = useApi(() => bdApi.dashboard());

  const [opps,      setOpps]      = useState([]);
  const [accounts,  setAccounts]  = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      bdApi.opps({ product_type: 'epc' }).catch(() => []),
      bdApi.accounts().catch(() => []),
      bdApi.followUps({ product_type: 'epc' }).catch(() => []),
    ]).then(([o, a, fu]) => {
      setOpps(Array.isArray(o) ? o : o?.data ?? []);
      setAccounts(Array.isArray(a) ? a : a?.data ?? []);
      setFollowUps(Array.isArray(fu) ? fu : fu?.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading || dashLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-[320px] rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-2 gap-5">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  const d = dashData ?? {};

  const totalPipeline    = opps.reduce((s, o) => s + Number(o.value_inr ?? 0), 0);
  const wonOpps          = opps.filter(o => o.stage === 'won');
  const activeOpps       = opps.filter(o => !['won','lost'].includes(o.stage));
  const negotiating      = opps.filter(o => o.stage === 'negotiation').length;
  const openOpps         = opps.filter(o => !['won','lost'].includes(o.stage));
  const totalPipelineVal = openOpps.reduce((s, o) => s + Number(o.estimated_value ?? 0), 0);
  const overdueFollowUps = followUps.filter(fu => fu.due_date && new Date(fu.due_date) < new Date());
  const hotDeals         = opps.filter(o => ['commercial_negotiation','technical_closure'].includes(o.stage));

  // Stage distribution for bar chart
  const stageCounts = STAGE_ORDER.map(stage => ({
    stage: stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    count: opps.filter(o => o.stage === stage).length,
  })).filter(s => s.count > 0);

  // Weekly opportunities
  const now = new Date();
  const weeklyData = Array.from({ length: 8 }, (_, i) => {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (7 - i) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    return {
      label: weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      opportunities: opps.filter(o => {
        const dt = new Date(o.created_at);
        return dt >= weekStart && dt < weekEnd;
      }).length,
    };
  });

  return (
    <div className="flex flex-col gap-5 pb-8" style={{ fontFamily: "'Chivo', sans-serif" }}>

      {/* ── Hero banner with Spline 3D robot ── */}
      <div className="relative w-full h-[320px] rounded-2xl overflow-hidden bg-[#0d0d0d] border border-white/10">
        <SpotlightSVG className="-top-40 left-0 md:left-40 md:-top-20" fill="#F26B4E" />
        <Spotlight className="z-10" size={320} />
        <div className="absolute inset-0 z-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        {/* Left: text */}
        <div className="absolute inset-0 z-20 flex flex-col justify-center pl-10 pr-4 max-w-lg">
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs font-bold px-3 py-1">
              Solar EPC · BD Portal
            </Badge>
            <Badge variant="outline" className="border-white/20 text-white/50 text-xs">Live</Badge>
          </div>

          <h1 className="text-4xl font-black leading-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
            Solar EPC<br />Dashboard
          </h1>

          <p className="mt-3 text-sm text-white/50 leading-relaxed max-w-sm">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>

          <div className="flex items-center gap-3 mt-5">
            <div className="flex flex-col">
              <span className="text-2xl font-black text-white">{openOpps.length}</span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Open Deals</span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex flex-col">
              <span className="text-2xl font-black text-orange-400">{overdueFollowUps.length}</span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Overdue</span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex flex-col">
              <span className="text-2xl font-black text-white">{d.pending_approvals ?? 0}</span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Approvals</span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex flex-col">
              <span className="text-2xl font-black text-white">{accounts.length}</span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Accounts</span>
            </div>
          </div>
        </div>

        {/* Right: Spline 3D scene */}
        <div className="absolute right-0 top-0 h-full w-[55%] z-10">
          <SplineScene
            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
            className="w-full h-full"
          />
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 inset-x-0 h-16 z-30 bg-gradient-to-t from-[#0d0d0d] to-transparent" />
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard icon={FolderOpen}  label="Active Opportunities" rawValue={activeOpps.length}
          sub="In pipeline" accentColor="#F26B4E" iconBg="bg-orange-100 text-orange-500" />
        <KPICard icon={TrendingUp}  label="Pipeline Value" value={inr(totalPipeline)}
          sub="Ex-GST · All stages" accentColor="#3B82F6" iconBg="bg-blue-100 text-blue-500" />
        <KPICard icon={Users}       label="Accounts" rawValue={accounts.length}
          sub="EPC clients tracked" accentColor="#7C3AED" iconBg="bg-violet-100 text-violet-600" />
        <KPICard icon={Sun}         label="Won Deals" rawValue={wonOpps.length}
          sub={`${negotiating} in negotiation`} accentColor="#16A34A" iconBg="bg-emerald-100 text-emerald-600" />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-5 gap-5">
        <Card className="col-span-3 border border-border/50 shadow-sm bg-card backdrop-blur-sm">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 px-5 pt-5">
            <CardTitle className="text-[14px] font-bold">Opportunities by Stage</CardTitle>
            <Badge variant="outline" className="text-[10px] font-semibold">{opps.length} total</Badge>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4 px-3 pb-4">
            {stageCounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <Activity size={28} className="opacity-20" />
                <p className="text-sm">No EPC opportunities yet.</p>
                <Button size="sm" variant="outline" className="mt-2 text-xs"
                  onClick={() => navigate('/epc/bd/opportunities')}>
                  Add first opportunity
                </Button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stageCounts} layout="vertical" margin={{ left: 8, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} allowDecimals={false} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: '#6B7280' }} width={115} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(242,107,78,0.06)' }} />
                  <Bar dataKey="count" fill="#F26B4E" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-2 border border-border/50 shadow-sm bg-card backdrop-blur-sm">
          <CardHeader className="pb-3 px-5 pt-5 space-y-0">
            <CardTitle className="text-[14px] font-bold">Weekly Opportunities</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-3 px-3 pb-3">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={weeklyData} margin={{ left: 0, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="epcGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#F26B4E" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#F26B4E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="opportunities" stroke="#F26B4E" strokeWidth={2.5}
                  fill="url(#epcGrad)" name="Opportunities"
                  dot={{ r: 3.5, fill: '#F26B4E', strokeWidth: 2, stroke: 'white' }}
                  activeDot={{ r: 5, fill: '#F26B4E', strokeWidth: 2, stroke: 'white' }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Pipeline stage bubbles ── */}
      <StageBubbles opps={opps} onRefetch={refetch} />

      {/* ── Follow-ups + Hot deals ── */}
      <div className="grid grid-cols-2 gap-5">
        <Card className="border border-border/50 shadow-sm bg-card">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 px-5 pt-5">
            <CardTitle className="text-[14px] font-bold flex items-center gap-2">
              Follow-ups Due
              {overdueFollowUps.length > 0 && (
                <span className="bg-red-50 text-red-500 text-[10px] font-bold rounded-full px-2 py-0.5 border border-red-200">
                  {overdueFollowUps.length} overdue
                </span>
              )}
            </CardTitle>
            <button onClick={() => navigate('/epc/bd/follow-ups')} className="text-[11px] text-[#F26B4E] font-bold flex items-center gap-1 hover:opacity-70 transition-opacity">
              View all <ArrowRight size={11} />
            </button>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4 px-5 pb-4">
            {followUps.length === 0
              ? <div className="text-center text-muted-foreground text-sm py-5">All clear</div>
              : followUps.slice(0, 5).map(fu => <FuRow key={fu.id} fu={fu} navigate={navigate} />)
            }
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-sm bg-card">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 px-5 pt-5">
            <CardTitle className="text-[14px] font-bold flex items-center gap-2">
              Hot Deals
              <span className="bg-orange-50 text-orange-500 text-[10px] font-bold rounded-full px-2 py-0.5 border border-orange-200">
                {hotDeals.length}
              </span>
            </CardTitle>
            <button onClick={() => navigate('/epc/bd/opportunities')} className="text-[11px] text-[#F26B4E] font-bold flex items-center gap-1 hover:opacity-70 transition-opacity">
              View all <ArrowRight size={11} />
            </button>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4 px-5 pb-4">
            {hotDeals.length === 0
              ? <div className="text-center text-muted-foreground text-sm py-5">No hot deals right now</div>
              : hotDeals.slice(0, 5).map(opp => <DealRow key={opp.id} opp={opp} navigate={navigate} />)
            }
          </CardContent>
        </Card>
      </div>

      {/* ── Active Opportunities Table ── */}
      <Card className="border border-border/50 shadow-sm bg-card backdrop-blur-sm overflow-hidden">
        <CardHeader className="py-3.5 px-5 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-[14px] font-bold">Active Opportunities</CardTitle>
          <Button size="sm" className="bg-[#F26B4E] hover:bg-[#E04D2E] text-white text-xs h-8 px-4 font-bold rounded-lg"
            onClick={() => navigate('/epc/bd/opportunities')}>
            + New Opportunity
          </Button>
        </CardHeader>
        <Separator />
        {activeOpps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-2">
            <Sun size={32} className="opacity-20" />
            <p className="text-sm">No active EPC opportunities. Add your first deal to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#2D2D2D] hover:bg-[#2D2D2D] border-0">
                  {['Account', 'Opportunity', 'Value', 'Stage', 'Owner'].map(h => (
                    <TableHead key={h} className="text-white/75 text-[10px] font-bold uppercase tracking-widest h-9">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeOpps.slice(0, 10).map(o => (
                  <TableRow key={o.id} className="hover:bg-orange-50/50 transition-colors border-border/40">
                    <TableCell className="font-semibold text-[13px] py-3">{o.account_name ?? '—'}</TableCell>
                    <TableCell className="font-medium text-[13px] py-3">{o.title}</TableCell>
                    <TableCell className="font-bold text-[13px] py-3">{inr(o.value_inr)}</TableCell>
                    <TableCell className="py-3"><StatusBadge status={o.stage} /></TableCell>
                    <TableCell className="text-muted-foreground text-[13px] py-3">{o.owner_name ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

    </div>
  );
}
