import { useState } from 'react';
import { Receipt, Plus, ExternalLink, ShieldCheck, Zap, BookOpen, FileText, Globe, ArrowUpRight, TrendingUp } from 'lucide-react';
import { useApi } from '../hooks/useApi.js';
import { bessApi } from '../lib/api.js';
import { date } from '../lib/fmt.js';
import { Spinner, ErrorBanner } from '../components/Spinner.jsx';
import Modal, { Field, Input, FormGrid, SubmitRow } from '../components/Modal.jsx';

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan',
  'Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Delhi','Jammu & Kashmir','Ladakh','Chandigarh','Puducherry',
];

const EMPTY = {
  state:'', discom:'', tariff_category:'', effective_date:'',
  energy_charge_peak:'', energy_charge_offpeak:'',
  demand_charge:'', fixed_charge:'',
};

const REFS = [
  {
    label: 'CERC BESS Regulations 2022',
    url: 'https://www.cercind.gov.in',
    body: 'Central Electricity Regulatory Commission',
    icon: ShieldCheck,
    color: '#3B82F6',
    tag: 'Regulatory',
  },
  {
    label: 'CEA Grid Connectivity Standards 2023',
    url: 'https://cea.nic.in',
    body: 'Central Electricity Authority',
    icon: Zap,
    color: '#F59E0B',
    tag: 'Grid',
  },
  {
    label: 'MNRE BESS Guidelines',
    url: 'https://mnre.gov.in',
    body: 'Ministry of New & Renewable Energy',
    icon: Globe,
    color: '#10B981',
    tag: 'Policy',
  },
  {
    label: 'IEC 62619',
    url: '#',
    body: 'Safety Requirements for LFP Battery Systems',
    icon: FileText,
    color: '#8B5CF6',
    tag: 'IEC Standard',
  },
  {
    label: 'IEC 62477',
    url: '#',
    body: 'PCS Safety Requirements',
    icon: BookOpen,
    color: '#EC4899',
    tag: 'IEC Standard',
  },
];

