import { useState, useEffect } from 'react';
import {
  Sun, Zap, TrendingUp, Bot, Sparkles, RotateCcw,
  ChevronRight, ChevronDown, Plus, Minus,
} from 'lucide-react';
import { inr } from '../lib/fmt.js';
import { api } from '../lib/api.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Label } from '../components/ui/label.jsx';
import { Separator } from '../components/ui/separator.jsx';
import { Slider } from '../components/ui/slider.jsx';

// ── Constants ─────────────────────────────────────────────────────────────────

const SYSTEM_TYPES = [
  { key: 'rooftop',     label: 'Rooftop',     desc: 'C&I rooftop — factory, warehouse, hospital, office' },
  { key: 'ground',      label: 'Ground Mount', desc: 'Open land — large C&I or utility-scale' },
];

// Module power options (Wp)
const MODULE_WP = [540, 550, 560, 570, 580, 590, 600];

// Standard inverter sizes (kW)
const INVERTER_KW = [10, 15, 20, 30, 50, 75, 100, 125, 150, 200, 250, 300, 500, 1000];

// CUF defaults by type (India averages)
const CUF_DEFAULT = { rooftop: 0.18, ground: 0.22 };

// PR (Performance Ratio) defaults
const PR_DEFAULT  = { rooftop: 0.75, ground: 0.80 };

// Peak sun hours (India avg by type)
const PSH = { rooftop: 4.5, ground: 5.0 };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n, dec = 1) {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-IN', { maximumFractionDigits: dec, minimumFractionDigits: dec });
}

