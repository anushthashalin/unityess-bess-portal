import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Input } from '../components/ui/input.jsx';
import { Label } from '../components/ui/label.jsx';
import { Button } from '../components/ui/button.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select.jsx';
import { Download, RefreshCw, FileText } from 'lucide-react';

// ── Price list FY 2026-27 ──────────────────────────────────────────────────────
const MODELS = [
  { key: 'A',    label: 'Model A  — 125 kW / 261 kWh',  kw: 125,  kwh: 261,   price: 4999000,  type: 'unit' },
  { key: 'A3',   label: 'Model A3 — 150 kW / 313 kWh',  kw: 150,  kwh: 313,   price: 5999000,  type: 'unit' },
  { key: 'A2',   label: 'Model A2 — 215 kW / 418 kWh',  kw: 215,  kwh: 418,   price: 6999000,  type: 'unit' },
  { key: 'C334', label: 'Model C  — 3.34 MWh DC Block', kw: null, kwh: 3340,  price: 40300000, type: 'dc_block' },
  { key: 'C418', label: 'Model C  — 4.18 MWh DC Block', kw: null, kwh: 4180,  price: 45800000, type: 'dc_block' },
  { key: 'C502', label: 'Model C  — 5.016 MWh DC Block',kw: null, kwh: 5016,  price: 50500000, type: 'dc_block' },
];
const MPPT_PRICE = 250000; // per MPPT unit

// ── Indian number formatter ────────────────────────────────────────────────────
function inrFmt(n) {
  if (!n && n !== 0) return '—';
  const num = Math.round(Number(n));
  if (isNaN(num)) return '—';
  const s = num.toFixed(0);
  const lastThree = s.slice(-3);
  const rest = s.slice(0, -3);
  const formatted = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree : lastThree;
  return '₹' + formatted + '/-';
}

function inrWords(n) {
  const num = Math.round(Number(n));
  if (!num || isNaN(num)) return '';
  const cr  = Math.floor(num / 10000000);
  const rem = num % 10000000;
  const lac = Math.floor(rem / 100000);
  const rem2 = rem % 100000;
  const th  = Math.floor(rem2 / 1000);
  const parts = [];
  if (cr)  parts.push(`${cr} Crore`);
  if (lac) parts.push(`${lac} Lakh`);
  if (th)  parts.push(`${th} Thousand`);
  return parts.join(', ') || num.toString();
}

