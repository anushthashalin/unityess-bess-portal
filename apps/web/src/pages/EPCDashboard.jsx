import { useRef, useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import {
  Sun, FolderOpen, TrendingUp, FileText, Users,
  ArrowUpRight, Activity, Sparkles, Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { bdApi } from '../lib/api.js';
import { inr, date } from '../lib/fmt.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Button } from '../components/ui/button.jsx';
import { Separator } from '../components/ui/separator.jsx';
import { Skeleton } from '../components/ui/skeleton.jsx';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table.jsx';

const STAGE_ORDER = ['lead','proposal','negotiation','po_received','installation','commissioned','active'];

const STATUS_BADGE = {
  lead:         'bg-blue-50 text-blue-600 border-blue-200',
  proposal:     'bg-orange-50 text-orange-500 border-orange-200',
  negotiation:  'bg-amber-50 text-amber-600 border-amber-200',
  po_received:  'bg-green-50 text-green-600 border-green-200',
  active:       'bg-green-50 text-green-600 border-green-200',
  commissioned: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  won:          'bg-emerald-100 text-emerald-800 border-emerald-300',
  lost:         'bg-red-50 text-red-600 border-red-200',
  draft:        'bg-gray-100 text-gray-500 border-gray-200',
  sent:         'bg-blue-50 text-blue-600 border-blue-200',
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
    <Card className="relative overflow-hidden border border-border/50 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 bg-white/95 backdrop-blur-sm group">
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
      <div className="bg-white border border-border rounded-xl shadow-xl px-3 py-2.5 text-xs backdrop-blur-sm">
        <p className="font-bold text-foreground mb-1.5 border-b border-border/50 pb-1.5">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="font-semibold">{p.name}: <span className="text-foreground">{p.value}</span></p>
        ))}
      </div>
    );
  }
  return null;
};

export default function EPCDashboard() {
  const navigate = useNavigate();
  const [opps, setOpps]       = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      bdApi.opps({ product_type: 'epc' }).catch(() => []),
      bdApi.accounts().catch(() => []),
    ]).then(([o, a]) => {
      setOpps(Array.isArray(o) ? o : o?.data ?? []);
      setAccounts(Array.isArray(a) ? a : a?.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
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

  const totalPipeline = opps.reduce((s, o) => s + Number(o.value_inr ?? 0), 0);
  const wonOpps       = opps.filter(o => o.stage === 'won');
  const activeOpps    = opps.filter(o => !['won','lost'].includes(o.stage));
  const negotiating   = opps.filter(o => o.stage === 'negotiation').length;

  // Stage distribution
  const stageCounts = STAGE_ORDER.map(stage => ({
    stage: stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    count: opps.filter(o => o.stage === stage).length,
  })).filter(s => s.count > 0);

  // Weekly opportunities created
  const now = new Date();
  const weeklyData = Array.from({ length: 8 }, (_, i) => {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (7 - i) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    return {
      label: weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      opportunities: opps.filter(o => {
        const d = new Date(o.created_at);
        return d >= weekStart && d < weekEnd;
      }).length,
    };
  });

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-foreground tracking-tight">Solar EPC Dashboard</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white/90 border border-border/50 rounded-xl px-3 py-1.5 shadow-sm">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <Sparkles size={11} className="text-orange-400" />
            <span className="text-[11px] font-bold text-orange-500">Solar EPC · Live</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
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

      {/* Charts row */}
      <div className="grid grid-cols-5 gap-5">
        <Card className="col-span-3 border border-border/50 shadow-sm bg-white/95 backdrop-blur-sm">
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

        <Card className="col-span-2 border border-border/50 shadow-sm bg-white/95 backdrop-blur-sm">
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

      {/* Active Opportunities Table */}
      <Card className="border border-border/50 shadow-sm bg-white/95 backdrop-blur-sm overflow-hidden">
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
