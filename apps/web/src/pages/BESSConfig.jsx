import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Zap, Battery, Settings, TrendingUp, Cpu, CheckCircle2,
  ChevronRight, Info, BarChart3, Layers, Clock, Shield,
  Thermometer, Weight, Wifi, Award,
  Upload, FileText, User, Link2, Loader2, X, BarChart2,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useApiMulti } from '../hooks/useApi.js';
import { bessApi } from '../lib/api.js';
import { Spinner, ErrorBanner } from '../components/Spinner.jsx';

// shadcn/ui
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

// ── Constants ────────────────────────────────────────────────────────────────
const APPLICATIONS = [
  { value: 'tod_arbitrage',  label: 'ToD Arbitrage',              color: '#F26B4E' },
  { value: 'peak_shaving',   label: 'Peak Demand Shaving',         color: '#6366F1' },
  { value: 'backup',         label: 'Emergency Backup',            color: '#10B981' },
  { value: 'grid_support',   label: 'Grid Support / Utility',      color: '#F59E0B' },
  { value: 'hybrid',         label: 'Hybrid (Solar + BESS)',       color: '#3B82F6' },
];

const COUPLING = ['AC', 'DC'];

// ToD tariff slots for Delhi (₹/kWh) — illustrative
const TOD_SLOTS = [
  { hour: '00', slot: 'Off-peak', buy: 5.2, sell: 3.8 },
  { hour: '02', slot: 'Off-peak', buy: 5.2, sell: 3.8 },
  { hour: '04', slot: 'Off-peak', buy: 5.2, sell: 3.8 },
  { hour: '06', slot: 'Shoulder', buy: 6.8, sell: 5.5 },
  { hour: '08', slot: 'Peak',     buy: 9.5, sell: 8.2 },
  { hour: '10', slot: 'Peak',     buy: 9.5, sell: 8.2 },
  { hour: '12', slot: 'Shoulder', buy: 7.2, sell: 6.0 },
  { hour: '14', slot: 'Shoulder', buy: 7.2, sell: 6.0 },
  { hour: '16', slot: 'Peak',     buy: 10.2, sell: 9.0 },
  { hour: '18', slot: 'Peak',     buy: 11.5, sell: 10.5 },
  { hour: '20', slot: 'Peak',     buy: 10.8, sell: 9.8 },
  { hour: '22', slot: 'Off-peak', buy: 5.5, sell: 4.2 },
];

const SLOT_COLORS = { Peak: '#F26B4E', Shoulder: '#F59E0B', 'Off-peak': '#10B981' };

// ── Cycle Degradation Datasets ───────────────────────────────────────────────
const CYCLE_DATASETS = {
  q25c_365: {
    label: '0.25C · 365 cycles/yr',
    description: 'Standard C&I ToD — once-daily discharge',
    cycles_per_year: 365,
    years: [
      { soh:0.9609, rte:0.9390 }, { soh:0.9303, rte:0.9385 }, { soh:0.9013, rte:0.9360 },
      { soh:0.8814, rte:0.9343 }, { soh:0.8658, rte:0.9330 }, { soh:0.8559, rte:0.9321 },
      { soh:0.8422, rte:0.9309 }, { soh:0.8244, rte:0.9294 }, { soh:0.8103, rte:0.9282 },
      { soh:0.7971, rte:0.9270 }, { soh:0.7846, rte:0.9260 }, { soh:0.7747, rte:0.9251 },
      { soh:0.7649, rte:0.9243 }, { soh:0.7556, rte:0.9235 }, { soh:0.7466, rte:0.9227 },
      { soh:0.7375, rte:0.9219 }, { soh:0.7292, rte:0.9212 }, { soh:0.7209, rte:0.9205 },
      { soh:0.7124, rte:0.9197 }, { soh:0.7046, rte:0.9191 },
    ],
  },
  h5c_365: {
    label: '0.5C · 365 cycles/yr',
    description: 'Heavy C&I / industrial — once-daily at 0.5C',
    cycles_per_year: 365,
    years: [
      { soh:0.9531, rte:0.9280 }, { soh:0.9263, rte:0.9263 }, { soh:0.8973, rte:0.9241 },
      { soh:0.8769, rte:0.9225 }, { soh:0.8629, rte:0.9214 }, { soh:0.8529, rte:0.9207 },
      { soh:0.8396, rte:0.9197 }, { soh:0.8210, rte:0.9183 }, { soh:0.8065, rte:0.9171 },
      { soh:0.7919, rte:0.9160 }, { soh:0.7773, rte:0.9149 }, { soh:0.7629, rte:0.9138 },
      { soh:0.7483, rte:0.9127 }, { soh:0.7339, rte:0.9116 }, { soh:0.7194, rte:0.9105 },
      { soh:0.7049, rte:0.9094 }, { soh:0.6905, rte:0.9083 }, { soh:0.6761, rte:0.9072 },
      { soh:0.6617, rte:0.9061 }, { soh:0.6472, rte:0.9050 },
    ],
  },
  h5c_730: {
    label: '0.5C · 730 cycles/yr',
    description: 'Utility / dual-shift — twice-daily discharge',
    cycles_per_year: 730,
    years: [
      { soh:0.9323, rte:0.9280 }, { soh:0.8877, rte:0.9233 }, { soh:0.8526, rte:0.9207 },
      { soh:0.8163, rte:0.9179 }, { soh:0.7907, rte:0.9159 }, { soh:0.7716, rte:0.9145 },
      { soh:0.7491, rte:0.9128 }, { soh:0.7293, rte:0.9113 }, { soh:0.7104, rte:0.9098 },
      { soh:0.6920, rte:0.9084 }, { soh:0.6743, rte:0.9071 }, { soh:0.6574, rte:0.9058 },
      { soh:0.6410, rte:0.9045 }, { soh:0.6255, rte:0.9034 }, { soh:0.6107, rte:0.9022 },
      { soh:0.6000, rte:0.9014 },
    ],
  },
};

// ── Finance Engine ────────────────────────────────────────────────────────────
// Newton-Raphson IRR — cashflows[0] = -CAPEX, [1..n] = net annual cash inflows
function calcIRR(cashflows, guess = 0.15) {
  let rate = guess;
  for (let iter = 0; iter < 200; iter++) {
    let npv = 0, dnpv = 0;
    for (let t = 0; t < cashflows.length; t++) {
      const pv = Math.pow(1 + rate, t);
      npv  += cashflows[t] / pv;
      dnpv -= t * cashflows[t] / (pv * (1 + rate));
    }
    if (Math.abs(dnpv) < 1e-10) break;
    const next = rate - npv / dnpv;
    if (Math.abs(next - rate) < 1e-8) return next;
    rate = Math.max(-0.9, next); // guard against divergence
  }
  return rate;
}

