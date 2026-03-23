import { useEffect, useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid,
} from 'recharts';
import {
  TrendingUp, Zap, FileText, FolderOpen, ArrowUpRight, ArrowRight,
  Activity, Sparkles, Battery, Users, AlertTriangle, CheckCircle2,
  Clock, AlertCircle, MapPin, Bot, Calculator,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApiMulti } from '../hooks/useApi.js';
import { bessApi } from '../lib/api.js';
import { inr, date } from '../lib/fmt.js';
import { Spinner } from '../components/Spinner.jsx';
import { SplineScene } from '@/components/ui/spline-scene';
import { SpotlightSVG, Spotlight } from '@/components/ui/spotlight';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Label } from '../components/ui/label.jsx';
import { Separator } from '../components/ui/separator.jsx';
import { Skeleton } from '../components/ui/skeleton.jsx';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table.jsx';

// ─────────────────────────────────────────────────────────────────────────────
const STAGE_ORDER = ['lead','proposal','negotiation','po_received','installation','commissioned','active'];

const STATUS_BADGE = {
  lead:          'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/60',
  proposal:      'bg-orange-50 text-orange-500 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/60',
  negotiation:   'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60',
  po_received:   'bg-green-50 text-green-600 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900/60',
  active:        'bg-green-50 text-green-600 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900/60',
  commissioned:  'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60',
  won:           'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
  lost:          'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60',
  draft:         'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800/60 dark:text-gray-400 dark:border-gray-700/60',
  sent:          'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/60',
  installation:  'bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-900/60',
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

// ── Quick BESS Sizer ──────────────────────────────────────────────────────────
function QuickSizer() {
  const [useCase, setUseCase]       = useState('dg');
  const [units, setUnits]           = useState([]);
  const [loadKw, setLoadKw]         = useState('');
  const [backupHrs, setBackupHrs]   = useState('');
  const [fuelCost, setFuelCost]     = useState('');
  const [dgDays, setDgDays]         = useState('300');
  const [dispatch, setDispatch]     = useState('');
  const [peakTariff, setPeakTariff] = useState('');
  const [offpeak, setOffpeak]       = useState('');
  const [peakWin, setPeakWin]       = useState('4');
  const [todDays, setTodDays]       = useState('300');
  const [result, setResult]         = useState(null);
  const [aiNote, setAiNote]         = useState(null);
  const [aiLoading, setAiLoading]   = useState(false);
  const [running, setRunning]       = useState(false);

  useEffect(() => {
    bessApi.units().then(res => setUnits(res?.data ?? res ?? [])).catch(() => {});
  }, []);

  const fmt    = (n) => n != null ? n.toLocaleString('en-IN', { maximumFractionDigits: 1 }) : '—';
  const fmtINR = (n) => n != null && n > 0
    ? '₹' + (n >= 1e7 ? (n / 1e7).toFixed(2) + ' Cr' : n >= 1e5 ? (n / 1e5).toFixed(1) + ' L' : n.toLocaleString('en-IN'))
    : '—';

  const runSizing = async () => {
    setRunning(true); setResult(null); setAiNote(null);
    let nominal_kwh = 0, nominal_kw = 0, annual_savings = 0;

    if (useCase === 'dg') {
      const load = parseFloat(loadKw) || 0;
      const hrs  = parseFloat(backupHrs) || 0;
      const days = parseFloat(dgDays) || 300;
      const fuel = parseFloat(fuelCost) || 0;
      nominal_kwh    = (load * hrs) / 0.85;
      nominal_kw     = load;
      annual_savings = load * hrs * 0.31 * fuel * days;
    } else {
      const d    = parseFloat(dispatch) || 0;
      const pk   = parseFloat(peakTariff) || 0;
      const op   = parseFloat(offpeak) || 0;
      const win  = parseFloat(peakWin) || 4;
      const days = parseFloat(todDays) || 300;
      nominal_kwh    = d / 0.85;
      nominal_kw     = d / win;
      annual_savings = d * (pk - op) * days;
    }

    const unitList = units.filter(u => (u.energy_kwh ?? 0) > 0);
    const allConfigs = unitList.map(unit => {
      const ecoN = Math.max(1, Math.ceil(nominal_kwh / unit.energy_kwh));
      const recN = Math.max(1, Math.ceil((nominal_kwh * 1.15) / unit.energy_kwh));
      const mkS  = (n) => {
        const kwh   = n * unit.energy_kwh;
        const capex = n * (unit.price_ex_gst || 0);
        return {
          count: n, kwh, kw: n * unit.power_kw, capex,
          headroom: Math.round(((kwh - nominal_kwh) / nominal_kwh) * 100),
          payback:  capex > 0 && annual_savings > 0 ? (capex / annual_savings).toFixed(1) : null,
          roi10:    capex > 0 && annual_savings > 0 ? Math.round(((annual_savings * 10 - capex) / capex) * 100) : null,
        };
      };
      return { unit, eco: mkS(ecoN), rec: mkS(recN) };
    });

    const best = allConfigs.length > 0
      ? allConfigs.reduce((a, b) => a.eco.count <= b.eco.count ? a : b)
      : null;

    setResult({ nominal_kwh, nominal_kw, annual_savings, allConfigs, best });
    setRunning(false);

    if (unitList.length > 0) {
      setAiLoading(true);
      try {
        const aiRes = await bessApi.recommendBess({
          load_data: {
            source: useCase === 'dg' ? 'DG Replacement' : 'ToD Arbitrage',
            nominal_kwh: Math.round(nominal_kwh),
            nominal_kw:  Math.round(nominal_kw),
            annual_savings_inr: Math.round(annual_savings),
            use_case: useCase,
          },
          available_units: unitList,
        });
        setAiNote(aiRes?.data ?? aiRes);
      } catch (_) {}
      finally { setAiLoading(false); }
    }
  };

  return (
    <Card className="border-orange-200/70 bg-card dark:border-orange-900/40">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="rounded-lg bg-orange-100 p-1.5">
              <Bot className="w-4 h-4 text-orange-500" />
            </div>
            Quick BESS Sizer
          </CardTitle>
          <div className="flex items-center gap-1 rounded-lg border border-orange-200/70 bg-card dark:border-orange-900/40 p-0.5">
            <button onClick={() => { setUseCase('dg'); setResult(null); setAiNote(null); }}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${useCase === 'dg' ? 'bg-orange-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              DG Replacement
            </button>
            <button onClick={() => { setUseCase('tod'); setResult(null); setAiNote(null); }}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${useCase === 'tod' ? 'bg-orange-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              ToD Arbitrage
            </button>
          </div>
        </div>
        <CardDescription>Rule-based sizing engine · AI narrative overlay</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {useCase === 'dg' ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Critical Load (kW)</Label>
              <Input className="h-8 text-sm" placeholder="e.g. 200" value={loadKw} onChange={e => setLoadKw(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Backup Duration (hrs)</Label>
              <Input className="h-8 text-sm" placeholder="e.g. 4" value={backupHrs} onChange={e => setBackupHrs(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Diesel Cost (₹/L)</Label>
              <Input className="h-8 text-sm" placeholder="e.g. 95" value={fuelCost} onChange={e => setFuelCost(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Operating Days/yr</Label>
              <Input className="h-8 text-sm" placeholder="300" value={dgDays} onChange={e => setDgDays(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Daily Dispatch (kWh)</Label>
              <Input className="h-8 text-sm" placeholder="e.g. 500" value={dispatch} onChange={e => setDispatch(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Peak Tariff (₹/kWh)</Label>
              <Input className="h-8 text-sm" placeholder="e.g. 12" value={peakTariff} onChange={e => setPeakTariff(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Off-Peak Tariff (₹/kWh)</Label>
              <Input className="h-8 text-sm" placeholder="e.g. 4" value={offpeak} onChange={e => setOffpeak(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Peak Window (hrs)</Label>
              <Input className="h-8 text-sm" placeholder="4" value={peakWin} onChange={e => setPeakWin(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Operating Days/yr</Label>
              <Input className="h-8 text-sm" placeholder="300" value={todDays} onChange={e => setTodDays(e.target.value)} />
            </div>
          </div>
        )}

        <Button className="bg-orange-500 hover:bg-orange-600 text-white font-bold h-8 px-5 text-xs gap-2"
          onClick={runSizing} disabled={running}>
          <Calculator className="w-3.5 h-3.5" />
          {running ? 'Calculating…' : 'Run Sizing'}
        </Button>

        {result && (
          <div className="space-y-3 pt-1">
            <div className="rounded-lg bg-zinc-900 text-white p-4 flex flex-wrap gap-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Nominal Energy</p>
                <p className="text-xl font-black text-orange-400">{fmt(result.nominal_kwh)} <span className="text-sm font-normal text-zinc-300">kWh</span></p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Nominal Power</p>
                <p className="text-xl font-black text-white">{fmt(result.nominal_kw)} <span className="text-sm font-normal text-zinc-300">kW</span></p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Est. Annual Savings</p>
                <p className="text-xl font-black text-green-400">{fmtINR(result.annual_savings)}</p>
              </div>
            </div>

            {result.best && (
              <div className="grid grid-cols-2 gap-3">
                {[{ label: 'Economical', slot: result.best.eco, accent: false },
                  { label: 'Recommended', slot: result.best.rec, accent: true }].map(({ label, slot, accent }) => (
                  <div key={label} className={`rounded-lg border p-3 ${accent ? 'border-orange-300 bg-orange-50 dark:border-orange-800/60 dark:bg-orange-950/30' : 'border-border bg-muted/50'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${accent ? 'text-orange-500' : 'text-zinc-500'}`}>{label}</p>
                    <p className="text-sm font-black text-foreground">
                      {slot.count}× {result.best.unit.unit_name ?? result.best.unit.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{fmt(slot.kwh)} kWh · {fmt(slot.kw)} kW · +{slot.headroom}% headroom</p>
                    {slot.capex > 0 && (
                      <p className="text-xs font-bold text-foreground mt-1">
                        {fmtINR(slot.capex)} CAPEX
                        {slot.payback && <span className="text-muted-foreground font-normal"> · {slot.payback} yr payback</span>}
                        {slot.roi10 != null && <span className="text-green-600 font-normal"> · {slot.roi10}% 10yr ROI</span>}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className={`rounded-lg border p-3 transition-all ${aiLoading ? 'border-orange-200 bg-orange-50/50' : aiNote ? 'border-blue-200 bg-blue-50/40' : 'hidden'}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className={`w-3.5 h-3.5 ${aiLoading ? 'text-orange-400 animate-pulse' : 'text-blue-500'}`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {aiLoading ? 'AI analysing…' : 'AI Sizing Rationale'}
                </span>
              </div>
              {!aiLoading && aiNote && (
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                  {typeof aiNote === 'string' ? aiNote : aiNote?.recommendation ?? aiNote?.rationale ?? JSON.stringify(aiNote, null, 2)}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { proposals, projects, configs, clients, sites } = useApiMulti({
    proposals: bessApi.proposals,
    projects:  bessApi.projects,
    configs:   bessApi.configs,
    clients:   bessApi.clients,
    sites:     bessApi.sites,
  });

  const loading = proposals?.loading || projects?.loading || configs?.loading;

  if (loading) {
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

  const pr  = proposals?.data ?? [];
  const pj  = projects?.data  ?? [];
  const cfg = configs?.data   ?? [];
  const allClients = clients?.data ?? [];
  const allSites   = sites?.data   ?? [];

  const totalCapex = pr.reduce((s, p) => s + Number(p.capex_ex_gst ?? 0), 0);
  const totalKwh   = cfg.reduce((s, c) => s + Number(c.total_energy_kwh ?? 0), 0);
  const now        = Date.now();

  // Derived action-item lists
  const expiringProposals = pr.filter(p => {
    if (p.status !== 'sent' || !p.validity_days) return false;
    const expiry = new Date(p.created_at).getTime() + p.validity_days * 86400000;
    return expiry > now && expiry < now + 30 * 86400000;
  });
  const draftProposals = pr.filter(p => p.status === 'draft');
  const activeProjects = pj.filter(p => ['installation','commissioned','active','po_received'].includes(p.status));
  const stalledProjects = pj.filter(p => ['lead','proposal','negotiation'].includes(p.status));
  const siteIdsWithProposals = new Set(pr.map(p => p.site_id).filter(Boolean));
  const sitesNeedingProposal = allSites.filter(s => !siteIdsWithProposals.has(s.id));
  const pipelineValue = pr.filter(p => p.status !== 'lost').reduce((s, p) => s + Number(p.capex_ex_gst ?? 0), 0);

  const stageCounts = STAGE_ORDER.map(stage => ({
    stage: stage.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()),
    count: pj.filter(p => p.status === stage).length,
  })).filter(s => s.count > 0);

  const nowDate = new Date();
  const weeklyActivity = Array.from({ length: 8 }, (_, i) => {
    const weekStart = new Date(nowDate);
    weekStart.setDate(nowDate.getDate() - (7 - i) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    return {
      label: weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      proposals: pr.filter(p => {
        const pd = new Date(p.created_at);
        return pd >= weekStart && pd < weekEnd;
      }).length,
    };
  });

  const urgentCount = expiringProposals.length + draftProposals.length;

  return (
    <div className="flex flex-col gap-5 pb-8">

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
              UnityESS · BESS Sizing
            </Badge>
            <Badge variant="outline" className="border-white/20 text-white/50 text-xs">
              Live
            </Badge>
          </div>

          <h1 className="text-4xl font-black leading-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
            BESS<br />Dashboard
          </h1>

          <p className="mt-3 text-sm text-white/50 leading-relaxed max-w-sm">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>

          <div className="flex items-center gap-3 mt-5">
            <div className="flex flex-col">
              <span className="text-2xl font-black text-white">{pj.length}</span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Projects</span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex flex-col">
              <span className="text-2xl font-black text-orange-400">{pr.length}</span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Proposals</span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex flex-col">
              <span className="text-2xl font-black text-white">{allClients.length}</span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Clients</span>
            </div>
            {urgentCount > 0 && (
              <>
                <div className="w-px h-8 bg-white/10" />
                <div className="flex flex-col">
                  <span className="text-2xl font-black text-red-400">{urgentCount}</span>
                  <span className="text-[10px] text-white/40 uppercase tracking-wider">Urgent</span>
                </div>
              </>
            )}
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
        <KPICard icon={FolderOpen}  label="Active Projects"  rawValue={pj.length}
          sub="BESS installations tracked" accentColor="#F26B4E" iconBg="bg-orange-100 text-orange-500" />
        <KPICard icon={TrendingUp}  label="Pipeline Value"   value={inr(totalCapex)}
          sub="Ex-GST · All proposals" accentColor="#3B82F6" iconBg="bg-blue-100 text-blue-500" />
        <KPICard icon={Zap}         label="Capacity Quoted"  value={`${totalKwh.toLocaleString('en-IN')} kWh`} rawValue={totalKwh}
          sub="All configurations" accentColor="#7C3AED" iconBg="bg-violet-100 text-violet-600" />
        <KPICard icon={FileText}    label="Proposals"        rawValue={pr.length}
          sub={`${draftProposals.length} drafts · ${expiringProposals.length} expiring`}
          accentColor="#16A34A" iconBg="bg-emerald-100 text-emerald-600" />
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-5 gap-5">
        <Card className="col-span-3 border border-border/50 shadow-sm bg-card backdrop-blur-sm">
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

        <Card className="col-span-2 border border-border/50 shadow-sm bg-card backdrop-blur-sm">
          <CardHeader className="pb-3 px-5 pt-5 space-y-0">
            <CardTitle className="text-[14px] font-bold">Weekly Proposals</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-3 px-3 pb-3">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={weeklyActivity} margin={{ left:0, right:8, top:4 }}>
                <defs>
                  <linearGradient id="proposalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#F26B4E" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#F26B4E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="label" tick={{ fontSize:10, fill:'#9CA3AF' }} axisLine={false} tickLine={false} />
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
      </div>

      {/* ── Action items row ── */}
      <div className="grid grid-cols-2 gap-5">

        {/* Expiring proposals */}
        <Card className={expiringProposals.length > 0 ? 'border-amber-300' : 'border border-border/50'}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[14px] font-bold flex items-center gap-2">
                <Clock className={`w-4 h-4 ${expiringProposals.length > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
                Proposals Expiring Soon
              </CardTitle>
              <Badge variant={expiringProposals.length > 0 ? 'outline' : 'secondary'}
                className={expiringProposals.length > 0 ? 'border-amber-400 text-amber-600' : ''}>
                {expiringProposals.length} expiring
              </Badge>
            </div>
            <CardDescription>Sent proposals valid for ≤30 days</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {expiringProposals.length === 0 ? (
              <div className="flex items-center gap-2 px-6 py-5 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> No proposals expiring soon.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#2D2D2D] hover:bg-[#2D2D2D] border-0">
                    {['Proposal','Client','CAPEX','Expires'].map(h => (
                      <TableHead key={h} className="text-white/75 text-[10px] font-bold uppercase tracking-widest h-8">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiringProposals.map(p => {
                    const expiry = new Date(new Date(p.created_at).getTime() + p.validity_days * 86400000);
                    const daysLeft = Math.ceil((expiry - now) / 86400000);
                    return (
                      <TableRow key={p.id} className="cursor-pointer hover:bg-amber-50/50" onClick={() => navigate('/bess/proposals')}>
                        <TableCell className="font-mono text-xs font-bold text-orange-500">{p.proposal_number}</TableCell>
                        <TableCell className="font-semibold text-sm">{p.company_name}</TableCell>
                        <TableCell className="text-sm font-bold">{inr(p.capex_ex_gst)}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${daysLeft <= 7 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                            {daysLeft}d left
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Draft proposals */}
        <Card className={draftProposals.length > 0 ? 'border-orange-300' : 'border border-border/50'}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[14px] font-bold flex items-center gap-2">
                <FileText className={`w-4 h-4 ${draftProposals.length > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
                Draft Proposals
              </CardTitle>
              <Badge variant="secondary">{draftProposals.length} drafts</Badge>
            </div>
            <CardDescription>Generated but not yet sent to client</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {draftProposals.length === 0 ? (
              <div className="flex items-center gap-2 px-6 py-5 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> No pending drafts.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#2D2D2D] hover:bg-[#2D2D2D] border-0">
                    {['Proposal','Client','CAPEX','Created'].map(h => (
                      <TableHead key={h} className="text-white/75 text-[10px] font-bold uppercase tracking-widest h-8">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draftProposals.slice(0, 5).map(p => (
                    <TableRow key={p.id} className="cursor-pointer hover:bg-orange-50/50" onClick={() => navigate('/bess/proposals')}>
                      <TableCell className="font-mono text-xs font-bold text-orange-500">{p.proposal_number}</TableCell>
                      <TableCell className="font-semibold text-sm">{p.company_name}</TableCell>
                      <TableCell className="text-sm font-bold">{inr(p.capex_ex_gst)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{date(p.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Active Projects + Stalled Pipeline ── */}
      <div className="grid grid-cols-2 gap-5">

        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[14px] font-bold flex items-center gap-2">
                <Activity className="w-4 h-4 text-orange-500" /> Active Projects
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs text-orange-500 h-7" onClick={() => navigate('/bess/projects')}>
                View all <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
            <CardDescription>Installations, commissioned, and live</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {activeProjects.length === 0 ? (
              <div className="px-6 py-5 text-sm text-muted-foreground">No active projects yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#2D2D2D] hover:bg-[#2D2D2D] border-0">
                    {['Project','Client','Status','PO Value'].map(h => (
                      <TableHead key={h} className="text-white/75 text-[10px] font-bold uppercase tracking-widest h-8">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeProjects.slice(0, 5).map(p => (
                    <TableRow key={p.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate('/bess/projects')}>
                      <TableCell className="font-bold text-sm">{p.project_name ?? p.project_code}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.company_name}</TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                      <TableCell className="text-sm font-bold text-orange-500">{p.po_value_inr ? inr(p.po_value_inr) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="border border-border/50 shadow-sm flex-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-[14px] font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Stalled Pipeline
              </CardTitle>
              <CardDescription>Lead / proposal / negotiation with no PO</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {stalledProjects.length === 0 ? (
                <div className="flex items-center gap-2 px-6 py-4 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-500" /> Pipeline is moving well.
                </div>
              ) : (
                <Table>
                  <TableBody>
                    {stalledProjects.slice(0, 4).map(p => (
                      <TableRow key={p.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate('/bess/projects')}>
                        <TableCell className="font-bold text-sm">{p.project_name ?? p.project_code}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.company_name}</TableCell>
                        <TableCell><StatusBadge status={p.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/50 shadow-sm flex-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-[14px] font-bold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-500" /> Sites Without Proposals
              </CardTitle>
              <CardDescription>{sitesNeedingProposal.length} site{sitesNeedingProposal.length !== 1 ? 's' : ''} not yet quoted</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {sitesNeedingProposal.length === 0 ? (
                <div className="flex items-center gap-2 px-6 py-4 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-500" /> All sites have proposals.
                </div>
              ) : (
                <div className="divide-y">
                  {sitesNeedingProposal.slice(0, 4).map(s => (
                    <div key={s.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate('/bess/config')}>
                      <div>
                        <p className="text-sm font-bold">{s.site_name}</p>
                        <p className="text-xs text-muted-foreground">{s.company_name}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs text-orange-500 h-7">
                        Size it <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Recent Proposals Table ── */}
      <Card className="border border-border/50 shadow-sm bg-card backdrop-blur-sm overflow-hidden">
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
                    <TableCell className="font-bold text-[13px] py-3 text-emerald-600">{p.irr_percent ? `${p.irr_percent}%` : '—'}</TableCell>
                    <TableCell className="py-3"><StatusBadge status={p.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* ── Quick BESS Sizer ── */}
      <QuickSizer />

    </div>
  );
}