function fmtINR(n) {
  if (!n || n <= 0) return '—';
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function nearestInverter(kw) {
  return INVERTER_KW.find(s => s >= kw) ?? INVERTER_KW[INVERTER_KW.length - 1];
}

function calcIRR(capex, annualCashflow, years = 25) {
  // Newton-Raphson IRR
  let rate = 0.12;
  for (let i = 0; i < 100; i++) {
    let npv = -capex;
    let dnpv = 0;
    for (let t = 1; t <= years; t++) {
      npv  += annualCashflow / Math.pow(1 + rate, t);
      dnpv -= t * annualCashflow / Math.pow(1 + rate, t + 1);
    }
    const delta = npv / dnpv;
    rate -= delta;
    if (Math.abs(delta) < 1e-7) break;
  }
  return rate * 100;
}

// ── Result card ───────────────────────────────────────────────────────────────

function ResultCard({ label, value, sub, color = '#F26B4E' }) {
  return (
    <div style={{
      background: 'white', borderRadius: 12, padding: '14px 16px',
      border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'hsl(var(--muted-foreground))', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#aaa', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── Component breakdown row ───────────────────────────────────────────────────

function CompRow({ label, value, perWp, highlight }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 12px', borderRadius: 8,
      background: highlight ? 'rgba(242,107,78,0.06)' : 'transparent',
      border: highlight ? '1px solid rgba(242,107,78,0.15)' : '1px solid transparent',
      marginBottom: 3,
    }}>
      <span style={{ fontSize: 12, fontWeight: highlight ? 700 : 500, color: highlight ? '#F26B4E' : '#555' }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--foreground))' }}>{fmtINR(value)}</span>
        {perWp && <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', marginLeft: 6 }}>₹{fmt(perWp, 1)}/Wp</span>}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function EPCConfig() {
  // ── Type
  const [systemType, setSystemType] = useState('rooftop');

  // ── Sizing inputs
  const [sizingMode,   setSizingMode]   = useState('load');     // 'load' | 'area' | 'manual'
  const [monthlyKwh,   setMonthlyKwh]   = useState('');         // kWh/month consumption
  const [selfConsump,  setSelfConsump]  = useState(80);          // % of generation self-consumed
  const [rooftopArea,  setRooftopArea]  = useState('');         // sq m
  const [manualKwp,    setManualKwp]    = useState('');         // direct kWp entry
  const [cuf,          setCuf]          = useState(CUF_DEFAULT.rooftop);
  const [moduleWp,     setModuleWp]     = useState(550);
  const [dcAcRatio,    setDcAcRatio]    = useState(1.15);

  // ── Financial inputs
  const [gridTariff,   setGridTariff]   = useState(7.5);        // ₹/kWh
  const [pricingMode,  setPricingMode]  = useState('perWp');    // 'perWp' | 'component'
  const [ratePerWp,    setRatePerWp]    = useState(42);         // ₹/Wp
  // Component breakup (₹/Wp each)
  const [comp, setComp] = useState({
    modules:       18,
    inverter:      5,
    mounting:      6,
    civil:         4,
    cables:        3,
    bos:           2,
    installation:  4,
  });
  const [escalation, setEscalation] = useState(3);   // % annual tariff escalation
  const [omCostPct,  setOmCostPct]  = useState(0.5); // % of CAPEX per year O&M

  // ── Results & AI
  const [result,     setResult]     = useState(null);
  const [aiNote,     setAiNote]     = useState(null);
  const [aiLoading,  setAiLoading]  = useState(false);
  const [running,    setRunning]    = useState(false);
  const [showComp,   setShowComp]   = useState(false);

  // Reset CUF when system type changes
  useEffect(() => {
    setCuf(CUF_DEFAULT[systemType]);
    setResult(null);
    setAiNote(null);
  }, [systemType]);

  // ── Core sizing calculation ──────────────────────────────────────────────────
  function runSizing() {
    setRunning(true);
    setResult(null);
    setAiNote(null);

    let systemKwp = 0;
    let sizingRationale = '';

    if (sizingMode === 'load') {
      const monthly = parseFloat(monthlyKwh) || 0;
      if (!monthly) { setRunning(false); return; }
      // kWp = monthly kWh / (CUF × 30.5 × 24 × self-consumption%)
      const rawKwp = monthly / (cuf * 30.5 * 24 * (selfConsump / 100));
      systemKwp = Math.ceil(rawKwp * 10) / 10; // round up to 0.1 kWp
      sizingRationale = `Load-based: ${monthly.toLocaleString('en-IN')} kWh/month consumption, ${selfConsump}% self-consumption, CUF ${(cuf * 100).toFixed(0)}%`;
    } else if (sizingMode === 'area') {
      const areaSqM = parseFloat(rooftopArea) || 0;
      if (!areaSqM) { setRunning(false); return; }
      // ~6.5–7 m² per kWp for standard modules
      const sqmPerKwp = (1000 / moduleWp) * (moduleWp >= 560 ? 1.7 : 1.8);
      systemKwp = Math.floor((areaSqM / sqmPerKwp) * 10) / 10;
      sizingRationale = `Area-based: ${areaSqM.toLocaleString('en-IN')} sq m rooftop, ${moduleWp}Wp modules (~${fmt(sqmPerKwp)} m²/kWp)`;
    } else {
      systemKwp = parseFloat(manualKwp) || 0;
      if (!systemKwp) { setRunning(false); return; }
      sizingRationale = `Manual: ${systemKwp} kWp specified directly`;
    }

    const systemKwpDC = systemKwp;
    const systemKwAC  = systemKwpDC / dcAcRatio;

    // Module count
    const moduleCount = Math.ceil((systemKwpDC * 1000) / moduleWp);

    // Inverter
    const inverterKw  = nearestInverter(systemKwAC);
    const inverterQty = Math.ceil(systemKwAC / inverterKw);

    // Annual generation
    const annualGenKwh = systemKwpDC * cuf * 8760;

    // Annual self-consumed & exported
    const selfConsumedKwh = annualGenKwh * (selfConsump / 100);
    const exportedKwh     = annualGenKwh - selfConsumedKwh;

    // CAPEX
    let capexTotal = 0;
    let compBreakup = null;

    if (pricingMode === 'perWp') {
      capexTotal = systemKwpDC * 1000 * ratePerWp;
    } else {
      const totalPerWp = Object.values(comp).reduce((a, b) => a + parseFloat(b || 0), 0);
      capexTotal = systemKwpDC * 1000 * totalPerWp;
      compBreakup = Object.entries(comp).map(([k, v]) => ({
        label: k.charAt(0).toUpperCase() + k.slice(1),
        perWp: parseFloat(v),
        value: systemKwpDC * 1000 * parseFloat(v),
      }));
    }

    // Annual O&M
    const annualOM = capexTotal * (omCostPct / 100);

    // Year 1 savings (self-consumed @ grid tariff, export @ 70% — net metering assumption)
    const year1Savings = selfConsumedKwh * gridTariff + exportedKwh * gridTariff * 0.7;
    const year1Net     = year1Savings - annualOM;

    // 25-year model with tariff escalation
    let totalSavings = 0;
    let totalOM      = 0;
    const cashflows  = [];
    for (let yr = 1; yr <= 25; yr++) {
      const tariff    = gridTariff * Math.pow(1 + escalation / 100, yr - 1);
      // Degradation: 2% year 1, 0.5%/yr thereafter (LID + annual)
      const degradation = yr === 1 ? 0.98 : Math.pow(0.995, yr - 1) * 0.98;
      const gen       = annualGenKwh * degradation;
      const selfKwh   = gen * (selfConsump / 100);
      const expKwh    = gen - selfKwh;
      const savings   = selfKwh * tariff + expKwh * tariff * 0.7;
      const om        = annualOM * Math.pow(1.03, yr - 1);
      const net       = savings - om;
      totalSavings += savings;
      totalOM      += om;
      cashflows.push(net);
    }

    // Simple payback
    const paybackYrs = capexTotal / year1Net;

    // IRR
    const irr = calcIRR(capexTotal, year1Net);

    // NPV @ 10% discount
    const npv = cashflows.reduce((acc, cf, i) => acc + cf / Math.pow(1.10, i + 1), 0) - capexTotal;

    // ₹/Wp installed
    const rateWpActual = capexTotal / (systemKwpDC * 1000);

    setResult({
      systemKwpDC,
      systemKwAC,
      moduleCount,
      moduleWp,
      inverterKw,
      inverterQty,
      annualGenKwh,
      selfConsumedKwh,
      exportedKwh,
      capexTotal,
      rateWpActual,
      year1Savings,
      annualOM,
      year1Net,
      paybackYrs,
      irr,
      npv,
      totalSavings,
      totalOM,
      compBreakup,
      sizingRationale,
    });

    setRunning(false);

    // Fire Gemini AI narration
    callGemini({ systemKwpDC, annualGenKwh, capexTotal, year1Savings, paybackYrs, irr, npv, gridTariff, systemType, sizingRationale, selfConsumedKwh, exportedKwh });
  }

  async function callGemini({ systemKwpDC, annualGenKwh, capexTotal, year1Savings, paybackYrs, irr, npv, gridTariff, systemType, sizingRationale, selfConsumedKwh, exportedKwh }) {
    setAiLoading(true);
    try {
      const res = await api.post('/api/epc/size-narrative', {
        systemKwpDC, annualGenKwh, capexTotal, year1Savings, paybackYrs, irr, npv,
        gridTariff, systemType, sizingRationale, selfConsumedKwh, exportedKwh,
      });
      setAiNote(res?.data ?? res);
    } catch {
      setAiNote('AI narrative unavailable. Review the numbers above.');
    } finally {
      setAiLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Chivo', sans-serif", color: 'hsl(var(--foreground))' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black text-foreground tracking-tight flex items-center gap-2">
            <Sun size={20} className="text-[#F26B4E]" />
            EPC Configurator
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Solar system sizing · financial model · AI-assisted narration
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-white/90 border border-border/50 rounded-xl px-3 py-1.5 shadow-sm">
          <Sparkles size={11} className="text-orange-400" />
          <span className="text-[11px] font-bold text-orange-500">Gemini AI · Live</span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-5">

        {/* ── LEFT: Inputs ── */}
        <div className="col-span-2 flex flex-col gap-4">

          {/* System type selector */}
          <Card className="border border-border/50 shadow-sm bg-white/95">
            <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-[13px] font-bold">System Type</CardTitle></CardHeader>
            <Separator />
            <CardContent className="p-4 flex gap-2">
              {SYSTEM_TYPES.map(t => (
                <button key={t.key} onClick={() => setSystemType(t.key)}
                  className={`flex-1 rounded-xl px-3 py-3 text-left border transition-all duration-150 ${
                    systemType === t.key
                      ? 'bg-[#F26B4E]/10 border-[#F26B4E]/40 text-[#F26B4E]'
                      : 'bg-white border-border text-muted-foreground hover:border-[#F26B4E]/30'
                  }`}
                >
                  <div className="text-[12px] font-black">{t.label}</div>
                  <div className="text-[10px] mt-0.5 leading-tight opacity-70">{t.desc}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Sizing mode */}
          <Card className="border border-border/50 shadow-sm bg-white/95">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-[13px] font-bold">Sizing Basis</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="p-4 space-y-4">
              {/* Mode tabs */}
              <div className="flex gap-1.5 p-1 bg-muted/40 rounded-lg">
                {[['load','By Load'], ['area','By Area'], ['manual','Manual kWp']].map(([k, lbl]) => (
                  <button key={k} onClick={() => setSizingMode(k)}
                    className={`flex-1 text-[11px] font-bold py-1.5 rounded-md transition-all ${
                      sizingMode === k ? 'bg-[#F26B4E] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}>
                    {lbl}
                  </button>
                ))}
              </div>

              {sizingMode === 'load' && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Monthly Consumption (kWh)</Label>
                    <Input placeholder="e.g. 50000" value={monthlyKwh} onChange={e => setMonthlyKwh(e.target.value)} className="mt-1.5 h-9 text-sm font-semibold" />
                  </div>
                  <div>
                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Self-consumption — {selfConsump}%</Label>
                    <Slider min={50} max={100} step={5} value={[selfConsump]} onValueChange={([v]) => setSelfConsump(v)} className="mt-2" />
                    <div className="flex justify-between text-[9px] text-muted-foreground mt-1"><span>50% export</span><span>100% no export</span></div>
                  </div>
                </div>
              )}

              {sizingMode === 'area' && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Available Rooftop Area (sq m)</Label>
                    <Input placeholder="e.g. 2000" value={rooftopArea} onChange={e => setRooftopArea(e.target.value)} className="mt-1.5 h-9 text-sm font-semibold" />
                  </div>
                  <div>
                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Module Wattage</Label>
                    <select value={moduleWp} onChange={e => setModuleWp(Number(e.target.value))}
                      className="mt-1.5 w-full h-9 rounded-md border border-input bg-background px-3 text-sm font-semibold">
                      {MODULE_WP.map(w => <option key={w} value={w}>{w} Wp</option>)}
                    </select>
                  </div>
                </div>
              )}

              {sizingMode === 'manual' && (
                <div>
                  <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">System Size (kWp DC)</Label>
                  <Input placeholder="e.g. 500" value={manualKwp} onChange={e => setManualKwp(e.target.value)} className="mt-1.5 h-9 text-sm font-semibold" />
                </div>
              )}

              {/* CUF */}
              <div>
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">CUF — {(cuf * 100).toFixed(0)}%</Label>
                <Slider min={12} max={28} step={1} value={[Math.round(cuf * 100)]} onValueChange={([v]) => setCuf(v / 100)} className="mt-2" />
                <div className="flex justify-between text-[9px] text-muted-foreground mt-1"><span>12%</span><span>28%</span></div>
              </div>

              {/* DC:AC ratio */}
              <div>
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">DC:AC Ratio — {dcAcRatio.toFixed(2)}</Label>
                <Slider min={100} max={140} step={5} value={[Math.round(dcAcRatio * 100)]} onValueChange={([v]) => setDcAcRatio(v / 100)} className="mt-2" />
                <div className="flex justify-between text-[9px] text-muted-foreground mt-1"><span>1.00</span><span>1.40</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Financial inputs */}
          <Card className="border border-border/50 shadow-sm bg-white/95">
            <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-[13px] font-bold">Financial Inputs</CardTitle></CardHeader>
            <Separator />
            <CardContent className="p-4 space-y-3">

              <div>
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Grid Tariff (₹/kWh)</Label>
                <Input type="number" placeholder="7.50" value={gridTariff} onChange={e => setGridTariff(parseFloat(e.target.value) || 0)} className="mt-1.5 h-9 text-sm font-semibold" />
              </div>

              <div>
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Tariff Escalation (%/yr) — {escalation}%</Label>
                <Slider min={0} max={8} step={0.5} value={[escalation]} onValueChange={([v]) => setEscalation(v)} className="mt-2" />
              </div>

              <div>
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">O&M Cost (%/yr of CAPEX) — {omCostPct}%</Label>
                <Slider min={0.25} max={2} step={0.25} value={[omCostPct]} onValueChange={([v]) => setOmCostPct(v)} className="mt-2" />
              </div>

              {/* Pricing mode toggle */}
              <div>
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Pricing Mode</Label>
                <div className="flex gap-1.5 p-1 bg-muted/40 rounded-lg">
                  {[['perWp','₹/Wp (Quick)'], ['component','Component Breakup']].map(([k, lbl]) => (
                    <button key={k} onClick={() => setPricingMode(k)}
                      className={`flex-1 text-[11px] font-bold py-1.5 rounded-md transition-all ${
                        pricingMode === k ? 'bg-[#F26B4E] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {pricingMode === 'perWp' && (
                <div>
                  <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Installed Cost (₹/Wp)</Label>
                  <Input type="number" placeholder="42" value={ratePerWp} onChange={e => setRatePerWp(parseFloat(e.target.value) || 0)} className="mt-1.5 h-9 text-sm font-semibold" />
                </div>
              )}

              {pricingMode === 'component' && (
                <div className="space-y-2">
                  {Object.entries(comp).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <Label className="text-[11px] font-semibold text-muted-foreground w-28 shrink-0 capitalize">{k.replace('_', ' ')}</Label>
                      <div className="flex items-center gap-1.5 flex-1">
                        <button onClick={() => setComp(c => ({ ...c, [k]: Math.max(0, parseFloat(c[k]) - 0.5) }))} className="w-6 h-6 rounded border flex items-center justify-center text-muted-foreground hover:text-foreground">
                          <Minus size={10} />
                        </button>
                        <Input type="number" value={v} onChange={e => setComp(c => ({ ...c, [k]: e.target.value }))} className="h-7 text-xs font-bold text-center" />
                        <button onClick={() => setComp(c => ({ ...c, [k]: parseFloat(c[k]) + 0.5 }))} className="w-6 h-6 rounded border flex items-center justify-center text-muted-foreground hover:text-foreground">
                          <Plus size={10} />
                        </button>
                        <span className="text-[10px] text-muted-foreground shrink-0">₹/Wp</span>
                      </div>
                    </div>
                  ))}
                  <div className="pt-1 border-t border-border/50 flex justify-between text-[11px] font-black">
                    <span>Total</span>
                    <span className="text-[#F26B4E]">₹{fmt(Object.values(comp).reduce((a, b) => a + parseFloat(b || 0), 0), 2)}/Wp</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Run button */}
          <Button
            className="w-full h-11 bg-[#F26B4E] hover:bg-[#E04D2E] text-white font-black text-[13px] rounded-xl shadow-lg"
            onClick={runSizing}
            disabled={running}
          >
            {running ? 'Calculating…' : (
              <><Sun size={15} className="mr-2" />Size Solar System</>
            )}
          </Button>

          {result && (
            <Button variant="outline" className="w-full h-9 text-[12px] font-semibold rounded-xl"
              onClick={() => { setResult(null); setAiNote(null); }}>
              <RotateCcw size={13} className="mr-1.5" /> Reset
            </Button>
          )}
        </div>

        {/* ── RIGHT: Results ── */}
        <div className="col-span-3 flex flex-col gap-4">

          {!result && (
            <Card className="border border-border/50 shadow-sm bg-white/95 flex-1 flex items-center justify-center min-h-[400px]">
              <div className="text-center text-muted-foreground py-16">
                <Sun size={48} className="mx-auto opacity-10 mb-4" />
                <p className="text-sm font-medium">Configure inputs and click <strong>Size Solar System</strong></p>
                <p className="text-xs mt-1 opacity-60">Sizing · modules · inverters · CAPEX · IRR · 25-year model</p>
              </div>
            </Card>
          )}

          {result && (
            <>
              {/* System specs */}
              <Card className="border border-border/50 shadow-sm bg-white/95">
                <CardHeader className="pb-2 pt-4 px-5 flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-[13px] font-bold">System Specification</CardTitle>
                  <Badge className="bg-[#F26B4E]/10 text-[#F26B4E] border-[#F26B4E]/20 text-[10px] font-bold">
                    {systemType === 'rooftop' ? 'Rooftop' : 'Ground Mount'}
                  </Badge>
                </CardHeader>
                <Separator />
                <CardContent className="p-4">
                  <div className="grid grid-cols-4 gap-3 mb-3">
                    <ResultCard label="DC Capacity"   value={`${fmt(result.systemKwpDC)} kWp`}  sub="Peak power" />
                    <ResultCard label="AC Capacity"   value={`${fmt(result.systemKwAC)} kW`}    sub={`DC:AC ${dcAcRatio.toFixed(2)}`} />
                    <ResultCard label="Modules"        value={result.moduleCount.toLocaleString('en-IN')} sub={`${result.moduleWp} Wp each`} />
                    <ResultCard label="Inverter"       value={`${result.inverterKw} kW`}         sub={`× ${result.inverterQty} unit${result.inverterQty > 1 ? 's' : ''}`} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <ResultCard label="Annual Generation" value={`${fmt(result.annualGenKwh / 1000, 1)} MWh`} sub={`CUF ${(cuf * 100).toFixed(0)}%`} color="#7C3AED" />
                    <ResultCard label="Self-consumed"     value={`${fmt(result.selfConsumedKwh / 1000, 1)} MWh`} sub={`${selfConsump}% of generation`} color="#16A34A" />
                    <ResultCard label="Grid Export"       value={`${fmt(result.exportedKwh / 1000, 1)} MWh`}   sub="Net metering" color="#3B82F6" />
                  </div>
                  <div className="mt-3 px-3 py-2 rounded-lg bg-orange-50/60 border border-orange-100 text-[11px] text-orange-700 font-medium">
                    <strong>Sizing basis:</strong> {result.sizingRationale}
                  </div>
                </CardContent>
              </Card>

              {/* Financial model */}
              <Card className="border border-border/50 shadow-sm bg-white/95">
                <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-[13px] font-bold">Financial Model · 25 Years</CardTitle></CardHeader>
                <Separator />
                <CardContent className="p-4">
                  <div className="grid grid-cols-4 gap-3 mb-3">
                    <ResultCard label="CAPEX"         value={fmtINR(result.capexTotal)}       sub={`₹${fmt(result.rateWpActual, 1)}/Wp installed`} color="#F26B4E" />
                    <ResultCard label="Yr 1 Savings"  value={fmtINR(result.year1Savings)}     sub="Grid cost offset" color="#16A34A" />
                    <ResultCard label="Simple Payback" value={`${fmt(result.paybackYrs, 1)} yr`} sub="Before incentives" color="#7C3AED" />
                    <ResultCard label="Project IRR"   value={`${fmt(result.irr, 1)}%`}        sub="25-year" color="#F59E0B" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <ResultCard label="NPV (10%)"      value={fmtINR(result.npv)}             sub="25-year discounted" color={result.npv >= 0 ? '#16A34A' : '#EF4444'} />
                    <ResultCard label="25yr Savings"   value={fmtINR(result.totalSavings)}    sub="Gross energy cost offset" color="#16A34A" />
                    <ResultCard label="25yr O&M"       value={fmtINR(result.totalOM)}         sub={`${omCostPct}% CAPEX/yr + 3% escalation`} color="#6B7280" />
                  </div>
                </CardContent>
              </Card>

              {/* Component breakup (if applicable) */}
              {result.compBreakup && (
                <Card className="border border-border/50 shadow-sm bg-white/95">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <button className="flex items-center justify-between w-full" onClick={() => setShowComp(s => !s)}>
                      <CardTitle className="text-[13px] font-bold">Component Breakup</CardTitle>
                      <ChevronDown size={14} className={`text-muted-foreground transition-transform ${showComp ? 'rotate-180' : ''}`} />
                    </button>
                  </CardHeader>
                  {showComp && (
                    <>
                      <Separator />
                      <CardContent className="p-4">
                        {result.compBreakup.map(c => (
                          <CompRow key={c.label} label={c.label} value={c.value} perWp={c.perWp} />
                        ))}
                        <CompRow label="Total CAPEX" value={result.capexTotal} perWp={result.rateWpActual} highlight />
                      </CardContent>
                    </>
                  )}
                </Card>
              )}

              {/* AI Narration */}
              <Card className={`border shadow-sm bg-white/95 transition-all ${
                aiLoading ? 'border-orange-200' : aiNote ? 'border-blue-200 bg-blue-50/30' : 'border-border/50'
              }`}>
                <CardHeader className="pb-2 pt-4 px-5 flex-row items-center gap-2 space-y-0">
                  <Bot size={15} className={aiLoading ? 'text-orange-500 animate-pulse' : 'text-blue-500'} />
                  <CardTitle className="text-[13px] font-bold">
                    {aiLoading ? 'Gemini is analysing the configuration…' : 'AI Sizing Narrative'}
                  </CardTitle>
                  {!aiLoading && aiNote && (
                    <Sparkles size={12} className="text-blue-400 ml-auto" />
                  )}
                </CardHeader>
                {!aiLoading && aiNote && (
                  <>
                    <Separator />
                    <CardContent className="p-4">
                      <p className="text-[12.5px] text-foreground/80 leading-relaxed whitespace-pre-line">
                        {typeof aiNote === 'string' ? aiNote : aiNote?.narrative ?? aiNote?.recommendation ?? JSON.stringify(aiNote, null, 2)}
                      </p>
                    </CardContent>
                  </>
                )}
                {aiLoading && (
                  <CardContent className="px-4 pb-3">
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
