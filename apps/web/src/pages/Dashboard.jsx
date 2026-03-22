import { useEffect, useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid,
} from 'recharts';
import { TrendingUp, Zap, FileText, FolderOpen, ArrowUpRight, Activity, Sparkles, Battery, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApiMulti } from '../hooks/useApi.js';
import { bessApi } from '../lib/api.js';
import { inr, date } from '../lib/fmt.js';
import { Spinner } from '../components/Spinner.jsx';
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
  lead:          'bg-blue-50 text-blue-600 border-blue-200',
  proposal:      'bg-orange-50 text-orange-500 border-orange-200',
  negotiation:   'bg-amber-50 text-amber-600 border-amber-200',
  po_received:   'bg-green-50 text-green-600 border-green-200',
  active:        'bg-green-50 text-green-600 border-green-200',
  commissioned:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  won:           'bg-emerald-100 text-emerald-800 border-emerald-300',
  lost:          'bg-red-50 text-red-600 border-red-200',
  draft:         'bg-gray-100 text-gray-500 border-gray-200',
  sent:          'bg-blue-50 text-blue-600 border-blue-200',
  installation:  'bg-violet-50 text-violet-600 border-violet-200',
};

function StatusBadge({ status }) {
  const cls = STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-500 border-gray-200';
  const label = status.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

// Animated counter
function AnimatedNumber({ value, prefix = '', suffix = '' }) {
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
  return <>{prefix}{display.toLocaleString('en-IN')}{suffix}</>;
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
              {typeof rawValue === 'number'
                ? <AnimatedNumber value={rawValue} />
                : value
              }
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

export default function Dashboard() {
  const navigate = useNavigate();
  const { proposals, projects, configs } = useApiMulti({
    proposals: bessApi.proposals,
    projects:  bessApi.projects,
    configs:   bessApi.configs,
  });

  const loading = proposals?.loading || projects?.loading || configs?.loading;

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-52" />
          </div>
        </div>
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

  const pr  = proposals?.data ?? [];
  const pj  = projects?.data  ?? [];
  const cfg = configs?.data   ?? [];

  const totalCapex = pr.reduce((s, p) => s + Number(p.capex_ex_gst ?? 0), 0);
  const totalKwh   = cfg.reduce((s, c) => s + Number(c.total_energy_kwh ?? 0), 0);
  const totalUnits = cfg.reduce((s, c) => s + Number(c.num_units ?? 0), 0);

  const stageCounts = STAGE_ORDER.map(stage => ({
    stage: stage.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()),
    count: pj.filter(p => p.status === stage).length,
  })).filter(s => s.count > 0);

  const now = new Date();
  const monthlyActivity = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      month:     d.toLocaleDateString('en-IN', { month:'short', year:'2-digit' }),
      proposals: pr.filter(p => {
        const pd = new Date(p.created_at);
        return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth();
      }).length,
    };
  });

  const negotiationCount = pr.filter(p => p.status === 'negotiation').length;

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-foreground tracking-tight">Dashboard</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white/90 border border-border/50 rounded-xl px-3 py-1.5 shadow-sm">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <Sparkles size={11} className="text-orange-400" />
            <span className="text-[11px] font-bold text-orange-500">UnityESS · Live</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard icon={FolderOpen}  label="Active Projects"  value={pj.length} rawValue={pj.length}
          sub="BESS installations tracked" accentColor="#F26B4E" iconBg="bg-orange-100 text-orange-500" />
        <KPICard icon={TrendingUp}  label="Pipeline Value"   value={inr(totalCapex)}
          sub="Ex-GST · All proposals" accentColor="#3B82F6" iconBg="bg-blue-100 text-blue-500" />
        <KPICard icon={Zap}         label="Capacity Quoted"  value={`${totalKwh.toLocaleString('en-IN')} kWh`} rawValue={totalKwh}
          sub={`${totalUnits} units total`} accentColor="#7C3AED" iconBg="bg-violet-100 text-violet-600" />
        <KPICard icon={FileText}    label="Proposals"        value={pr.length} rawValue={pr.length}
          sub={`${negotiationCount} in negotiation`} accentColor="#16A34A" iconBg="bg-emerald-100 text-emerald-600" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-5 gap-5">
        {/* Bar chart — 3 cols */}
        <Card className="col-span-3 border border-border/50 shadow-sm bg-white/95 backdrop-blur-sm">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 px-5 pt-5">
            <CardTitle className="text-[14px] font-bold">Projects by Stage</CardTitle>
            <Badge variant="outline" className="text-[10px] font-semibold">{pj.length} total</Badge>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4 px-3 pb-4">
            {stageCounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <Activity size={28} className="opacity-20" />
                <p className="text-sm">No projects yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stageCounts} layout="vertical" margin={{ left:8, right:20 }}>
                  <XAxis type="number" tick={{ fontSize:11, fill:'#9CA3AF' }} allowDecimals={false} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="stage" tick={{ fontSize:11, fill:'#6B7280' }} width={115} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill:'rgba(242,107,78,0.06)' }} />
                  <Bar dataKey="count" fill="#F26B4E" radius={[0,6,6,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Stats column — 2 cols */}
        <div className="col-span-2 flex flex-col gap-4">
          <Card className="border border-border/50 shadow-sm bg-white/95 backdrop-blur-sm flex-1">
            <CardHeader className="pb-3 px-5 pt-5 space-y-0">
              <CardTitle className="text-[14px] font-bold">Monthly Proposals</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-3 px-3 pb-3">
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={monthlyActivity} margin={{ left:0, right:8, top:4 }}>
                  <defs>
                    <linearGradient id="proposalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#F26B4E" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#F26B4E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="month" tick={{ fontSize:10, fill:'#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:10, fill:'#9CA3AF' }} allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="proposals" stroke="#F26B4E" strokeWidth={2.5}
                    fill="url(#proposalGrad)" name="Proposals"
                    dot={{ r:3.5, fill:'#F26B4E', strokeWidth:2, stroke:'white' }}
                    activeDot={{ r:5, fill:'#F26B4E', strokeWidth:2, stroke:'white' }} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Mini stat cards */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Clients', value: cl.length, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
              { label: 'Units', value: totalUnits, icon: Battery, color: 'text-violet-600', bg: 'bg-violet-50' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <Card key={label} className="border border-border/50 bg-white/95 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`${bg} p-2 rounded-lg`}>
                    <Icon size={16} className={color} />
                  </div>
                  <div>
                    <div className="text-[20px] font-black text-foreground leading-none">
                      <AnimatedNumber value={value} />
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Projects Table */}
      <Card className="border border-border/50 shadow-sm bg-white/95 backdrop-blur-sm overflow-hidden">
        <CardHeader className="py-3.5 px-5 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-[14px] font-bold">Projects</CardTitle>
          <Button size="sm" className="bg-[#F26B4E] hover:bg-[#E04D2E] text-white text-xs h-8 px-4 font-bold rounded-lg"
            onClick={() => navigate('/projects')}>
            + New Project
          </Button>
        </CardHeader>
        <Separator />
        {pj.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-2">
            <FolderOpen size={32} className="opacity-20" />
            <p className="text-sm">No projects yet. Add your first client and project to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#2D2D2D] hover:bg-[#2D2D2D] border-0">
                  {['Code','Client','Status','PO Value'].map(h => (
                    <TableHead key={h} className="text-white/75 text-[10px] font-bold uppercase tracking-widest h-9">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pj.map(p => (
                  <TableRow key={p.id} className="hover:bg-orange-50/50 transition-colors border-border/40">
                    <TableCell className="font-mono font-bold text-[#F26B4E] text-[13px] py-3">{p.project_code}</TableCell>
                    <TableCell className="font-semibold text-[13px] py-3">{p.company_name}</TableCell>
                    <TableCell className="py-3"><StatusBadge status={p.status} /></TableCell>
                    <TableCell className="font-bold text-[13px] py-3">{inr(p.po_value_inr)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Recent Proposals Table */}
      <Card className="border border-border/50 shadow-sm bg-white/95 backdrop-blur-sm overflow-hidden">
        <CardHeader className="py-3.5 px-5 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-[14px] font-bold">Recent Proposals</CardTitle>
          <span className="text-[11px] text-muted-foreground">{pr.length} total</span>
        </CardHeader>
        <Separator />
        {pr.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-2">
            <FileText size={32} className="opacity-20" />
            <p className="text-sm">No proposals yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#2D2D2D] hover:bg-[#2D2D2D] border-0">
                  {['Proposal No.','Client','Date','CAPEX','IRR','Status'].map(h => (
                    <TableHead key={h} className="text-white/75 text-[10px] font-bold uppercase tracking-widest h-9">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pr.slice(0, 8).map(p => (
                  <TableRow key={p.id} className="hover:bg-orange-50/50 transition-colors border-border/40">
                    <TableCell className="font-mono font-bold text-[13px] py-3">{p.proposal_number}</TableCell>
                    <TableCell className="font-semibold text-[13px] py-3">{p.company_name}</TableCell>
                    <TableCell className="text-muted-foreground text-[13px] py-3">{date(p.proposal_date ?? p.created_at)}</TableCell>
                    <TableCell className="font-bold text-[13px] py-3">{inr(p.capex_ex_gst)}</TableCell>
                    <TableCell className="font-bold text-[13px] py-3 text-emerald-600">
                      {p.irr_percent ? `${p.irr_percent}%` : '—'}
                    </TableCell>
                    <TableCell className="py-3"><StatusBadge status={p.status} /></TableCell>
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