function todayStr() {
  const d = new Date();
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Li Carbonate Price Data (quarterly avg, USD/MT — Fastmarkets/BloombergNEF) ─
// Reflects the 2022 peak (~$78k) and subsequent correction to ~$9-10k in 2025
const LI_DATA = [
  { date: 'Q1 2022', value: 42000 },
  { date: 'Q2 2022', value: 65000 },
  { date: 'Q3 2022', value: 71000 },
  { date: 'Q4 2022', value: 78000 },
  { date: 'Q1 2023', value: 74000 },
  { date: 'Q2 2023', value: 47000 },
  { date: 'Q3 2023', value: 27000 },
  { date: 'Q4 2023', value: 17000 },
  { date: 'Q1 2024', value: 13500 },
  { date: 'Q2 2024', value: 13000 },
  { date: 'Q3 2024', value: 11000 },
  { date: 'Q4 2024', value: 10500 },
  { date: 'Q1 2025', value: 10000 },
  { date: 'Q2 2025', value: 9800  },
  { date: 'Q3 2025', value: 9600  },
  { date: 'Q4 2025', value: 9400  },
];

// ── Quote print styles ─────────────────────────────────────────────────────────
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #quote-print-area, #quote-print-area * { visibility: visible !important; }
  #quote-print-area {
    position: fixed !important; top: 0; left: 0;
    width: 210mm; min-height: 297mm;
    margin: 0; padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-adjust: exact;
  }
  @page { size: A4 portrait; margin: 0; }
}
`;

// ── Main component ─────────────────────────────────────────────────────────────
export default function QuoteGenerator() {
  // Form state
  const [clientName, setClientName]   = useState('');
  const [quoteDate,  setQuoteDate]    = useState(todayStr());
  const [modelKey,   setModelKey]     = useState('A');
  const [qty,        setQty]          = useState(4);
  const [mppt,       setMppt]         = useState(false);
  const [mpptQty,    setMpptQty]      = useState(1);
  const [quotedTotal,setQuotedTotal]  = useState('');
  const [priceOverride, setPriceOverride] = useState(false);
  const [validDays,  setValidDays]    = useState(7);
  const [notes,      setNotes]        = useState('');

  // Li chart state — static dataset, always available
  const [liData]    = useState(LI_DATA);
  const liLoading   = false;
  const liLatest    = LI_DATA[LI_DATA.length - 1];

  // Computed
  const model     = MODELS.find(m => m.key === modelKey) ?? MODELS[0];
  const listTotal = model.price * (model.type === 'dc_block' ? 1 : qty) + (mppt ? MPPT_PRICE * mpptQty : 0);
  const finalTotal = priceOverride && quotedTotal ? Number(quotedTotal.replace(/[₹,\-]/g,'')) : listTotal;
  const totalKwh  = model.type === 'dc_block' ? model.kwh : model.kwh * qty;
  const totalKw   = model.kw ? model.kw * qty : null;
  const gst       = Math.round(finalTotal * 0.18);
  const totalInc  = finalTotal + gst;
  const effectiveUnits = model.type === 'dc_block' ? 1 : qty;

  // Sync list total → quoted total when model/qty changes (if not overridden)
  useEffect(() => {
    if (!priceOverride) setQuotedTotal(listTotal.toString());
  }, [model.key, qty, mppt, mpptQty, priceOverride, listTotal]);

  // (Li data is static — no fetch needed)

  // Print
  function handlePrint() {
    // Inject print CSS if not already present
    if (!document.getElementById('quote-print-css')) {
      const style = document.createElement('style');
      style.id = 'quote-print-css';
      style.innerHTML = PRINT_CSS;
      document.head.appendChild(style);
    }
    window.print();
  }

  const noteText = notes || `This is a budgetary offer for the supply of UnityESS Battery Energy Storage System(s) as described above. Prices are Ex-Works, New Delhi, and exclude GST @ 18%. This offer is valid for ${validDays} days from the date above and is subject to revision based on the Lithium Carbonate Index at the time of final order. Freight, civil works, and installation charges (if applicable) will be quoted separately.`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-foreground tracking-tight">Quote Generator</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Generate a budgetary offer PDF for any UnityESS configuration</p>
        </div>
        <Button onClick={handlePrint}
          className="bg-[#F26B4E] hover:bg-[#E04D2E] text-white font-bold rounded-xl h-10 px-5 gap-2 shadow-sm text-[13px]">
          <Download size={14}/> Download PDF
        </Button>
      </div>

      <div className="flex gap-6">
        {/* ── Form ── */}
        <div className="w-80 shrink-0 space-y-4">
          <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4 shadow-sm">
            <div className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Client Details</div>

            <div>
              <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Client / Company Name</Label>
              <Input value={clientName} onChange={e => setClientName(e.target.value)}
                placeholder="e.g. Khanak Industries Pvt Ltd"
                className="mt-1 h-9 text-sm focus-visible:ring-[#F26B4E] rounded-lg"/>
            </div>
            <div>
              <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Quote Date</Label>
              <Input value={quoteDate} onChange={e => setQuoteDate(e.target.value)}
                placeholder="e.g. 26th March 2026"
                className="mt-1 h-9 text-sm focus-visible:ring-[#F26B4E] rounded-lg"/>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4 shadow-sm">
            <div className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">System Configuration</div>

            <div>
              <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Model</Label>
              <Select value={modelKey} onValueChange={v => { setModelKey(v); setPriceOverride(false); }}>
                <SelectTrigger className="mt-1 h-9 text-sm rounded-lg focus:ring-[#F26B4E]">
                  <SelectValue/>
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {model.type === 'unit' && (
              <div>
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Number of Units</Label>
                <Input type="number" min={1} max={100} value={qty}
                  onChange={e => { setQty(Math.max(1, parseInt(e.target.value)||1)); setPriceOverride(false); }}
                  className="mt-1 h-9 text-sm focus-visible:ring-[#F26B4E] rounded-lg"/>
              </div>
            )}

            <div>
              <label className="flex items-center gap-2.5 cursor-pointer text-sm">
                <input type="checkbox" checked={mppt} onChange={e => setMppt(e.target.checked)}
                  className="w-4 h-4 accent-[#F26B4E]"/>
                <span className="text-[12px] font-medium text-foreground">Include MPPT Controller Add-on</span>
              </label>
              {mppt && (
                <Input type="number" min={1} max={20} value={mpptQty}
                  onChange={e => setMpptQty(Math.max(1, parseInt(e.target.value)||1))}
                  className="mt-2 h-9 text-sm focus-visible:ring-[#F26B4E] rounded-lg" placeholder="No. of MPPT units"/>
              )}
            </div>

            <div>
              <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Valid For (days)</Label>
              <Input type="number" min={1} value={validDays}
                onChange={e => setValidDays(parseInt(e.target.value)||7)}
                className="mt-1 h-9 text-sm focus-visible:ring-[#F26B4E] rounded-lg"/>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4 shadow-sm">
            <div className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Pricing</div>

            <div className="rounded-xl border border-border/40 bg-muted/30 px-4 py-3 space-y-1.5 text-[12px]">
              <div className="flex justify-between text-muted-foreground">
                <span>List price × {effectiveUnits} unit{effectiveUnits > 1 ? 's' : ''}</span>
                <span className="font-bold text-foreground">{inrFmt(model.price * effectiveUnits)}</span>
              </div>
              {mppt && (
                <div className="flex justify-between text-muted-foreground">
                  <span>MPPT × {mpptQty}</span>
                  <span className="font-bold text-foreground">{inrFmt(MPPT_PRICE * mpptQty)}</span>
                </div>
              )}
              <div className="border-t border-border/40 pt-1.5 flex justify-between">
                <span className="font-bold text-foreground">List Total (ex-GST)</span>
                <span className="font-black text-[#F26B4E]">{inrFmt(listTotal)}</span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex-1">Quoted Price (ex-GST)</Label>
                {priceOverride && (
                  <button onClick={() => setPriceOverride(false)}
                    className="text-[10px] text-[#F26B4E] font-bold hover:underline">Reset to list</button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                <Input type="number" value={priceOverride ? (quotedTotal === listTotal.toString() ? listTotal : quotedTotal) : listTotal}
                  onChange={e => { setPriceOverride(true); setQuotedTotal(e.target.value); }}
                  className="pl-7 h-9 text-sm focus-visible:ring-[#F26B4E] rounded-lg font-bold"/>
              </div>
              <div className="mt-1.5 text-[11px] text-muted-foreground space-y-0.5">
                <div className="flex justify-between"><span>GST @ 18%</span><span>{inrFmt(gst)}</span></div>
                <div className="flex justify-between font-bold text-foreground"><span>Total incl. GST</span><span>{inrFmt(totalInc)}</span></div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4 shadow-sm">
            <div className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Notes (optional override)</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={4} placeholder="Leave blank to use the standard note text…"
              className="w-full px-3 py-2 rounded-lg border border-input text-[12px] bg-background resize-none focus:outline-none focus:ring-2 focus:ring-[#F26B4E]/30 focus:border-[#F26B4E]"/>
          </div>

          {/* Li data status */}
          <div className="bg-card rounded-2xl border border-border/50 p-4 flex items-center gap-3 shadow-sm">
            <div className="flex-1">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Li Carbonate Index</div>
              {liLatest && (
                <div className="text-[13px] font-black text-[#F26B4E] mt-0.5">
                  ${liLatest.value.toFixed(0)}/t
                  <span className="text-[10px] font-normal text-muted-foreground ml-1">({liLatest.date})</span>
                </div>
              )}
            </div>
            <div className="p-2 rounded-lg border border-border/50 text-muted-foreground">
              <RefreshCw size={13}/>
            </div>
          </div>
        </div>

        {/* ── A4 Preview ── */}
        <div className="flex-1 min-w-0">
          <div className="sticky top-0">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
              <FileText size={12}/> Live Preview
              <span className="font-normal normal-case text-muted-foreground/60">— this is exactly what prints</span>
            </div>
            <div style={{ transform: 'scale(0.75)', transformOrigin: 'top left', width: '133.33%' }}>
              <QuoteDocument
                clientName={clientName || 'Your Client Name'}
                quoteDate={quoteDate}
                model={model}
                qty={qty}
                mppt={mppt}
                mpptQty={mpptQty}
                finalTotal={finalTotal}
                gst={gst}
                totalInc={totalInc}
                totalKwh={totalKwh}
                totalKw={totalKw}
                noteText={noteText}
                liData={liData}
                liLoading={liLoading}
                liLatest={liLatest}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Hidden print area — exact copy of preview, full size */}
      <div style={{ display: 'none' }}>
        <QuoteDocument
          id="quote-print-area"
          clientName={clientName || 'Your Client Name'}
          quoteDate={quoteDate}
          model={model}
          qty={qty}
          mppt={mppt}
          mpptQty={mpptQty}
          finalTotal={finalTotal}
          gst={gst}
          totalInc={totalInc}
          totalKwh={totalKwh}
          totalKw={totalKw}
          noteText={noteText}
          liData={liData}
          liLoading={liLoading}
          liLatest={liLatest}
        />
      </div>
    </div>
  );
}

// ── The actual A4 quote document ───────────────────────────────────────────────
function QuoteDocument({ id, clientName, quoteDate, model, qty, mppt, mpptQty,
  finalTotal, gst, totalInc, totalKwh, totalKw, noteText, liData, liLoading, liLatest }) {

  const effectiveUnits = model.type === 'dc_block' ? 1 : qty;
  const systemDesc = model.type === 'dc_block'
    ? `${(model.kwh/1000).toFixed(3)} MWh DC Block`
    : `${qty} Unit${qty > 1 ? 's' : ''} of ${model.kwh} kWh`;

  const deliverableItems = [
    model.type === 'dc_block'
      ? `DC Battery Container — ${(model.kwh/1000).toFixed(3)} MWh LFP (Lithium Iron Phosphate)`
      : `DC Battery Container${qty > 1 ? 's' : ''} — ${qty} × ${model.kwh} kWh LFP (Lithium Iron Phosphate)`,
    model.type === 'unit'
      ? `Power Conversion System (PCS) — ${qty} × ${model.kw} kW Unity Inverter`
      : `Power Conversion System (PCS) — to be quoted separately`,
    `Energy Management System (EMS) — UNITY EMS with SCADA / Modbus TCP`,
    `Project Management, Design & Engineering`,
    `DAP-Site Freight & Logistics`,
    ...(mppt ? [`MPPT Solar Controller Add-on — ${mpptQty} × 50 kW MPPT Unit${mpptQty > 1 ? 's' : ''}`] : []),
  ];

  const s = {
    page: {
      width: '210mm', minHeight: '297mm', background: '#fff',
      fontFamily: "'Chivo', 'Inter', sans-serif",
      fontSize: 11, color: '#2D2D2D',
      padding: '14mm 14mm 10mm 14mm',
      boxSizing: 'border-box',
      position: 'relative',
    },
  };

  return (
    <div id={id} style={s.page}>
      {/* Header: logos */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <img src="/logo_ornate.png" alt="Ornate Solar" style={{ height: 44, objectFit: 'contain' }}
          onError={e => { e.target.style.display='none'; }}/>
        <img src="/logo_unity.png" alt="UnityESS" style={{ height: 44, objectFit: 'contain' }}
          onError={e => { e.target.style.display='none'; }}/>
      </div>

      {/* Orange divider */}
      <div style={{ height: 3, background: '#F26B4E', borderRadius: 2, marginBottom: 10 }}/>

      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#F26B4E', letterSpacing: '-0.5px', lineHeight: 1 }}>
            BUDGETARY OFFER
          </div>
          <div style={{ fontSize: 10, color: '#888', marginTop: 3, fontWeight: 500 }}>
            UnityESS Battery Energy Storage System
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#2D2D2D' }}>Date: {quoteDate}</div>
          <div style={{ fontSize: 9, color: '#aaa', marginTop: 2 }}>Ref: UESS-BQ-{new Date().getFullYear()}-{String(Math.floor(Math.random()*9000)+1000)}</div>
        </div>
      </div>

      {/* Deliverables box */}
      <div style={{
        background: '#f8f9fa', border: '1.5px solid #e5e7eb',
        borderRadius: 8, padding: '10px 14px', marginBottom: 12,
      }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: '#2D2D2D', marginBottom: 2 }}>
          DELIVERABLES — {systemDesc} BESS Project for {clientName}
        </div>
        <div style={{ fontSize: 10, color: '#555', lineHeight: 1.5, marginTop: 6 }}>
          The fully integrated <strong>UnityESS</strong> system is a containerised, grid-ready Battery Energy Storage
          System built on <strong>LFP (Lithium Iron Phosphate)</strong> chemistry, designed for C&amp;I behind-the-meter
          and grid-interactive applications. The system includes BMS, PCS, EMS, fire suppression, HVAC,
          and remote monitoring as standard. Certifications: IEC 62619, IEC 62477, IS 16270.
        </div>
      </div>

      {/* Line-items table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 11 }}>
        <thead>
          <tr style={{ background: '#2D2D2D' }}>
            <th style={{ padding: '7px 12px', textAlign: 'left', color: '#fff', fontWeight: 700, fontSize: 10, letterSpacing: '0.5px', width: '70%' }}>DESCRIPTION</th>
            <th style={{ padding: '7px 12px', textAlign: 'right', color: '#fff', fontWeight: 700, fontSize: 10, letterSpacing: '0.5px' }}>PRICE (INR, excl. GST @ 18%)</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
            <td style={{ padding: '9px 12px', verticalAlign: 'top' }}>
              <div style={{ fontWeight: 800, color: '#2D2D2D', marginBottom: 6 }}>
                Complete BESS Plant Installation — {systemDesc}
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, color: '#555', lineHeight: 1.8, fontSize: 10 }}>
                {deliverableItems.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </td>
            <td style={{ padding: '9px 12px', textAlign: 'right', verticalAlign: 'top', fontWeight: 900, fontSize: 15, color: '#F26B4E', whiteSpace: 'nowrap' }}>
              {inrFmt(finalTotal)}
            </td>
          </tr>
          <tr style={{ background: '#fffaf9' }}>
            <td style={{ padding: '7px 12px', fontWeight: 700, fontSize: 10, color: '#888', textAlign: 'right' }}>GST @ 18%</td>
            <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: '#888', fontSize: 11, whiteSpace: 'nowrap' }}>{inrFmt(gst)}</td>
          </tr>
          <tr style={{ background: '#fff5f2', borderTop: '2px solid #F26B4E' }}>
            <td style={{ padding: '7px 12px', fontWeight: 900, color: '#2D2D2D' }}>TOTAL (incl. GST)</td>
            <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 900, fontSize: 13, color: '#2D2D2D', whiteSpace: 'nowrap' }}>{inrFmt(totalInc)}</td>
          </tr>
        </tbody>
      </table>

      {/* Amount in words */}
      <div style={{ fontSize: 10, color: '#555', marginBottom: 12, fontStyle: 'italic' }}>
        <strong>Amount in words (ex-GST):</strong> Rupees {inrWords(finalTotal)} Only
      </div>

      {/* Notes */}
      <div style={{
        background: '#f8f9fa', borderLeft: '3px solid #F26B4E',
        borderRadius: '0 6px 6px 0', padding: '8px 12px',
        fontSize: 9.5, color: '#555', lineHeight: 1.6, marginBottom: 14,
      }}>
        <strong style={{ color: '#2D2D2D', fontSize: 10 }}>Note:</strong> {noteText}
      </div>

      {/* Li Carbonate chart */}
      <div style={{ borderTop: '1.5px solid #e5e7eb', paddingTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontWeight: 900, fontSize: 10, color: '#2D2D2D', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            Lithium Carbonate Index (USD / Metric Ton)
          </div>
          {liLatest && (
            <div style={{ fontSize: 10, fontWeight: 700, color: '#F26B4E' }}>
              Latest: ${liLatest.value.toFixed(0)}/t ({liLatest.date}) · Fastmarkets / BloombergNEF
            </div>
          )}
        </div>

        <div style={{ height: 120 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={liData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#aaa' }} interval="preserveStartEnd" tickLine={false}/>
                <YAxis tick={{ fontSize: 8, fill: '#aaa' }} tickLine={false} axisLine={false}
                  tickFormatter={v => `$${(v/1000).toFixed(0)}k`}/>
                <Tooltip
                  contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #e5e7eb' }}
                  formatter={v => [`$${Number(v).toFixed(0)}/t`, 'Li Carbonate']}/>
                <Line type="monotone" dataKey="value" stroke="#F26B4E" strokeWidth={2}
                  dot={false} activeDot={{ r: 4, fill: '#F26B4E' }}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        <div style={{ fontSize: 8.5, color: '#bbb', marginTop: 4, textAlign: 'right' }}>
          Source: Fastmarkets / BloombergNEF · Quarterly avg Li₂CO₃ (battery-grade) · Prices indicative only
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'absolute', bottom: '8mm', left: '14mm', right: '14mm',
        borderTop: '1px solid #e5e7eb', paddingTop: 6,
        display: 'flex', justifyContent: 'space-between',
        fontSize: 8.5, color: '#aaa',
      }}>
        <span>Ornate Agencies Pvt. Ltd. · New Delhi, India · ornatesolar.com</span>
        <span>This is a budgetary offer only. Subject to final terms at time of order.</span>
      </div>
    </div>
  );
}
