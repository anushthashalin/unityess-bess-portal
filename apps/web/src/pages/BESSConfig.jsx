import { useState, useMemo } from 'react';
import {
  Zap, Battery, Settings, TrendingUp, Cpu, CheckCircle2,
  ChevronRight, Info, BarChart3, Layers, Clock, Shield,
  Thermometer, Weight, Wifi, Award,
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
  const { units, configs, sites } = useApiMulti({
    units: bessApi.units,
    configs: bessApi.configs,
    sites: bessApi.sites,
  });

  // ── ALL hooks must be declared before any conditional return ────────────
  const [numUnits,     setNumUnits]     = useState(1);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [coupling,     setCoupling]     = useState('AC');
  const [application,  setApplication]  = useState('tod_arbitrage');
  const [socMin,       setSocMin]       = useState(10);
  const [socMax,       setSocMax]       = useState(90);
  const [peakKw,       setPeakKw]       = useState('');
  const [tariffDiff,   setTariffDiff]   = useState(4.5);

  // Derive everything here (values are 0/empty while loading — that is fine)
  const unitList   = units?.data  ?? [];
  const cfgList    = configs?.data ?? [];
  const activeUnit = selectedUnit ?? unitList[0] ?? null;
  const u          = activeUnit   ?? {};

  const totalPower   = numUnits * (u.power_kw     ?? 0);
  const totalEnergy  = numUnits * (u.energy_kwh   ?? 0);
  const totalPrice   = numUnits * (u.price_ex_gst ?? 0);
  const usableEnergy = totalEnergy * ((socMax - socMin) / 100);

  const cyclesPerYear = 300;
  const annualSavings = usableEnergy * tariffDiff * cyclesPerYear;
  const simplePayback = totalPrice > 0 ? (totalPrice / annualSavings).toFixed(1) : '—';
  const irr10yr       = totalPrice > 0
    ? Math.round(((annualSavings * 10 - totalPrice) / (totalPrice * 10)) * 100)
    : 0;

  // useMemo must also be before any early return
  const paybackData = useMemo(() => {
    if (!totalPrice || !annualSavings) return [];
    let cum = -totalPrice;
    return Array.from({ length: 12 }, (_, i) => {
      cum += annualSavings;
      return { year: `Y${i + 1}`, cashflow: Math.round(cum / 1e5) };
    });
  }, [totalPrice, annualSavings]);

  // ── NOW it is safe to return early ──────────────────────────────────────
  const loading = units?.loading || configs?.loading || sites?.loading;
  if (loading) return <Spinner />;
  if (units?.error) return <ErrorBanner message={units.error} />;

  // Auto-select first unit once data loads (deferred to avoid setState-in-render)
  if (!selectedUnit && unitList.length > 0) {
    setTimeout(() => setSelectedUnit(unitList[0]), 0);
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
          <div className="flex flex-col gap-4">

            {/* Unit selector */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-orange-500" /> Select Unit Model
                </CardTitle>
                <CardDescription>Live catalogue from database</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {unitList.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No active units in database.</p>
                ) : (
                  unitList.map((unit) => {
                    const active = activeUnit?.id === unit.id;
                    return (
                      <button
                        key={unit.id}
                        onClick={() => setSelectedUnit(unit)}
                        className={`w-full text-left rounded-lg border-2 px-4 py-3 transition-all ${
                          active
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-border hover:border-orange-300 bg-background'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className={`font-black text-sm ${active ? 'text-orange-500' : 'text-foreground'}`}>
                              {unit.model}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {unit.power_kw} kW · {unit.energy_kwh} kWh · {unit.chemistry}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-orange-500 text-sm">{inrL(unit.price_ex_gst)}</p>
                            <p className="text-[10px] text-muted-foreground">ex-GST / unit</p>
                          </div>
                        </div>
                        {active && (
                          <Progress value={85} className="mt-2 h-1" indicatorClassName="bg-orange-500" />
                        )}
                      </button>
                    );
                  })
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

              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT PANEL: analysis tabs ───────────────────────────── */}
          <Tabs defaultValue="summary" className="flex flex-col gap-4">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="financials">Financials</TabsTrigger>
              <TabsTrigger value="tod">ToD Analysis</TabsTrigger>
              <TabsTrigger value="specs">Specs</TabsTrigger>
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
                  label="10-yr Net Return"
                  value={irr10yr > 0 ? `${irr10yr}%` : '—'}
                  sub="Simple (no discounting)"
                  icon={Award}
                />
              </div>

              {/* Cumulative cash flow */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Cumulative Cash Flow</CardTitle>
                  <CardDescription>
                    10-year projection · ₹ Lakhs · tariff Δ = ₹{tariffDiff}/kWh ·{' '}
                    {cyclesPerYear} cycles/yr · {usableEnergy.toFixed(0)} kWh usable
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
                        ['Application',      appLabel,                         'User-selected'],
                        ['Usable Energy',    `${usableEnergy.toFixed(0)} kWh`, `SoC ${socMin}–${socMax}%`],
                        ['Cycles / Year',    `${cyclesPerYear}`,               'Conservative C&I assumption'],
                        ['Tariff Δ',         `₹${tariffDiff}/kWh`,            'Peak − off-peak spread'],
                        ['Annual Savings',   inrL(annualSavings),              'Gross, pre-O&M'],
                        ['CAPEX (Ex-GST)',   inrCr(totalPrice),                'Indicative ex-works'],
                        ['GST',              '18%',                            'Applicable on supply'],
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
                    value: `₹${((usableEnergy * tariffDiff * 25) / 1e3).toFixed(1)} K`,
                    sub: '25 arbitrage days/month',
                  },
                  {
                    label: 'Annual Revenue',
                    value: inrL(annualSavings),
                    sub: `${cyclesPerYear} cycles/year`,
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

              <Button className="w-full bg-orange-500 hover:bg-orange-600 h-11 text-sm font-bold">
                Generate Commercial Proposal <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </TabsContent>
          </Tabs>
        </div>

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