// Build year-by-year net cashflows with SOH/RTE degradation and O&M escalation
function buildCashflows({ capex, nominalKwh, socWindow, tariffDiff, dataset, years = 10, omRate = 0.015, omEsc = 0.03 }) {
  const flows = [-capex];
  let om = capex * omRate;
  const lastRow = dataset.years[dataset.years.length - 1];
  for (let yr = 0; yr < years; yr++) {
    const d = dataset.years[yr] ?? lastRow;
    const atMeter  = nominalKwh * d.soh * socWindow * d.rte;
    const gross    = atMeter * tariffDiff * dataset.cycles_per_year;
    flows.push(gross - om);
    om *= (1 + omEsc);
  }
  return flows;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const inrCr = (v) => `₹${(v / 1e7).toFixed(2)} Cr`;
const inrL  = (v) => `₹${(v / 1e5).toFixed(1)} L`;

function SparkKpi({ label, value, sub, icon: Icon, accent = false }) {
  return (
    <Card className={accent ? 'border-orange-500/40 bg-orange-50' : ''}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
            <p className={`text-2xl font-black ${accent ? 'text-orange-500' : 'text-foreground'}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          {Icon && (
            <div className={`rounded-lg p-2 ${accent ? 'bg-orange-100' : 'bg-muted'}`}>
              <Icon className={`w-5 h-5 ${accent ? 'text-orange-500' : 'text-muted-foreground'}`} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Custom recharts tooltip
function ChartTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover text-popover-foreground shadow-md p-3 text-xs">
      <p className="font-bold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{p.value}{unit}</span>
        </p>
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function BESSConfig() {
  const { units, configs, sites, clients, projects: projectsData } = useApiMulti({
    units: bessApi.units,
    configs: bessApi.configs,
    sites: bessApi.sites,
    clients: bessApi.clients,
    projects: bessApi.projects,
  });

  // ── ALL hooks must be declared before any conditional return ────────────
  const [activeTab,    setActiveTab]    = useState('summary');
  const [numUnits,     setNumUnits]     = useState(1);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [coupling,     setCoupling]     = useState('AC');
  const [application,  setApplication]  = useState('tod_arbitrage');
  const [socMin,       setSocMin]       = useState(10);
  const [socMax,       setSocMax]       = useState(90);
  const [peakKw,       setPeakKw]       = useState('');
  const [tariffDiff,      setTariffDiff]      = useState(4.5);
  const [cycleDatasetKey, setCycleDatasetKey] = useState('q25c_365');

  // Load Profile tab state
  const [lpMode,       setLpMode]       = useState(null);      // 'bills'|'client'|'backup'|'manual'
  const [lpFile,       setLpFile]       = useState(null);
  const [lpParsing,    setLpParsing]    = useState(false);
  const [lpParsed,     setLpParsed]     = useState(null);
  const [lpParseErr,   setLpParseErr]   = useState(null);
  const [lpClientId,   setLpClientId]   = useState('');
  const [lpBackupHrs,  setLpBackupHrs]  = useState('4');
  const [lpLoadKw,     setLpLoadKw]     = useState('');
  const [lpSaved,      setLpSaved]      = useState(false);
  const [lpData,       setLpData]       = useState(null);  // normalised load data ready for AI
  const [lpRecommending, setLpRecommending] = useState(false);
  const [lpRec,        setLpRec]        = useState(null);  // AI recommendation result
  const [lpRecError,   setLpRecError]   = useState(null);
  const [lpVerified,   setLpVerified]   = useState(false);
  const [lpManualKwh,  setLpManualKwh]  = useState(Array(12).fill(''));
  const lpFileRef  = useRef(null);
  const tabsTopRef = useRef(null); // scroll anchor for tab switches

  // Scroll tabs panel into view whenever the active tab changes
  useEffect(() => {
    if (tabsTopRef.current) {
      tabsTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeTab]);

  // ── Sizing Tool state ──────────────────────────────────────────────────────
  const [szUseCase,       setSzUseCase]       = useState(null); // 'dg'|'tod'
  const [szLoadKw,        setSzLoadKw]        = useState('');
  const [szBackupHrs,     setSzBackupHrs]     = useState('4');
  const [szFuelCost,      setSzFuelCost]      = useState('90');
  const [szDgEff,         setSzDgEff]         = useState('0.31');
  const [szDgDays,        setSzDgDays]        = useState('300');
  const [szDispatchKwh,   setSzDispatchKwh]   = useState('');
  const [szPeakTariff,    setSzPeakTariff]    = useState('');
  const [szOffpeakTariff, setSzOffpeakTariff] = useState('');
  const [szPeakWindow,    setSzPeakWindow]    = useState('4');
  const [szTodDays,       setSzTodDays]       = useState('300');
  const [szResult,        setSzResult]        = useState(null);
  const [szAiNote,        setSzAiNote]        = useState(null);
  const [szAiLoading,     setSzAiLoading]     = useState(false);

  // ── Save Configuration state ──────────────────────────────────────────────
  const [saveSiteId,      setSaveSiteId]      = useState('');
  const [saveConfigName,  setSaveConfigName]  = useState('');
  const [saveSaving,      setSaveSaving]      = useState(false);
  const [saveSuccess,     setSaveSuccess]     = useState(false);

  const resetLp = () => {
    setLpMode(null); setLpFile(null); setLpParsed(null); setLpParseErr(null);
    setLpSaved(false); setLpData(null); setLpRec(null); setLpRecError(null);
    setLpVerified(false); setLpManualKwh(Array(12).fill(''));
  };

  const runRecommendation = async (data) => {
    setLpData(data);
    setLpRec(null); setLpRecError(null); setLpVerified(false);
    setLpRecommending(true);
    try {
      const result = await bessApi.recommendBess({ load_data: data, available_units: unitList });
      setLpRec(result?.data ?? result);
    } catch (err) {
      setLpRecError(err.message ?? 'Recommendation failed.');
    } finally {
      setLpRecommending(false);
    }
  };

  const applyRecommendation = () => {
    if (!lpRec?.primary) return;
    const unit = unitList.find(u => u.model === lpRec.primary.unit_model);
    if (unit) { setSelectedUnit(unit); setNumUnits(lpRec.primary.unit_count); }
    // Sync financial model with AI-assumed tariff diff if available
    const aiTariffDiff = lpRec?.financial_estimate?.tariff_diff_assumed_rs_kwh;
    if (aiTariffDiff && aiTariffDiff > 0) setTariffDiff(parseFloat(aiTariffDiff));
    setLpVerified(true);
  };

  const runSizing = async () => {
    let nominal_kwh = 0, nominal_kw = 0, annual_savings_inr = 0, dispatch_kwh_per_year = 0;
    if (szUseCase === 'dg') {
      const load = parseFloat(szLoadKw) || 0;
      const hrs  = parseFloat(szBackupHrs) || 0;
      const days = parseFloat(szDgDays) || 300;
      const fuel = parseFloat(szFuelCost) || 0;
      const eff  = parseFloat(szDgEff) || 0.31;
      const dg_cost_per_kwh   = eff * fuel;           // SFC(L/kWh) × ₹/L = ₹/kWh from DG
      const grid_charge_per_kwh = 3;                  // ₹3/kWh off-peak grid charge (fixed default)
      const net_benefit_kwh   = dg_cost_per_kwh - grid_charge_per_kwh;
      nominal_kwh           = (load * hrs) / 0.85;
      nominal_kw            = load;
      dispatch_kwh_per_year = load * hrs * days;
      annual_savings_inr    = dispatch_kwh_per_year * Math.max(0, net_benefit_kwh);
    } else {
      const dispatch = parseFloat(szDispatchKwh) || 0;
      const peak     = parseFloat(szPeakTariff) || 0;
      const offpeak  = parseFloat(szOffpeakTariff) || 0;
      const window   = parseFloat(szPeakWindow) || 4;
      const days     = parseFloat(szTodDays) || 300;
      nominal_kwh           = dispatch / 0.85;
      nominal_kw            = dispatch / window;
      dispatch_kwh_per_year = dispatch * days;
      annual_savings_inr    = dispatch * (peak - offpeak) * days;
    }
    const mkSlot = (count, kwh, kw, capex) => {
      const om1    = capex * 0.015;
      const netYr1 = annual_savings_inr - om1;
      let irrVal = null;
      if (capex > 0 && netYr1 > 0) {
        const flows = buildCashflows({ capex, nominalKwh: kwh, socWindow: (socMax - socMin) / 100, tariffDiff: annual_savings_inr / Math.max(1, dispatch_kwh_per_year / cyclesPerYear), dataset, years: 10 });
        const r = calcIRR(flows);
        irrVal = isFinite(r) ? Math.round(r * 100) : null;
      }
      return {
        count, kwh, kw, capex,
        headroom:    Math.round(((kwh - nominal_kwh) / nominal_kwh) * 100),
        payback:     capex > 0 && annual_savings_inr > 0 ? capex / annual_savings_inr : null,
        roi10:       irrVal,
        benefit_kwh: dispatch_kwh_per_year > 0 ? annual_savings_inr / dispatch_kwh_per_year : null,
      };
    };
    const allConfigs = unitList
      .filter(u => (u.energy_kwh ?? 0) > 0)
      .map(unit => {
        const ecoCount = Math.max(1, Math.ceil(nominal_kwh / unit.energy_kwh));
        const recCount = Math.max(1, Math.ceil((nominal_kwh * 1.15) / unit.energy_kwh));
        return {
          unit,
          eco: mkSlot(ecoCount, ecoCount * unit.energy_kwh, ecoCount * unit.power_kw, ecoCount * (unit.price_ex_gst || 0)),
          rec: mkSlot(recCount, recCount * unit.energy_kwh, recCount * unit.power_kw, recCount * (unit.price_ex_gst || 0)),
        };
      });
    setSzResult({ nominal_kwh, nominal_kw, annual_savings_inr, allConfigs });
    // Async AI narrative — non-blocking
    setSzAiNote(null); setSzAiLoading(true);
    try {
      const aiRes = await bessApi.recommendBess({
        load_data: {
          source: szUseCase === 'dg' ? 'DG Replacement' : 'ToD Arbitrage',
          nominal_kwh: Math.round(nominal_kwh), nominal_kw: Math.round(nominal_kw),
          annual_savings_inr: Math.round(annual_savings_inr), use_case: szUseCase,
        },
        available_units: unitList,
      });
      setSzAiNote(aiRes?.data ?? aiRes);
    } catch (_) { /* non-blocking */ } finally { setSzAiLoading(false); }
  };

  // Proposal modal state
  const [showPropModal,  setShowPropModal]  = useState(false);
  const [propClientId,   setPropClientId]   = useState('');
  const [propSiteId,     setPropSiteId]     = useState('');
  const [propNotes,      setPropNotes]      = useState('');
  const [propLoading,    setPropLoading]    = useState(false);
  const [propSuccess,    setPropSuccess]    = useState(null); // proposal number on success
  const [propProjectId,  setPropProjectId]  = useState('');

  // Derive everything here (values are 0/empty while loading — that is fine)
  const unitList   = units?.data  ?? [];
  const cfgList    = configs?.data ?? [];
  const activeUnit = selectedUnit ?? unitList[0] ?? null;
  const u          = activeUnit   ?? {};

  const totalPower   = numUnits * (u.power_kw     ?? 0);
  const totalEnergy  = numUnits * (u.energy_kwh   ?? 0);
  const totalPrice   = numUnits * (u.price_ex_gst ?? 0);
  const socWindow    = (socMax - socMin) / 100;
  const usableEnergy = totalEnergy * socWindow;   // nameplate usable (kWh)

  // ── Degradation-aware financial model ────────────────────────────────────
  const dataset        = CYCLE_DATASETS[cycleDatasetKey] ?? CYCLE_DATASETS.q25c_365;
  const cyclesPerYear  = dataset.cycles_per_year;
  const yr1            = dataset.years[0] ?? { soh: 1, rte: 0.93 };
  // Year-1 at-meter energy: apply SOH + RTE to usable nameplate
  const atMeterYr1    = usableEnergy * yr1.soh * yr1.rte;
  const grossSavYr1   = atMeterYr1 * tariffDiff * cyclesPerYear;
  const omYr1         = totalPrice * 0.015;        // 1.5% of CAPEX
  const annualSavings = grossSavYr1 - omYr1;       // Year-1 net savings (for display KPIs)

  // 10-year degraded cashflows for NPV/IRR
  const cashflows10 = useMemo(() => {
    if (!totalPrice || !usableEnergy || !tariffDiff) return [];
    return buildCashflows({ capex: totalPrice, nominalKwh: usableEnergy, socWindow: 1, tariffDiff, dataset, years: 10 });
  }, [totalPrice, usableEnergy, tariffDiff, cycleDatasetKey]); // eslint-disable-line

  const irrDecimal    = cashflows10.length > 1 && annualSavings > 0 ? calcIRR(cashflows10) : null;
  const irrPct        = irrDecimal != null && isFinite(irrDecimal) ? Math.round(irrDecimal * 100) : null;
  const simplePayback = totalPrice > 0 && annualSavings > 0 ? (totalPrice / annualSavings).toFixed(1) : '—';

  // 12-year cumulative cashflow for chart (uses degraded cashflows, extended by holding last-year net flat)
  const paybackData = useMemo(() => {
    if (!totalPrice || !annualSavings) return [];
    const flows = buildCashflows({ capex: totalPrice, nominalKwh: usableEnergy, socWindow: 1, tariffDiff, dataset, years: 12 });
    let cum = 0;
    return flows.slice(1).map((net, i) => {
      cum += net;
      return { year: `Y${i + 1}`, cashflow: Math.round(cum / 1e5), net: Math.round(net / 1e5) };
    });
  }, [totalPrice, usableEnergy, tariffDiff, cycleDatasetKey]); // eslint-disable-line

  // ── NOW it is safe to return early ──────────────────────────────────────
  const loading = units?.loading || configs?.loading || sites?.loading;
  if (loading) return <Spinner />;
  if (units?.error) return <ErrorBanner message={units.error} />;

  // Auto-select first unit once data loads (deferred to avoid setState-in-render)
  if (!selectedUnit && unitList.length > 0) {
    setTimeout(() => setSelectedUnit(unitList[0]), 0);
  }

  const clientList  = clients?.data      ?? [];
  const siteList    = sites?.data        ?? [];
  const projectList = projectsData?.data ?? [];

  async function handleGenerateProposal() {
    if (!propClientId) return;
    setPropLoading(true);
    try {
      const res = await bessApi.createProposal({
        client_id:     parseInt(propClientId),
        site_id:       (propSiteId && propSiteId !== 'none') ? parseInt(propSiteId) : null,
        project_id:    propProjectId ? parseInt(propProjectId) : null,
        capex_ex_gst:  totalPrice,
        annual_savings: Math.round(annualSavings),
        payback_years:  parseFloat(simplePayback) || null,
        irr_percent:    irrPct || null,
        notes: propNotes ||
          `${numUnits}× ${u.model ?? 'BESS'} | ${totalPower} kW / ${totalEnergy} kWh | ${coupling}-Coupled | ${appLabel}`,
        validity_days: 30,
      });
      setPropSuccess(res.data?.proposal_number ?? 'Created');
    } catch (e) {
      alert('Error creating proposal: ' + (e?.response?.data?.error ?? e.message));
    } finally {
      setPropLoading(false);
    }
  }

  // Non-hook derived values that need loaded data
  const energyBreakdown = [
    { name: 'Gross Capacity', value: totalEnergy,                  fill: '#E5E7EB' },
    { name: 'Usable (SoC)',   value: usableEnergy,                 fill: '#F26B4E' },
    { name: 'Reserve',        value: totalEnergy - usableEnergy,   fill: '#FDE0D9' },
  ];

  const scaleData = [1, 2, 4, 6, 8, 10].map((n) => ({
    units: `${n}×`,
    power: n * (u.power_kw     ?? 0),
    energy: n * (u.energy_kwh  ?? 0),
    capex: Math.round(n * (u.price_ex_gst ?? 0) / 1e5),
  }));

  const pieData    = [
    { name: 'BESS Hardware', value: 68 },
    { name: 'BMS / PCS',     value: 14 },
    { name: 'Civil & Infra', value: 10 },
    { name: 'Installation',  value: 8  },
  ];
  const PIE_COLORS = ['#F26B4E', '#6366F1', '#F59E0B', '#10B981'];

  const appLabel = APPLICATIONS.find((a) => a.value === application)?.label ?? '';

  async function handleSaveConfig() {
    if (!saveSiteId || !saveConfigName.trim()) return;
    setSaveSaving(true);
    try {
      await bessApi.createConfig({
        site_id:         parseInt(saveSiteId),
        config_name:     saveConfigName.trim(),
        num_units:       numUnits,
        total_power_kw:  totalPower,
        total_energy_kwh: totalEnergy,
        coupling_type:   coupling,
        application,
        soc_min:         socMin,
        soc_max:         socMax,
      });
      setSaveSuccess(true);
      setSaveConfigName('');
      setSaveSiteId('');
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (e) {
      alert('Save failed: ' + (e?.message ?? 'Unknown error'));
    } finally {
      setSaveSaving(false);
    }
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6 pb-8">

        {/* ── Page header ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-foreground">BESS Configurator</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              UnityESS live unit catalogue · financial model · ToD analysis
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-bold gap-1 px-3 py-1.5">
            <CheckCircle2 className="w-3 h-3 text-green-500" /> IEC 62619 · IS 16270
          </Badge>
        </div>

        {/* ── KPI strip ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SparkKpi label="Total Power"    value={`${totalPower.toLocaleString('en-IN')} kW`}    icon={Zap}      accent />
          <SparkKpi label="Total Energy"   value={`${totalEnergy.toLocaleString('en-IN')} kWh`}  icon={Battery} />
          <SparkKpi label="Usable Energy"  value={`${usableEnergy.toFixed(0)} kWh`}              icon={TrendingUp} />
          <SparkKpi label="CAPEX (Ex-GST)" value={inrCr(totalPrice)}  sub="+ 18% GST"            icon={BarChart3} />
        </div>

        {/* ── Main layout ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">

          {/* ── LEFT PANEL: configurator ─────────────────────────────── */}
          <div className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">

            {/* Unit selector */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-orange-500" /> Select Unit Model
                </CardTitle>
                <CardDescription>Live catalogue from database</CardDescription>
              </CardHeader>
              <CardContent className="p-2">
                {unitList.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No active units in database.</p>
                ) : (
                  <div className="max-h-[260px] overflow-y-auto flex flex-col gap-1 pr-1">
                    {unitList.map((unit) => {
                      const active = activeUnit?.id === unit.id;
                      return (
                        <button
                          key={unit.id}
                          onClick={() => setSelectedUnit(unit)}
                          className={`w-full text-left rounded-md border px-3 py-2 transition-all ${
                            active
                              ? 'border-orange-500 bg-orange-50'
                              : 'border-border hover:border-orange-300 bg-background'
                          }`}
                        >
                          <div className="flex justify-between items-center gap-2">
                            <div className="min-w-0">
                              <p className={`font-black text-xs truncate ${active ? 'text-orange-500' : 'text-foreground'}`}>
                                {unit.model}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {unit.power_kw} kW · {unit.energy_kwh} kWh
                              </p>
                            </div>
                            <p className={`font-black text-xs shrink-0 ${active ? 'text-orange-500' : 'text-muted-foreground'}`}>
                              {Number(unit.price_ex_gst) > 0 ? inrL(unit.price_ex_gst) : 'On request'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* System parameters */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="w-4 h-4 text-orange-500" /> System Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">

                {/* Number of units */}
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Number of Units</Label>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline" size="icon"
                      onClick={() => setNumUnits(Math.max(1, numUnits - 1))}
                      className="h-9 w-9 text-lg font-black"
                    >−</Button>
                    <span className="text-3xl font-black w-12 text-center">{numUnits}</span>
                    <Button
                      variant="outline" size="icon"
                      onClick={() => setNumUnits(numUnits + 1)}
                      className="h-9 w-9 text-lg font-black"
                    >+</Button>
                    <span className="text-xs text-muted-foreground ml-2">
                      = {totalPower} kW / {totalEnergy} kWh
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Coupling */}
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Coupling Type</Label>
                  <div className="flex gap-2">
                    {COUPLING.map((c) => (
                      <Button
                        key={c}
                        variant={coupling === c ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCoupling(c)}
                        className={coupling === c ? 'bg-orange-500 hover:bg-orange-600' : ''}
                      >
                        {c}-Coupled
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Application */}
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Application</Label>
                  <Select value={application} onValueChange={setApplication}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {APPLICATIONS.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full inline-block" style={{ background: a.color }} />
                            {a.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* SoC range */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      State of Charge Window
                    </Label>
                    <Badge variant="secondary" className="text-xs font-bold">
                      {socMin}% – {socMax}%
                    </Badge>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>SoC Min</span><span className="font-bold text-foreground">{socMin}%</span>
                      </div>
                      <Slider
                        min={5} max={30} step={1}
                        value={[socMin]}
                        onValueChange={([v]) => setSocMin(v)}
                        className="[&_[role=slider]]:bg-orange-500 [&_.bg-primary]:bg-orange-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>SoC Max</span><span className="font-bold text-foreground">{socMax}%</span>
                      </div>
                      <Slider
                        min={70} max={100} step={1}
                        value={[socMax]}
                        onValueChange={([v]) => setSocMax(v)}
                        className="[&_[role=slider]]:bg-orange-500 [&_.bg-primary]:bg-orange-500"
                      />
                    </div>
                  </div>
                  <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                    Usable window: <span className="font-bold text-foreground">{socMax - socMin}%</span>
                    {' '}→{' '}
                    <span className="font-bold text-orange-500">{usableEnergy.toFixed(0)} kWh</span> effective
                  </div>
                </div>

                <Separator />

                {/* Financial inputs */}
                <div className="space-y-3">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Financial Assumptions
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Peak Load (kW)</Label>
                      <Input
                        type="number" placeholder="e.g. 500"
                        value={peakKw}
                        onChange={(e) => setPeakKw(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1">
                        Tariff Δ (₹/kWh)
                        <Tooltip>
                          <TooltipTrigger><Info className="w-3 h-3 text-muted-foreground" /></TooltipTrigger>
                          <TooltipContent>Peak minus off-peak tariff spread used for arbitrage savings</TooltipContent>
                        </Tooltip>
                      </Label>
                      <Input
                        type="number" step="0.1"
                        value={tariffDiff}
                        onChange={(e) => setTariffDiff(+e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Cycle / Degradation Dataset */}
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Degradation Profile
                  </Label>
                  <div className="flex flex-col gap-1">
                    {Object.entries(CYCLE_DATASETS).map(([key, ds]) => (
                      <button
                        key={key}
                        onClick={() => setCycleDatasetKey(key)}
                        className={`w-full text-left rounded-md border px-3 py-2 transition-all text-xs ${
                          cycleDatasetKey === key
                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                            : 'border-border hover:border-orange-300 bg-background text-muted-foreground'
                        }`}
                      >
                        <span className="font-bold block">{ds.label}</span>
                        <span className="text-[10px] opacity-70">{ds.description}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground px-1">
                    Yr-1 RTE: <span className="font-bold text-foreground">{(yr1.rte * 100).toFixed(1)}%</span>
                    {' '}· Yr-1 SOH: <span className="font-bold text-foreground">{(yr1.soh * 100).toFixed(1)}%</span>
                    {' '}· {cyclesPerYear} cycles/yr
                  </p>
                </div>

              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT PANEL: analysis tabs ───────────────────────────── */}
          <div className="flex flex-col gap-4 min-w-0">
          <div ref={tabsTopRef} style={{ scrollMarginTop: '8px' }} />
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-4">
            <TabsList className="w-full flex overflow-x-auto gap-0.5 h-auto p-1">
              <TabsTrigger value="summary"     className="flex-1 min-w-fit text-xs px-3 py-1.5 whitespace-nowrap">Summary</TabsTrigger>
              <TabsTrigger value="financials"  className="flex-1 min-w-fit text-xs px-3 py-1.5 whitespace-nowrap">Financials</TabsTrigger>
              <TabsTrigger value="tod"         className="flex-1 min-w-fit text-xs px-3 py-1.5 whitespace-nowrap">ToD</TabsTrigger>
              <TabsTrigger value="specs"       className="flex-1 min-w-fit text-xs px-3 py-1.5 whitespace-nowrap">Specs</TabsTrigger>
              <TabsTrigger value="loadprofile" className="flex-1 min-w-fit text-xs px-3 py-1.5 whitespace-nowrap">Load Profile</TabsTrigger>
              <TabsTrigger value="sizing"      className="flex-1 min-w-fit text-xs px-3 py-1.5 whitespace-nowrap">Sizing</TabsTrigger>
            </TabsList>

            {/* ── TAB: Summary ─────────────────────────────────────── */}
            <TabsContent value="summary" className="flex flex-col gap-4 mt-0">

              {/* Dark hero card */}
              <Card className="bg-[#2D2D2D] text-white border-0">
                <CardContent className="p-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">System Summary</p>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {[
                      { label: 'Total Power',    value: `${totalPower.toLocaleString('en-IN')} kW` },
                      { label: 'Total Energy',   value: `${totalEnergy.toLocaleString('en-IN')} kWh` },
                      { label: 'Usable Energy',  value: `${usableEnergy.toFixed(0)} kWh` },
                      { label: 'Configuration',  value: `${numUnits} × ${u.model ?? '—'}` },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-white/5 rounded-lg p-4">
                        <p className="text-[11px] text-gray-400 mb-1">{label}</p>
                        <p className="text-lg font-black">{value}</p>
                      </div>
                    ))}
                  </div>
                  <Separator className="bg-white/10 mb-4" />
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs text-gray-400">Indicative CAPEX (Ex-GST)</p>
                      <p className="text-4xl font-black text-orange-500">{inrCr(totalPrice)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">+ 18% GST = {inrCr(totalPrice * 1.18)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Simple Payback</p>
                      <p className="text-3xl font-black text-white">{simplePayback} yrs</p>
                      <p className="text-xs text-gray-500 mt-0.5">{cyclesPerYear} cycles/yr assumed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Energy breakdown + pie */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Energy Breakdown</CardTitle>
                    <CardDescription>Gross vs usable capacity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {energyBreakdown.map((item) => (
                        <div key={item.name}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">{item.name}</span>
                            <span className="font-bold">{item.value.toFixed(0)} kWh</span>
                          </div>
                          <Progress
                            value={totalEnergy ? (item.value / totalEnergy) * 100 : 0}
                            className="h-2"
                            indicatorClassName=""
                            style={{ '--tw-bg': item.fill }}
                          />
                        </div>
                      ))}
                    </div>
                    <Separator className="my-4" />
                    <div className="text-xs text-muted-foreground">
                      SoC window <span className="font-bold text-foreground">{socMin}–{socMax}%</span>
                      {' '}→ efficiency factor{' '}
                      <span className="font-bold text-orange-500">{((socMax - socMin)).toFixed(0)}%</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">CAPEX Split</CardTitle>
                    <CardDescription>Typical cost breakdown</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center">
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%" cy="50%"
                          innerRadius={45} outerRadius={72}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i]} />
                          ))}
                        </Pie>
                        <ReTooltip formatter={(v, n) => [`${v}%`, n]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 w-full">
                      {pieData.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-1.5 text-[11px]">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i] }} />
                          <span className="text-muted-foreground">{d.name}</span>
                          <span className="font-bold ml-auto">{d.value}%</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Scale chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-orange-500" /> Scalability — {u.model ?? '—'}
                  </CardTitle>
                  <CardDescription>Energy (kWh) and CAPEX (₹ L) vs number of units</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={scaleData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="units" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                      <ReTooltip content={<ChartTooltip />} />
                      <Bar yAxisId="left"  dataKey="energy" name="Energy (kWh)" fill="#F26B4E" radius={[4,4,0,0]} />
                      <Bar yAxisId="right" dataKey="capex"  name="CAPEX (₹L)"  fill="#6366F1" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* ── Save Configuration ──────────────────────────────── */}
              <Card className="border-orange-200 bg-orange-50/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Settings className="w-4 h-4 text-orange-500" /> Save Configuration to Database
                  </CardTitle>
                  <CardDescription>Link this configuration to a site for future reference and proposals</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {saveSuccess && (
                    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <CheckCircle2 className="w-4 h-4" /> Configuration saved successfully.
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted-foreground">Site</label>
                      <select
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={saveSiteId}
                        onChange={e => setSaveSiteId(e.target.value)}
                      >
                        <option value="">Select site…</option>
                        {siteList.map(s => (
                          <option key={s.id} value={s.id}>{s.site_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted-foreground">Config Name</label>
                      <input
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        placeholder={`${numUnits}× ${u.model ?? 'BESS'} – ${appLabel}`}
                        value={saveConfigName}
                        onChange={e => setSaveConfigName(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    className="bg-orange-500 hover:bg-orange-600 h-9 text-sm font-bold"
                    onClick={handleSaveConfig}
                    disabled={saveSaving || !saveSiteId || !saveConfigName.trim()}
                  >
                    {saveSaving ? 'Saving…' : 'Save Configuration'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── TAB: Financials ───────────────────────────────────── */}
            <TabsContent value="financials" className="flex flex-col gap-4 mt-0">

              <div className="grid grid-cols-3 gap-4">
                <SparkKpi
                  label="Annual Savings"
                  value={inrL(annualSavings)}
                  sub={`${cyclesPerYear} cycles/yr`}
                  icon={TrendingUp} accent
                />
                <SparkKpi
                  label="Simple Payback"
                  value={`${simplePayback} yrs`}
                  sub="At current tariff Δ"
                  icon={Clock}
                />
                <SparkKpi
                  label="IRR (10-yr NPV)"
                  value={irrPct != null && irrPct > 0 ? `${irrPct}%` : '—'}
                  sub="With degradation + O&M"
                  icon={Award}
                />
              </div>

              {/* Cumulative cash flow */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Cumulative Cash Flow</CardTitle>
                  <CardDescription>
                    12-year · ₹ Lakhs · degradation + O&M included · {dataset.label}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={paybackData}>
                      <defs>
                        <linearGradient id="cfGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#F26B4E" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#F26B4E" stopOpacity={0}   />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} unit=" L" />
                      <ReTooltip
                        formatter={(v) => [`₹${v} L`, 'Cumulative P/L']}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      {/* Break-even reference line */}
                      <Area
                        type="monotone" dataKey="cashflow"
                        stroke="#F26B4E" strokeWidth={2.5}
                        fill="url(#cfGrad)"
                        dot={{ r: 3, fill: '#F26B4E' }}
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-3 h-3 rounded-full bg-orange-500 shrink-0" />
                    Break-even at <span className="font-bold text-foreground mx-1">{simplePayback} years</span>
                    — cumulative savings thereafter = revenue
                  </div>
                </CardContent>
              </Card>

              {/* Assumptions table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Model Assumptions</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parameter</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        ['Application',      appLabel,                                    'User-selected'],
                        ['Usable Energy',    `${usableEnergy.toFixed(0)} kWh`,            `SoC ${socMin}–${socMax}%`],
                        ['Yr-1 At Meter',    `${atMeterYr1.toFixed(0)} kWh`,              `After SOH ${(yr1.soh*100).toFixed(1)}% + RTE ${(yr1.rte*100).toFixed(1)}%`],
                        ['Cycle Profile',    dataset.label,                               `${cyclesPerYear} cycles/yr`],
                        ['Tariff Δ',         `₹${tariffDiff}/kWh`,                       'Peak − off-peak spread'],
                        ['Yr-1 Gross Sav.',  inrL(grossSavYr1),                           'Before O&M'],
                        ['O&M Yr-1',         inrL(omYr1),                                 '1.5% of CAPEX, +3%/yr'],
                        ['Yr-1 Net Savings', inrL(annualSavings),                         'Post O&M'],
                        ['IRR (10-yr NPV)',  irrPct != null ? `${irrPct}%` : '—',        'Degradation + O&M included'],
                        ['CAPEX (Ex-GST)',   inrCr(totalPrice),                           'Indicative ex-works'],
                        ['GST',              '18%',                                        'Applicable on supply'],
                      ].map(([p, v, n]) => (
                        <TableRow key={p}>
                          <TableCell className="font-medium text-xs">{p}</TableCell>
                          <TableCell className="font-black text-xs text-orange-500">{v}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{n}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── TAB: ToD Analysis ─────────────────────────────────── */}
            <TabsContent value="tod" className="flex flex-col gap-4 mt-0">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Delhi ToD Tariff Profile (Illustrative)</CardTitle>
                  <CardDescription>
                    Charge during off-peak · discharge during peak · spread = ₹{tariffDiff}/kWh
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={TOD_SLOTS} barSize={26}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} unit=" ₹" />
                      <ReTooltip
                        formatter={(v, n) => [`₹${v}/kWh`, n]}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Legend />
                      <Bar dataKey="buy" name="Buy (Grid)" radius={[3,3,0,0]}>
                        {TOD_SLOTS.map((s, i) => (
                          <Cell key={i} fill={SLOT_COLORS[s.slot]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {/* Legend */}
                  <div className="flex gap-4 mt-3 flex-wrap">
                    {Object.entries(SLOT_COLORS).map(([slot, color]) => (
                      <div key={slot} className="flex items-center gap-1.5 text-xs">
                        <span className="w-3 h-3 rounded-sm" style={{ background: color }} />
                        <span className="text-muted-foreground">{slot}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Daily arbitrage potential */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: 'Daily Arbitrage Revenue',
                    value: `₹${(usableEnergy * tariffDiff).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
                    sub: `${usableEnergy.toFixed(0)} kWh × ₹${tariffDiff}`,
                  },
                  {
                    label: 'Monthly Revenue',
                    value: `₹${((atMeterYr1 * tariffDiff * 25) / 1e3).toFixed(1)} K`,
                    sub: '25 arbitrage days/month · Yr-1',
                  },
                  {
                    label: 'Annual Net (Yr-1)',
                    value: inrL(annualSavings),
                    sub: `Post O&M · ${cyclesPerYear} cycles/yr`,
                  },
                ].map((item) => (
                  <Card key={item.label}>
                    <CardContent className="p-5">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground font-bold mb-1">{item.label}</p>
                      <p className="text-xl font-black text-orange-500">{item.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Optimal Dispatch Strategy</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { time: '00:00–06:00', action: 'Charge',    slot: 'Off-peak', rate: '₹5.2/kWh', bg: 'bg-green-50',  text: 'text-green-700' },
                      { time: '06:00–08:00', action: 'Hold',      slot: 'Shoulder', rate: '₹6.8/kWh', bg: 'bg-amber-50',  text: 'text-amber-700' },
                      { time: '08:00–12:00', action: 'Discharge', slot: 'Peak',     rate: '₹9.5/kWh', bg: 'bg-red-50',    text: 'text-orange-600' },
                      { time: '12:00–16:00', action: 'Partial',   slot: 'Shoulder', rate: '₹7.2/kWh', bg: 'bg-amber-50',  text: 'text-amber-700' },
                      { time: '16:00–22:00', action: 'Discharge', slot: 'Peak',     rate: '₹11.5/kWh', bg: 'bg-red-50',   text: 'text-orange-600' },
                      { time: '22:00–24:00', action: 'Charge',    slot: 'Off-peak', rate: '₹5.5/kWh', bg: 'bg-green-50',  text: 'text-green-700' },
                    ].map((row) => (
                      <div key={row.time} className={`flex items-center justify-between rounded-lg px-4 py-2.5 ${row.bg}`}>
                        <span className="text-xs font-bold text-muted-foreground w-28">{row.time}</span>
                        <Badge variant="outline" className={`${row.text} border-current text-xs`}>{row.action}</Badge>
                        <span className="text-xs text-muted-foreground">{row.slot}</span>
                        <span className={`text-xs font-black ${row.text}`}>{row.rate}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── TAB: Specs ────────────────────────────────────────── */}
            <TabsContent value="specs" className="flex flex-col gap-4 mt-0">

              {/* Spec cards grid */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Battery,    label: 'Chemistry',     value: `${u.chemistry ?? '—'} (LFP)`,     desc: 'IEC 62619 certified' },
                  { icon: Layers,     label: 'Form Factor',   value: u.form_factor ?? '—',               desc: 'Containerised, weatherproof' },
                  { icon: Weight,     label: 'System Weight', value: u.weight_kg ? `${(u.weight_kg * numUnits / 1000).toFixed(1)} t` : '—', desc: `${numUnits} units combined` },
                  { icon: Thermometer, label: 'Coupling',     value: `${coupling}-Coupled`,              desc: 'IEC 62477 compliant' },
                  { icon: Wifi,       label: 'Communication', value: 'CAN · RS485 · Modbus TCP',         desc: 'IEC 61850 SCADA ready' },
                  { icon: Shield,     label: 'Certifications', value: 'IEC · IS · BIS',                  desc: 'IEC 62619 · IS 16270 · BIS' },
                ].map(({ icon: Icon, label, value, desc }) => (
                  <Card key={label} className="hover:border-orange-300 transition-colors">
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className="rounded-md bg-orange-50 p-2 shrink-0">
                        <Icon className="w-4 h-4 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">{label}</p>
                        <p className="text-sm font-black mt-0.5">{value}</p>
                        <p className="text-[11px] text-muted-foreground">{desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Full spec table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Complete Specifications — {u.model ?? '—'}</CardTitle>
                  <CardDescription>× {numUnits} units</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableBody>
                      {[
                        ['Model',              u.model ?? '—'],
                        ['Rated Power',        `${u.power_kw ?? '—'} kW (per unit)`],
                        ['Rated Energy',       `${u.energy_kwh ?? '—'} kWh (per unit)`],
                        ['System Power',       `${totalPower} kW`],
                        ['System Energy',      `${totalEnergy} kWh`],
                        ['Usable Energy',      `${usableEnergy.toFixed(0)} kWh (SoC ${socMin}–${socMax}%)`],
                        ['Chemistry',          `${u.chemistry ?? '—'} (Lithium Iron Phosphate)`],
                        ['Form Factor',        u.form_factor ?? '—'],
                        ['Coupling',           `${coupling}-Coupled`],
                        ['Application',        appLabel],
                        ['Communication',      'CAN / RS485 / Modbus TCP / IEC 61850'],
                        ['Safety Standards',   'IEC 62619, IEC 62477, IS 16270'],
                        ['Pricing (Ex-GST)',   `${inrCr(totalPrice)} for ${numUnits} units`],
                        ['GST (18%)',          inrCr(totalPrice * 0.18)],
                        ['Total (Inc. GST)',   inrCr(totalPrice * 1.18)],
                      ].map(([k, v]) => (
                        <TableRow key={k}>
                          <TableCell className="text-xs text-muted-foreground font-semibold w-44">{k}</TableCell>
                          <TableCell className="text-xs font-bold">{v}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Button
                className="w-full bg-orange-500 hover:bg-orange-600 h-11 text-sm font-bold"
                onClick={() => { setPropSuccess(null); setShowPropModal(true); }}
                disabled={!activeUnit}
              >
                Generate Commercial Proposal <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </TabsContent>

            {/* ── TAB: Load Profile ─────────────────────────────────── */}
            <TabsContent value="loadprofile" className="flex flex-col gap-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-orange-500" />
                    Load Profile &amp; AI Sizing
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Provide load data → AI recommends capacity → verify and apply to configurator.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">

                  {/* ── STATE: Verified ── */}
                  {lpVerified && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-xs text-green-700 font-bold">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        Applied — {numUnits}× {activeUnit?.model} ({totalEnergy.toLocaleString('en-IN')} kWh / {totalPower.toLocaleString('en-IN')} kW) is now active.
                      </div>
                      <Button variant="outline" className="h-8 text-xs" onClick={resetLp}>
                        <X className="w-3 h-3 mr-1" /> Reset Load Profile
                      </Button>
                    </div>
                  )}

                  {/* ── STATE: Analysis Sheet ── */}
                  {!lpVerified && lpRec && (
                    <div className="flex flex-col gap-4">
                      {/* Header row */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-orange-500" /> AI Sizing Analysis
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-orange-100 text-orange-700 text-[10px] border-0">{lpData?.source}</Badge>
                          <button onClick={resetLp} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                            <X className="w-3 h-3" /> Reset
                          </button>
                        </div>
                      </div>

                      {/* Load summary tiles */}
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          ['Total kWh', lpData?.total_monthly_kwh ? `${Number(lpData.total_monthly_kwh).toLocaleString('en-IN')} kWh/mo` : lpData?.required_kwh ? `${Number(lpData.required_kwh).toFixed(0)} kWh` : lpData?.avg_monthly_kwh ? `${Math.round(lpData.avg_monthly_kwh).toLocaleString('en-IN')} kWh/mo` : '—'],
                          ['Max Demand', lpData?.max_demand_kw ? `${lpData.max_demand_kw} kW` : lpData?.critical_load_kw ? `${lpData.critical_load_kw} kW` : '—'],
                          ['Key Driver', lpRec.sizing_logic?.key_driver ?? '—'],
                          ['Application', lpRec.primary?.application?.replace(/_/g,' ') ?? '—'],
                        ].map(([lbl, val]) => (
                          <div key={lbl} className="bg-muted/60 rounded-lg px-3 py-2 text-center">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{lbl}</p>
                            <p className="text-xs font-bold text-foreground mt-0.5 capitalize">{val}</p>
                          </div>
                        ))}
                      </div>

                      {/* Primary recommendation */}
                      <Card className="border-orange-300 bg-orange-50/50">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500 mb-1">Recommended Configuration</p>
                              <p className="text-lg font-black text-foreground">
                                {lpRec.primary.unit_count} × {lpRec.primary.unit_model}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {lpRec.primary.total_kwh?.toLocaleString('en-IN')} kWh &nbsp;·&nbsp; {lpRec.primary.total_kw?.toLocaleString('en-IN')} kW
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-muted-foreground uppercase">CAPEX Ex-GST</p>
                              <p className="text-base font-black text-foreground">
                                {inrCr(lpRec.primary.unit_count * (unitList.find(u => u.model === lpRec.primary.unit_model)?.price_ex_gst ?? 0))}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                + GST = {inrCr(lpRec.primary.unit_count * (unitList.find(u => u.model === lpRec.primary.unit_model)?.price_ex_gst ?? 0) * 1.18)}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed border-t border-orange-200 pt-3">
                            {lpRec.primary.reasoning}
                          </p>
                        </CardContent>
                      </Card>

                      {/* Sizing options table */}
                      <div className="flex flex-col gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">All Sizing Options</p>
                        <div className="rounded-xl border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/60 hover:bg-muted/60">
                                <TableHead className="text-[10px] uppercase font-bold h-8 py-0">Option</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold h-8 py-0">Configuration</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold h-8 py-0 text-right">kWh</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold h-8 py-0 text-right">CAPEX</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold h-8 py-0 text-right">Savings/yr</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold h-8 py-0 text-right">Payback</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {/* Primary */}
                              <TableRow className="bg-orange-50/60">
                                <TableCell className="py-2 text-xs font-bold text-orange-600">★ Recommended</TableCell>
                                <TableCell className="py-2 text-xs font-bold">{lpRec.primary.unit_count}× {lpRec.primary.unit_model}</TableCell>
                                <TableCell className="py-2 text-xs text-right">{(lpRec.primary.total_kwh ?? 0).toLocaleString('en-IN')}</TableCell>
                                <TableCell className="py-2 text-xs text-right font-bold">{inrCr(lpRec.primary.unit_count * (unitList.find(u => u.model === lpRec.primary.unit_model)?.price_ex_gst ?? 0))}</TableCell>
                                <TableCell className="py-2 text-xs text-right text-green-600 font-bold">{inrL(lpRec.financial_estimate?.annual_savings_inr ?? 0)}</TableCell>
                                <TableCell className="py-2 text-xs text-right font-bold">{lpRec.financial_estimate?.simple_payback_years?.toFixed(1) ?? '—'} yrs</TableCell>
                              </TableRow>
                              {/* Alternatives */}
                              {(lpRec.alternatives ?? []).map((alt, i) => {
                                const altUnit = unitList.find(u => u.model === alt.unit_model);
                                const altCapex = alt.unit_count * (altUnit?.price_ex_gst ?? 0);
                                return (
                                  <TableRow key={i}>
                                    <TableCell className="py-2 text-xs text-muted-foreground">{alt.label}</TableCell>
                                    <TableCell className="py-2 text-xs">{alt.unit_count}× {alt.unit_model}</TableCell>
                                    <TableCell className="py-2 text-xs text-right">{(alt.total_kwh ?? alt.unit_count * (altUnit?.energy_kwh ?? 0)).toLocaleString('en-IN')}</TableCell>
                                    <TableCell className="py-2 text-xs text-right">{inrCr(altCapex)}</TableCell>
                                    <TableCell className="py-2 text-xs text-right text-muted-foreground">—</TableCell>
                                    <TableCell className="py-2 text-xs text-right text-muted-foreground">—</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                        {lpRec.sizing_logic?.rationale && (
                          <p className="text-[10px] text-muted-foreground italic px-1 leading-relaxed">{lpRec.sizing_logic.rationale}</p>
                        )}
                        {lpRec.financial_estimate?.assumptions && (
                          <p className="text-[10px] text-muted-foreground italic px-1">Assumptions: {lpRec.financial_estimate.assumptions}</p>
                        )}
                      </div>

                      {/* Verification buttons */}
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 bg-[#2D2D2D] hover:bg-black h-10 text-xs font-bold"
                          onClick={applyRecommendation}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Verify &amp; Apply to Configurator
                        </Button>
                        <Button
                          variant="outline"
                          className="h-10 text-xs px-4"
                          onClick={() => { setLpRec(null); setLpData(null); }}
                        >
                          Recalculate
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ── STATE: AI Loading ── */}
                  {!lpVerified && !lpRec && lpRecommending && (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                      <p className="text-xs font-bold text-foreground">Gemini is analysing your load data…</p>
                      <p className="text-[11px] text-muted-foreground">Running sizing calculations and financial model</p>
                    </div>
                  )}

                  {/* ── STATE: Error ── */}
                  {lpRecError && !lpRecommending && (
                    <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{lpRecError}</div>
                  )}

                  {/* ── STATE: Data captured, ready to analyse ── */}
                  {!lpVerified && !lpRec && !lpRecommending && lpData && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                        <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-foreground">Load data captured from {lpData.source}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {lpData.total_monthly_kwh ? `${Number(lpData.total_monthly_kwh).toLocaleString('en-IN')} kWh/month` : ''}
                            {lpData.max_demand_kw ? ` · ${lpData.max_demand_kw} kW max demand` : ''}
                            {lpData.critical_load_kw ? `${lpData.critical_load_kw} kW × ${lpData.backup_hours}h backup` : ''}
                            {lpData.avg_monthly_kwh ? `${Math.round(lpData.avg_monthly_kwh).toLocaleString('en-IN')} kWh/month avg` : ''}
                          </p>
                        </div>
                      </div>
                      <Button
                        className="w-full bg-orange-500 hover:bg-orange-600 h-10 text-xs font-bold"
                        onClick={() => runRecommendation(lpData)}
                      >
                        <Cpu className="w-3.5 h-3.5 mr-1.5" /> Generate AI Sizing Recommendation
                      </Button>
                      <button
                        className="text-xs text-center text-muted-foreground hover:text-foreground underline underline-offset-2"
                        onClick={() => { setLpData(null); }}
                      >
                        Change input data
                      </button>
                    </div>
                  )}

                  {/* ── INPUT MODES (only when no data captured and not showing results) ── */}
                  {!lpVerified && !lpRec && !lpRecommending && !lpData && (
                    <>
                  {/* Mode selector cards */}
                  {!lpMode && (
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: 'bills',  icon: FileText, label: 'Bills / Documents', desc: 'Upload EB bills or PDFs — AI extracts kWh, demand, ToD data automatically.' },
                        { key: 'client', icon: User,     label: 'Client Data',        desc: 'Pull from an existing client\'s saved load profile in the database.' },
                        { key: 'backup', icon: Clock,    label: 'Backup Requirement', desc: 'Specify load kW and desired backup hours — system calculates kWh needed.' },
                        { key: 'manual', icon: Upload,   label: 'Manual Input Sheet', desc: 'Enter hourly/monthly consumption values directly or via the Google Form.' },
                      ].map(({ key, icon: Icon, label, desc }) => (
                        <button
                          key={key}
                          onClick={() => { setLpMode(key); setLpParsed(null); setLpParseErr(null); setLpFile(null); setLpSaved(false); }}
                          className="text-left p-4 rounded-xl border-2 border-border hover:border-orange-400 hover:bg-orange-50/50 transition-all group"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                              <Icon className="w-4 h-4 text-orange-500" />
                            </div>
                            <span className="text-xs font-bold text-foreground">{label}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ── MODE: Bills / Documents ── */}
                  {lpMode === 'bills' && (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setLpMode(null); setLpFile(null); setLpParsed(null); setLpParseErr(null); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                          <X className="w-3 h-3" /> Back
                        </button>
                        <span className="text-xs font-bold text-foreground">Bills / Documents — AI Extraction</span>
                      </div>

                      {/* Sub-option: manual entry or document upload */}
                      <div className="grid grid-cols-2 gap-3">
                        <a
                          href="https://docs.google.com/forms/d/e/1FAIpQLSfffMETWxybmqb83ss9qTXdcAkRlXfvpE5HvbzdICXTERRU2w/viewform?usp=sharing"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-orange-400 hover:bg-orange-50/50 transition-all text-center"
                        >
                          <Link2 className="w-5 h-5 text-orange-500" />
                          <span className="text-xs font-bold">Manual Entry Form</span>
                          <span className="text-[10px] text-muted-foreground">Open Google Form → client fills monthly data</span>
                        </a>
                        <button
                          onClick={() => lpFileRef.current?.click()}
                          className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-orange-300 hover:border-orange-500 hover:bg-orange-50/50 transition-all text-center"
                        >
                          <Upload className="w-5 h-5 text-orange-500" />
                          <span className="text-xs font-bold">Upload Document</span>
                          <span className="text-[10px] text-muted-foreground">PDF, image, or Excel bill — Gemini AI reads it</span>
                        </button>
                      </div>

                      <input
                        ref={lpFileRef}
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setLpFile(file);
                          setLpParsed(null);
                          setLpParseErr(null);
                          setLpParsing(true);
                          (async () => {
                            try {
                              const base64 = await new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = (ev) => resolve(ev.target.result.split(',')[1]);
                                reader.onerror = () => reject(new Error('File read error.'));
                                reader.readAsDataURL(file);
                              });
                              const result = await bessApi.parseBill({ fileData: base64, mimeType: file.type });
                              setLpParsed(result);
                            } catch (err) {
                              setLpParseErr(err.message ?? 'Gemini parsing failed.');
                            } finally {
                              setLpParsing(false);
                            }
                          })();
                        }}
                      />

                      {lpFile && !lpParsed && !lpParsing && !lpParseErr && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
                          <FileText className="w-4 h-4" /> {lpFile.name}
                        </div>
                      )}

                      {lpParsing && (
                        <div className="flex items-center gap-2 text-xs text-orange-500 bg-orange-50 rounded-lg px-3 py-3">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Gemini is reading the document…
                        </div>
                      )}

                      {lpParseErr && (
                        <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{lpParseErr}</div>
                      )}

                      {lpParsed && (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2 font-bold">
                            <CheckCircle2 className="w-4 h-4" /> Extraction complete — review below
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              ['Consumer',         lpParsed.consumer_name],
                              ['DISCOM',            lpParsed.discom],
                              ['Tariff Category',  lpParsed.tariff_category],
                              ['Month / Year',     lpParsed.month && lpParsed.year ? `${lpParsed.month}/${lpParsed.year}` : '—'],
                              ['Total Units (kWh)',lpParsed.total_units_kwh ? `${lpParsed.total_units_kwh} kWh` : '—'],
                              ['Max Demand',       lpParsed.max_demand_kw    ? `${lpParsed.max_demand_kw} kW`  : '—'],
                              ['Peak kWh',         lpParsed.tod_peak_kwh     ? `${lpParsed.tod_peak_kwh} kWh`  : '—'],
                              ['Off-Peak kWh',     lpParsed.tod_offpeak_kwh  ? `${lpParsed.tod_offpeak_kwh} kWh` : '—'],
                              ['Night kWh',        lpParsed.tod_night_kwh    ? `${lpParsed.tod_night_kwh} kWh`  : '—'],
                              ['Contract Demand',  lpParsed.contract_demand_kva ? `${lpParsed.contract_demand_kva} kVA` : '—'],
                              ['Sanctioned Load',  lpParsed.sanctioned_load_kva ? `${lpParsed.sanctioned_load_kva} kVA` : '—'],
                              ['Total Bill',       lpParsed.total_amount_inr ? `₹${Number(lpParsed.total_amount_inr).toLocaleString('en-IN')}` : '—'],
                            ].map(([lbl, val]) => (
                              <div key={lbl} className="bg-muted/60 rounded-lg px-3 py-2">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{lbl}</p>
                                <p className="text-xs font-bold text-foreground mt-0.5">{val ?? '—'}</p>
                              </div>
                            ))}
                          </div>
                          <Button
                            className="w-full bg-orange-500 hover:bg-orange-600 h-10 text-xs font-bold"
                            onClick={() => runRecommendation({
                              source: 'EB Bill',
                              total_monthly_kwh: lpParsed.total_units_kwh,
                              max_demand_kw:     lpParsed.max_demand_kw,
                              peak_kwh:          lpParsed.tod_peak_kwh,
                              offpeak_kwh:       lpParsed.tod_offpeak_kwh,
                              night_kwh:         lpParsed.tod_night_kwh,
                              contract_demand_kva: lpParsed.contract_demand_kva,
                              tariff_category:   lpParsed.tariff_category,
                              discom:            lpParsed.discom,
                              consumer_name:     lpParsed.consumer_name,
                            })}
                          >
                            <Cpu className="w-3.5 h-3.5 mr-1.5" /> Use this bill — Get AI Recommendation
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── MODE: Client Data ── */}
                  {lpMode === 'client' && (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setLpMode(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                          <X className="w-3 h-3" /> Back
                        </button>
                        <span className="text-xs font-bold text-foreground">Client Load Profile</span>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Select Client</Label>
                        <Select value={lpClientId} onValueChange={setLpClientId}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Choose client…" />
                          </SelectTrigger>
                          <SelectContent>
                            {(clients?.data ?? []).map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.company_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {lpClientId && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-700">
                          Load profile data for this client will be pulled from their site's saved records.
                          Navigate to the <strong>Sites</strong> page to add or review load profiles per site.
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── MODE: Backup Requirement ── */}
                  {lpMode === 'backup' && (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setLpMode(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                          <X className="w-3 h-3" /> Back
                        </button>
                        <span className="text-xs font-bold text-foreground">Backup Requirement Calculator</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Critical Load (kW)</Label>
                          <Input
                            type="number" min="0" placeholder="e.g. 250"
                            className="h-9 text-xs"
                            value={lpLoadKw}
                            onChange={e => setLpLoadKw(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Backup Hours Needed</Label>
                          <Input
                            type="number" min="0.5" step="0.5" placeholder="e.g. 4"
                            className="h-9 text-xs"
                            value={lpBackupHrs}
                            onChange={e => setLpBackupHrs(e.target.value)}
                          />
                        </div>
                      </div>
                      {lpLoadKw && lpBackupHrs && (
                        <div className="flex flex-col gap-3">
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              ['Required Energy', `${(parseFloat(lpLoadKw) * parseFloat(lpBackupHrs)).toFixed(0)} kWh`],
                              ['At 80% DoD',      `${(parseFloat(lpLoadKw) * parseFloat(lpBackupHrs) / 0.8).toFixed(0)} kWh`],
                              ['Units (est.)',    `${Math.ceil((parseFloat(lpLoadKw) * parseFloat(lpBackupHrs) / 0.8) / 261)} × UESS-125`],
                            ].map(([lbl, val]) => (
                              <div key={lbl} className="bg-muted/60 rounded-lg px-3 py-2 text-center">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{lbl}</p>
                                <p className="text-sm font-black text-orange-500 mt-0.5">{val}</p>
                              </div>
                            ))}
                          </div>
                          <Button
                            className="w-full bg-orange-500 hover:bg-orange-600 h-10 text-xs font-bold"
                            onClick={() => runRecommendation({
                              source: 'Backup Requirement',
                              critical_load_kw:   parseFloat(lpLoadKw),
                              backup_hours:        parseFloat(lpBackupHrs),
                              required_kwh:        parseFloat(lpLoadKw) * parseFloat(lpBackupHrs),
                              required_kwh_at_80dod: parseFloat(lpLoadKw) * parseFloat(lpBackupHrs) / 0.8,
                            })}
                          >
                            <Cpu className="w-3.5 h-3.5 mr-1.5" /> Get AI Recommendation
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── MODE: Manual Input Sheet ── */}
                  {lpMode === 'manual' && (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setLpMode(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                          <X className="w-3 h-3" /> Back
                        </button>
                        <span className="text-xs font-bold text-foreground">Manual Input Sheet</span>
                      </div>
                      <a
                        href="https://docs.google.com/forms/d/e/1FAIpQLSfffMETWxybmqb83ss9qTXdcAkRlXfvpE5HvbzdICXTERRU2w/viewform?usp=sharing"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-xl border-2 border-orange-200 hover:border-orange-400 hover:bg-orange-50/50 transition-all"
                      >
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                          <Link2 className="w-4 h-4 text-orange-500" />
                        </div>
                        <div>
                          <p className="text-xs font-bold">UnityESS BESS Intake Form</p>
                          <p className="text-[10px] text-muted-foreground">Send this to the client to fill their load data</p>
                        </div>
                      </a>
                      <Separator />
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Or enter monthly totals manually</p>
                      <div className="grid grid-cols-3 gap-2">
                        {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                          <div key={m} className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">{m} (kWh)</Label>
                            <Input
                              type="number" min="0" placeholder="0"
                              className="h-8 text-xs"
                              value={lpManualKwh[i]}
                              onChange={e => {
                                const next = [...lpManualKwh];
                                next[i] = e.target.value;
                                setLpManualKwh(next);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      {lpManualKwh.some(v => v && parseFloat(v) > 0) && (
                        <Button
                          className="w-full bg-orange-500 hover:bg-orange-600 h-10 text-xs font-bold"
                          onClick={() => {
                            const vals = lpManualKwh.map(v => parseFloat(v) || 0);
                            const filled = vals.filter(v => v > 0);
                            const total = vals.reduce((a, b) => a + b, 0);
                            const avg = filled.length ? total / filled.length : 0;
                            const max = Math.max(...vals);
                            runRecommendation({
                              source: 'Manual Input',
                              monthly_kwh: vals,
                              total_annual_kwh: total,
                              avg_monthly_kwh: avg,
                              max_monthly_kwh: max,
                              months_with_data: filled.length,
                            });
                          }}
                        >
                          <Cpu className="w-3.5 h-3.5 mr-1.5" /> Get AI Recommendation
                        </Button>
                      )}
                    </div>
                  )}

                  </> /* end !lpData input modes */
                  )} {/* end !lpVerified && !lpRec && !lpRecommending && !lpData */}

                </CardContent>
              </Card>
            </TabsContent>

            {/* ── TAB: Sizing ──────────────────────────────────────────────── */}
            <TabsContent value="sizing" className="flex flex-col gap-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-orange-500" />
                    BESS Sizing Tool
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Rule-based requirement calculator → Economical &amp; Recommended configurations → Finance model.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">

                  {/* ── PHASE 1: Use case selection ── */}
                  {!szUseCase && (
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        {
                          key: 'dg',
                          label: 'DG Replacement',
                          desc: 'Size BESS to replace diesel generator runtime. Savings calculated from fuel displaced.',
                        },
                        {
                          key: 'tod',
                          label: 'ToD Arbitrage',
                          desc: 'Size BESS for peak/off-peak tariff arbitrage. Savings from daily tariff spread.',
                        },
                      ].map(({ key, label, desc }) => (
                        <button
                          key={key}
                          onClick={() => { setSzUseCase(key); setSzResult(null); setSzAiNote(null); }}
                          className="text-left p-4 rounded-xl border-2 border-border hover:border-orange-400 hover:bg-orange-50/50 transition-all group"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                              <TrendingUp className="w-4 h-4 text-orange-500" />
                            </div>
                            <span className="text-xs font-black text-foreground">{label}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ── PHASE 2: Inputs ── */}
                  {szUseCase && !szResult && (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSzUseCase(null)}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Back
                        </button>
                        <span className="text-xs font-bold text-foreground">
                          {szUseCase === 'dg' ? 'DG Replacement Inputs' : 'ToD Arbitrage Inputs'}
                        </span>
                      </div>

                      {szUseCase === 'dg' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Critical Load (kW)</Label>
                            <Input type="number" min="0" placeholder="e.g. 250" className="h-9 text-xs"
                              value={szLoadKw} onChange={e => setSzLoadKw(e.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Backup Duration (hrs)</Label>
                            <Input type="number" min="0.5" step="0.5" placeholder="e.g. 4" className="h-9 text-xs"
                              value={szBackupHrs} onChange={e => setSzBackupHrs(e.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fuel Cost (₹/litre)</Label>
                            <Input type="number" min="0" placeholder="e.g. 90" className="h-9 text-xs"
                              value={szFuelCost} onChange={e => setSzFuelCost(e.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">DG Efficiency (L/kWh)</Label>
                            <Input type="number" min="0.1" step="0.01" placeholder="e.g. 0.31" className="h-9 text-xs"
                              value={szDgEff} onChange={e => setSzDgEff(e.target.value)} />
                          </div>
                          <div className="space-y-1.5 col-span-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Operating Days / Year</Label>
                            <Input type="number" min="1" max="365" placeholder="e.g. 300" className="h-9 text-xs"
                              value={szDgDays} onChange={e => setSzDgDays(e.target.value)} />
                          </div>
                        </div>
                      )}

                      {szUseCase === 'tod' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Daily Dispatch (kWh/day)</Label>
                            <Input type="number" min="0" placeholder="e.g. 500" className="h-9 text-xs"
                              value={szDispatchKwh} onChange={e => setSzDispatchKwh(e.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Peak Window (hrs)</Label>
                            <Input type="number" min="0.5" step="0.5" placeholder="e.g. 4" className="h-9 text-xs"
                              value={szPeakWindow} onChange={e => setSzPeakWindow(e.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Peak Tariff (₹/kWh)</Label>
                            <Input type="number" min="0" step="0.1" placeholder="e.g. 10.5" className="h-9 text-xs"
                              value={szPeakTariff} onChange={e => setSzPeakTariff(e.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Off-Peak Tariff (₹/kWh)</Label>
                            <Input type="number" min="0" step="0.1" placeholder="e.g. 5.5" className="h-9 text-xs"
                              value={szOffpeakTariff} onChange={e => setSzOffpeakTariff(e.target.value)} />
                          </div>
                          <div className="space-y-1.5 col-span-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Operating Days / Year</Label>
                            <Input type="number" min="1" max="365" placeholder="e.g. 300" className="h-9 text-xs"
                              value={szTodDays} onChange={e => setSzTodDays(e.target.value)} />
                          </div>
                        </div>
                      )}

                      <Button
                        className="w-full bg-orange-500 hover:bg-orange-600 h-10 text-xs font-bold"
                        disabled={szUseCase === 'dg'
                          ? !(szLoadKw && szBackupHrs)
                          : !(szDispatchKwh && szPeakTariff && szOffpeakTariff)}
                        onClick={runSizing}
                      >
                        <TrendingUp className="w-3.5 h-3.5 mr-1.5" /> Calculate Sizing
                      </Button>
                    </div>
                  )}

                  {/* ── PHASE 3: Results ── */}
                  {szResult && (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">
                          {szUseCase === 'dg' ? 'DG Replacement' : 'ToD Arbitrage'} — Sizing Results
                        </span>
                        <button
                          onClick={() => { setSzResult(null); setSzAiNote(null); }}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Recalculate
                        </button>
                      </div>

                      {/* Nominal requirement */}
                      <div className="bg-[#2D2D2D] rounded-xl p-4 text-white">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Nominal Requirement</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-[10px] text-gray-400">Energy</p>
                            <p className="text-xl font-black text-orange-500">{Math.round(szResult.nominal_kwh).toLocaleString('en-IN')} kWh</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400">Power</p>
                            <p className="text-xl font-black">{Math.round(szResult.nominal_kw).toLocaleString('en-IN')} kW</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400">Annual Savings</p>
                            <p className="text-xl font-black text-green-400">{inrL(szResult.annual_savings_inr)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Economical + Recommended cards for active unit */}
                      {(() => {
                        const ac = szResult.allConfigs.find(c => c.unit.id === activeUnit?.id);
                        if (!ac) return null;
                        return (
                          <div className="grid grid-cols-2 gap-3">
                            <Card className="border-border">
                              <CardContent className="p-4 flex flex-col gap-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Economical</p>
                                <p className="text-sm font-black">{ac.eco.count} × {ac.unit.model}</p>
                                <p className="text-[11px] text-muted-foreground">{ac.eco.kwh.toLocaleString('en-IN')} kWh · {ac.eco.kw.toLocaleString('en-IN')} kW</p>
                                <Separator />
                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between"><span className="text-muted-foreground">CAPEX Ex-GST</span><span className="font-black">{ac.eco.capex > 0 ? inrCr(ac.eco.capex) : 'On request'}</span></div>
                                  <div className="flex justify-between"><span className="text-muted-foreground">Headroom</span><span className="font-bold">{ac.eco.headroom}%</span></div>
                                  <div className="flex justify-between"><span className="text-muted-foreground">Payback</span><span className="font-bold">{ac.eco.payback ? `${ac.eco.payback.toFixed(1)} yrs` : '—'}</span></div>
                                  <div className="flex justify-between"><span className="text-muted-foreground">10-yr ROI</span><span className={`font-bold ${(ac.eco.roi10 ?? 0) > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>{ac.eco.roi10 != null ? `${ac.eco.roi10}%` : '—'}</span></div>
                                </div>
                                <Button size="sm" variant="outline" className="h-8 text-xs mt-1 w-full"
                                  onClick={() => {
                                    setSelectedUnit(ac.unit); setNumUnits(ac.eco.count);
                                    if (szUseCase === 'tod' && szPeakTariff && szOffpeakTariff) {
                                      const diff = parseFloat(szPeakTariff) - parseFloat(szOffpeakTariff);
                                      if (diff > 0) setTariffDiff(diff);
                                    }
                                    setActiveTab('summary');
                                  }}>
                                  Apply Economical
                                </Button>
                              </CardContent>
                            </Card>
                            <Card className="border-orange-300 bg-orange-50/50">
                              <CardContent className="p-4 flex flex-col gap-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500">★ Recommended</p>
                                <p className="text-sm font-black">{ac.rec.count} × {ac.unit.model}</p>
                                <p className="text-[11px] text-muted-foreground">{ac.rec.kwh.toLocaleString('en-IN')} kWh · {ac.rec.kw.toLocaleString('en-IN')} kW</p>
                                <Separator />
                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between"><span className="text-muted-foreground">CAPEX Ex-GST</span><span className="font-black">{ac.rec.capex > 0 ? inrCr(ac.rec.capex) : 'On request'}</span></div>
                                  <div className="flex justify-between"><span className="text-muted-foreground">Headroom</span><span className="font-bold text-orange-500">{ac.rec.headroom}%</span></div>
                                  <div className="flex justify-between"><span className="text-muted-foreground">Payback</span><span className="font-bold">{ac.rec.payback ? `${ac.rec.payback.toFixed(1)} yrs` : '—'}</span></div>
                                  <div className="flex justify-between"><span className="text-muted-foreground">10-yr ROI</span><span className={`font-bold ${(ac.rec.roi10 ?? 0) > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>{ac.rec.roi10 != null ? `${ac.rec.roi10}%` : '—'}</span></div>
                                </div>
                                <Button size="sm" className="h-8 text-xs mt-1 w-full bg-orange-500 hover:bg-orange-600"
                                  onClick={() => {
                                    setSelectedUnit(ac.unit); setNumUnits(ac.rec.count);
                                    if (szUseCase === 'tod' && szPeakTariff && szOffpeakTariff) {
                                      const diff = parseFloat(szPeakTariff) - parseFloat(szOffpeakTariff);
                                      if (diff > 0) setTariffDiff(diff);
                                    }
                                    setActiveTab('summary');
                                  }}>
                                  Apply Recommended
                                </Button>
                              </CardContent>
                            </Card>
                          </div>
                        );
                      })()}

                      {/* All configurations comparison table */}
                      <div className="flex flex-col gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">All Configurations</p>
                        <div className="rounded-xl border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/60 hover:bg-muted/60">
                                <TableHead className="text-[10px] uppercase font-bold h-8 py-0">Model</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold h-8 py-0 text-center">Eco (n×kWh)</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold h-8 py-0 text-center">Rec (n×kWh)</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold h-8 py-0 text-right">Eco CAPEX</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold h-8 py-0 text-right">Payback</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold h-8 py-0"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {szResult.allConfigs.map((cfg) => (
                                <TableRow key={cfg.unit.id} className={cfg.unit.id === activeUnit?.id ? 'bg-orange-50/60' : ''}>
                                  <TableCell className="py-2 text-xs font-bold">
                                    {cfg.unit.model}{cfg.unit.id === activeUnit?.id && <span className="ml-1 text-orange-500 text-[10px]">◀ active</span>}
                                  </TableCell>
                                  <TableCell className="py-2 text-xs text-center">{cfg.eco.count}× · {cfg.eco.kwh.toLocaleString('en-IN')} kWh</TableCell>
                                  <TableCell className="py-2 text-xs text-center text-orange-600 font-medium">{cfg.rec.count}× · {cfg.rec.kwh.toLocaleString('en-IN')} kWh</TableCell>
                                  <TableCell className="py-2 text-xs text-right font-bold">{cfg.eco.capex > 0 ? inrCr(cfg.eco.capex) : '—'}</TableCell>
                                  <TableCell className="py-2 text-xs text-right">{cfg.eco.payback ? `${cfg.eco.payback.toFixed(1)} yr` : '—'}</TableCell>
                                  <TableCell className="py-2">
                                    <button
                                      onClick={() => { setSelectedUnit(cfg.unit); setNumUnits(cfg.rec.count); setActiveTab('summary'); }}
                                      className="text-[10px] text-orange-500 hover:text-orange-700 font-bold whitespace-nowrap"
                                    >
                                      Apply ★
                                    </button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic px-1">
                          Economical = minimum units to meet nominal. Recommended = ≥15% headroom for derating and dispatch buffer.
                        </p>
                      </div>

                      {/* AI narrative */}
                      {szAiLoading && (
                        <div className="flex items-center gap-2 text-xs text-orange-500 bg-orange-50 rounded-lg px-3 py-2.5">
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          Gemini generating sizing rationale…
                        </div>
                      )}
                      {szAiNote && !szAiLoading && (
                        <div className="flex flex-col gap-2 bg-muted/40 rounded-xl p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Cpu className="w-3 h-3" /> AI Rationale
                          </p>
                          {(szAiNote.sizing_logic?.rationale || szAiNote.primary?.reasoning) && (
                            <p className="text-xs text-foreground leading-relaxed">
                              {szAiNote.sizing_logic?.rationale ?? szAiNote.primary?.reasoning}
                            </p>
                          )}
                          {szAiNote.financial_estimate?.assumptions && (
                            <p className="text-[11px] text-muted-foreground italic">{szAiNote.financial_estimate.assumptions}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
          </div>{/* end right-panel wrapper */}
        </div>

        {/* ── Generate Proposal Modal ─────────────────────────────────── */}
        <Dialog open={showPropModal} onOpenChange={(o) => { setShowPropModal(o); if (!o) setPropSuccess(null); }}>
          <DialogContent className="max-w-md">
            {propSuccess ? (
              <>
                <DialogHeader>
                  <DialogTitle className="text-green-600 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" /> Proposal Created
                  </DialogTitle>
                  <DialogDescription>
                    Proposal <span className="font-black text-foreground">{propSuccess}</span> has been saved.
                    You can find it under the <strong>Proposals</strong> section.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setShowPropModal(false)}>
                    Done
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Generate Commercial Proposal</DialogTitle>
                  <DialogDescription>
                    Creates a proposal for{' '}
                    <span className="font-bold text-foreground">
                      {numUnits}× {u.model ?? 'BESS'} — {inrCr(totalPrice)} Ex-GST
                    </span>
                  </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Client <span className="text-red-500">*</span></Label>
                    <Select value={propClientId} onValueChange={setPropClientId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select client…" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientList.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.company_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Site (optional)</Label>
                    <Select value={propSiteId} onValueChange={setPropSiteId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select site…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {siteList
                          .filter((s) => !propClientId || String(s.client_id) === propClientId)
                          .map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.site_name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Link to Project (optional)</Label>
                    <Select value={propProjectId} onValueChange={setPropProjectId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">— None —</SelectItem>
                        {projectList.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.project_code} — {p.company_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Configuration</span><span className="font-bold">{numUnits}× {u.model ?? '—'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">System</span><span className="font-bold">{totalPower} kW / {totalEnergy} kWh</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">CAPEX (Ex-GST)</span><span className="font-black text-orange-500">{inrCr(totalPrice)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Annual Savings</span><span className="font-bold">{inrL(annualSavings)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Payback</span><span className="font-bold">{simplePayback} yrs</span></div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes (optional)</Label>
                    <textarea
                      placeholder="Any additional notes for this proposal…"
                      value={propNotes}
                      onChange={(e) => setPropNotes(e.target.value)}
                      rows={2}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    />
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setShowPropModal(false)}>Cancel</Button>
                  <Button
                    className="bg-orange-500 hover:bg-orange-600"
                    onClick={handleGenerateProposal}
                    disabled={!propClientId || propLoading}
                  >
                    {propLoading ? 'Creating…' : 'Create Proposal'}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Saved Configurations ──────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4 text-orange-500" /> Saved Configurations
            </CardTitle>
            <CardDescription>{cfgList.length} configurations in database</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {cfgList.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No configurations saved yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Config Name</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>Power</TableHead>
                    <TableHead>Energy</TableHead>
                    <TableHead>Coupling</TableHead>
                    <TableHead>Application</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cfgList.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer">
                      <TableCell className="font-bold text-sm">{c.config_name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{c.site_name}</TableCell>
                      <TableCell>
                        <Badge variant="default" className="bg-orange-500 text-white font-black">
                          ×{c.num_units}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {Number(c.total_power_kw).toLocaleString('en-IN')} kW
                      </TableCell>
                      <TableCell className="font-bold text-sm">
                        {Number(c.total_energy_kwh).toLocaleString('en-IN')} kWh
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{c.coupling_type}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {(c.application ?? '').replace(/_/g, ' ')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

      </div>
    </TooltipProvider>
  );
}