export default function TariffStructures() {
  const [open, setOpen]       = useState(false);
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [refresh, setRefresh] = useState(0);

  const { data, loading, error } = useApi(bessApi.tariffs, [refresh]);
  if (loading) return <Spinner />;
  if (error)   return <ErrorBanner message={error} />;
  const rows = data ?? [];

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const avgSpread = rows.length
    ? (rows.reduce((s, t) => s + (t.energy_charge_peak - t.energy_charge_offpeak), 0) / rows.length).toFixed(2)
    : null;
  const maxPeak = rows.length
    ? Math.max(...rows.map(t => parseFloat(t.energy_charge_peak) || 0)).toFixed(2)
    : null;

  const handleSubmit = async e => {
    e.preventDefault();
    setSaveErr('');
    if (!form.state)  { setSaveErr('State is required.'); return; }
    if (!form.discom) { setSaveErr('DISCOM is required.'); return; }
    if (!form.tariff_category)     { setSaveErr('Tariff category is required.'); return; }
    if (!form.energy_charge_peak)  { setSaveErr('Peak energy charge is required.'); return; }
    if (!form.energy_charge_offpeak) { setSaveErr('Off-peak energy charge is required.'); return; }
    setSaving(true);
    try {
      await bessApi.createTariff(form);
      setOpen(false);
      setForm(EMPTY);
      setRefresh(r => r + 1);
    } catch (err) {
      setSaveErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex gap-6 items-start">

      {/* ── Left: main content ── */}
      <div className="flex-1 min-w-0 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-black text-foreground tracking-tight m-0">Tariff Structures</h1>
            <p className="text-[13px] text-muted-foreground mt-1">{rows.length} tariff records · State-wise DISCOM</p>
          </div>
          <button
            className="btn-primary"
            onClick={() => { setForm(EMPTY); setSaveErr(''); setOpen(true); }}
          >
            <Plus size={14} style={{ marginRight: 6, display: 'inline' }} />Add Tariff
          </button>
        </div>

        {/* Tariff cards grid */}
        {rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">No tariff records yet.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
            {rows.map(t => (
              <div key={t.id} className="section-card">
                <div style={{
                  padding: '14px 16px',
                  background: '#2D2D2D',
                  borderRadius: '12px 12px 0 0',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontWeight: 800, color: 'white', fontSize: 14 }}>{t.state}</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 1 }}>{t.discom}</div>
                  </div>
                  <span style={{
                    background: '#F26B4E', color: 'white',
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
                  }}>
                    {t.tariff_category}
                  </span>
                </div>
                <div style={{ padding: '14px 16px' }}>
                  {[
                    ['Peak Energy Charge',     `₹${t.energy_charge_peak}/kWh`],
                    ['Off-Peak Energy Charge', `₹${t.energy_charge_offpeak}/kWh`],
                    ['Demand Charge',          `₹${t.demand_charge}/kVA/month`],
                    ['ToD Spread',             `₹${(t.energy_charge_peak - t.energy_charge_offpeak).toFixed(2)}/kWh`],
                    ['Effective From',          date(t.effective_date)],
                  ].map(([k, v], i, arr) => (
                    <div key={k} style={{
                      display: 'flex', justifyContent: 'space-between', padding: '7px 0',
                      borderBottom: i < arr.length - 1 ? '1px solid #F3F4F6' : 'none',
                    }}>
                      <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{k}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: k === 'ToD Spread' ? '#F26B4E' : '#2D2D2D' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Right: sticky sidebar ── */}
      <div className="w-[248px] shrink-0 flex flex-col gap-4" style={{ position: 'sticky', top: 0 }}>

        {/* Stats panel */}
        {rows.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #2D2D2D 0%, #1a1a1a 100%)',
            borderRadius: 16,
            padding: '18px 16px',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
          }}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={13} color="#F26B4E" />
              <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                Quick Stats
              </span>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#F26B4E', lineHeight: 1 }}>
                  ₹{avgSpread}
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>/kWh</span>
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avg ToD Spread</div>
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: 'white', lineHeight: 1 }}>
                  ₹{maxPeak}
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>/kWh</span>
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Highest Peak Rate</div>
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: 'white', lineHeight: 1 }}>{rows.length}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>States Covered</div>
              </div>
            </div>
          </div>
        )}

        {/* Regulatory References panel */}
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid rgba(0,0,0,0.07)',
          boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
        }}>
          {/* Panel header */}
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg, #F26B4E 0%, #e04d2e 100%)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <ShieldCheck size={14} color="white" />
            <span style={{ fontSize: 11, fontWeight: 800, color: 'white', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
              Regulatory References
            </span>
          </div>

          {/* Links */}
          <div style={{ padding: '8px 0' }}>
            {REFS.map(({ label, url, body, icon: Icon, color, tag }, i) => (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none', display: 'block' }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    borderBottom: i < REFS.length - 1 ? '1px solid #F5F5F5' : 'none',
                    transition: 'background 0.12s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${color}0a`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: `${color}14`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginTop: 1,
                  }}>
                    <Icon size={13} color={color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--foreground))', lineHeight: 1.3 }}>{label}</span>
                      {url !== '#' && <ArrowUpRight size={11} color="#9CA3AF" style={{ flexShrink: 0 }} />}
                    </div>
                    <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', marginTop: 2, lineHeight: 1.4 }}>{body}</div>
                    <span style={{
                      display: 'inline-block', marginTop: 5,
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
                      background: `${color}14`, color: color,
                      padding: '2px 6px', borderRadius: 4,
                    }}>{tag}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>

          {/* Footer note */}
          <div style={{
            padding: '10px 14px',
            background: 'hsl(var(--muted))',
            borderTop: '1px solid #F0F0F0',
            fontSize: 10, color: '#BBBBBB', lineHeight: 1.5,
            fontStyle: 'italic',
          }}>
            Always verify tariff data against the latest DISCOM order before finalising proposals.
          </div>
        </div>
      </div>

      {/* ── Add Tariff Modal ── */}
      <Modal open={open} onClose={() => setOpen(false)} title="Add Tariff Structure" width={560}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <FormGrid cols={2}>
            <Field label="State" required>
              <select className="bess-input" value={form.state}
                onChange={e => set('state', e.target.value)} style={{ width: '100%' }}>
                <option value="">Select state…</option>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="DISCOM" required>
              <Input placeholder="e.g. DHBVN, MSEDCL, BESCOM"
                value={form.discom} onChange={e => set('discom', e.target.value)} />
            </Field>
          </FormGrid>

          <FormGrid cols={2}>
            <Field label="Tariff Category" required hint="e.g. HT - Industrial, LT - Commercial">
              <Input placeholder="e.g. HT - Industrial"
                value={form.tariff_category} onChange={e => set('tariff_category', e.target.value)} />
            </Field>
            <Field label="Effective Date">
              <Input type="date" value={form.effective_date} onChange={e => set('effective_date', e.target.value)} />
            </Field>
          </FormGrid>

          <div style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>ToD Energy Charges</div>
            <FormGrid cols={2}>
              <Field label="Peak Energy Charge (₹/kWh)" required>
                <Input type="number" min="0" step="0.01" placeholder="e.g. 9.50"
                  value={form.energy_charge_peak} onChange={e => set('energy_charge_peak', e.target.value)} />
              </Field>
              <Field label="Off-Peak Energy Charge (₹/kWh)" required>
                <Input type="number" min="0" step="0.01" placeholder="e.g. 6.20"
                  value={form.energy_charge_offpeak} onChange={e => set('energy_charge_offpeak', e.target.value)} />
              </Field>
            </FormGrid>
            {form.energy_charge_peak && form.energy_charge_offpeak && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#F26B4E', fontWeight: 700 }}>
                ToD Spread: ₹{(Number(form.energy_charge_peak) - Number(form.energy_charge_offpeak)).toFixed(2)}/kWh
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Fixed & Demand Charges</div>
            <FormGrid cols={2}>
              <Field label="Demand Charge (₹/kVA/month)">
                <Input type="number" min="0" step="0.5" placeholder="e.g. 320"
                  value={form.demand_charge} onChange={e => set('demand_charge', e.target.value)} />
              </Field>
              <Field label="Fixed Charge (₹/kVA/month)">
                <Input type="number" min="0" step="0.5" placeholder="e.g. 50"
                  value={form.fixed_charge} onChange={e => set('fixed_charge', e.target.value)} />
              </Field>
            </FormGrid>
          </div>

          {saveErr && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#DC2626', fontWeight: 600 }}>
              {saveErr}
            </div>
          )}

          <SubmitRow onClose={() => setOpen(false)} loading={saving} label="Add Tariff" />
        </form>
      </Modal>

    </div>
  );
}
