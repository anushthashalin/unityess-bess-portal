import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts';
import { Plus } from 'lucide-react';
import { useApi, useApiMulti } from '../hooks/useApi.js';
import { bessApi } from '../lib/api.js';
import { Spinner, ErrorBanner } from '../components/Spinner.jsx';
import Modal, { Field, Input, FormGrid, SubmitRow } from '../components/Modal.jsx';

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_NUMS = [1,2,3,4,5,6,7,8,9,10,11,12];

const now   = new Date();
const EMPTY = {
  site_id:'', month: String(now.getMonth() + 1), year: String(now.getFullYear()),
  total_units_kwh:'', max_demand_kw:'', peak_demand_kw:'',
  tod_peak_kwh:'', tod_offpeak_kwh:'', tod_night_kwh:'',
};

export default function LoadProfiles() {
  const [siteId, setSiteId] = useState(null);
  const [open, setOpen]     = useState(false);
  const [form, setForm]     = useState(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [refresh, setRefresh] = useState(0);

  const { data: sites, loading: sl } = useApi(bessApi.sites);
  const { data: profiles, loading: pl, error } = useApi(
    () => bessApi.loadProfiles(siteId ?? (sites?.[0]?.id ?? 1)),
    [siteId, sites, refresh]
  );

  if (sl || pl) return <Spinner />;
  if (error)    return <ErrorBanner message={error} />;

  const siteList = sites ?? [];
  const rows     = profiles ?? [];

  const chartData = rows.map(lp => ({
    name:           `${MONTHS[lp.month]} '${String(lp.year).slice(2)}`,
    'Peak kWh':      Number(lp.tod_peak_kwh),
    'Off-Peak kWh':  Number(lp.tod_offpeak_kwh),
    'Night kWh':     Number(lp.tod_night_kwh),
    'Max Demand kW': Number(lp.max_demand_kw),
  }));

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openModal = () => {
    setForm({ ...EMPTY, site_id: siteId ? String(siteId) : (siteList[0]?.id ? String(siteList[0].id) : '') });
    setSaveErr('');
    setOpen(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSaveErr('');
    if (!form.site_id) { setSaveErr('Please select a site.'); return; }
    if (!form.total_units_kwh) { setSaveErr('Total units (kWh) is required.'); return; }
    setSaving(true);
    try {
      await bessApi.createLoadProfile(form);
      setOpen(false);
      setRefresh(r => r + 1);
    } catch (err) {
      setSaveErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:900, color:'hsl(var(--foreground))', margin:0 }}>Load Profiles</h1>
          <p style={{ fontSize:13, color:'hsl(var(--muted-foreground))', margin:'4px 0 0' }}>EB meter data by site</p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <select className="bess-input" value={siteId ?? ''}
            onChange={e => setSiteId(e.target.value || null)}>
            <option value="">Select site…</option>
            {siteList.map(s => <option key={s.id} value={s.id}>{s.site_name}</option>)}
          </select>
          <button className="btn-primary" onClick={openModal}>
            <Plus size={14} style={{ marginRight:6, display:'inline' }} />Upload EB Data
          </button>
        </div>
      </div>

      {rows.length === 0
        ? <div style={{ padding:64, textAlign:'center', color:'hsl(var(--muted-foreground))', fontSize:14 }}>
            No load profile data for this site yet. Upload the first month's EB data.
          </div>
        : <>
            {/* ToD bar chart */}
            <div className="section-card">
              <div className="section-header">
                <span className="section-title">Monthly ToD Energy</span>
                <span style={{ fontSize:12, color:'hsl(var(--muted-foreground))' }}>kWh by slot</span>
              </div>
              <div style={{ padding:'16px 8px' }}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ left:10, right:20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="name" tick={{ fontSize:12 }} />
                    <YAxis tick={{ fontSize:11 }} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={v=>`${Number(v).toLocaleString('en-IN')} kWh`} />
                    <Legend wrapperStyle={{ fontSize:12 }} />
                    <Bar dataKey="Peak kWh"     stackId="a" fill="#F26B4E" />
                    <Bar dataKey="Off-Peak kWh" stackId="a" fill="#3B82F6" />
                    <Bar dataKey="Night kWh"    stackId="a" fill="#7C3AED" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Max demand area chart */}
            <div className="section-card">
              <div className="section-header">
                <span className="section-title">Max Demand Trend</span>
                <span style={{ fontSize:12, color:'hsl(var(--muted-foreground))' }}>kW</span>
              </div>
              <div style={{ padding:'16px 8px' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ left:10, right:20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="name" tick={{ fontSize:12 }} />
                    <YAxis tick={{ fontSize:11 }} domain={['auto','auto']} />
                    <Tooltip formatter={v=>`${v} kW`} />
                    <Area type="monotone" dataKey="Max Demand kW" stroke="#F26B4E" fill="#FEF2EF" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Raw data table */}
            <div className="section-card">
              <div className="section-header"><span className="section-title">Raw Data</span></div>
              <div style={{ overflowX:'auto' }}>
                <table className="bess-table">
                  <thead>
                    <tr>
                      <th>Month</th><th>Total kWh</th><th>Max Demand (kW)</th>
                      <th>Peak kWh</th><th>Off-Peak kWh</th><th>Night kWh</th><th>Peak %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(lp => (
                      <tr key={lp.id}>
                        <td style={{ fontWeight:700 }}>{MONTHS[lp.month]} {lp.year}</td>
                        <td style={{ fontWeight:700 }}>{Number(lp.total_units_kwh).toLocaleString('en-IN')}</td>
                        <td style={{ color:'#F26B4E', fontWeight:700 }}>{lp.max_demand_kw}</td>
                        <td>{Number(lp.tod_peak_kwh).toLocaleString('en-IN')}</td>
                        <td>{Number(lp.tod_offpeak_kwh).toLocaleString('en-IN')}</td>
                        <td>{Number(lp.tod_night_kwh).toLocaleString('en-IN')}</td>
                        <td style={{ color:'#F26B4E', fontWeight:600 }}>
                          {lp.total_units_kwh > 0 ? ((lp.tod_peak_kwh / lp.total_units_kwh) * 100).toFixed(1) : '—'}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
      }

      {/* ── Upload EB Data Modal ── */}
      <Modal open={open} onClose={() => setOpen(false)} title="Upload EB Meter Data" width={580}>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>

          <div style={{ background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#92400E' }}>
            If data for this site + month already exists, it will be overwritten with the new values.
          </div>

          <FormGrid cols={3}>
            <Field label="Site" required>
              <select className="bess-input" value={form.site_id}
                onChange={e => set('site_id', e.target.value)} style={{ width:'100%' }}>
                <option value="">Select site…</option>
                {siteList.map(s => <option key={s.id} value={s.id}>{s.site_name}</option>)}
              </select>
            </Field>
            <Field label="Month">
              <select className="bess-input" value={form.month}
                onChange={e => set('month', e.target.value)} style={{ width:'100%' }}>
                {MONTH_NUMS.map(m => <option key={m} value={m}>{MONTHS[m]}</option>)}
              </select>
            </Field>
            <Field label="Year">
              <Input type="number" min="2020" max="2040" value={form.year} onChange={e => set('year', e.target.value)} />
            </Field>
          </FormGrid>

          <div style={{ borderTop:'1px solid hsl(var(--border))', paddingTop:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'hsl(var(--muted-foreground))', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:12 }}>EB Bill Summary</div>
            <FormGrid cols={3}>
              <Field label="Total Units (kWh)" required>
                <Input type="number" min="0" step="1" placeholder="e.g. 45000"
                  value={form.total_units_kwh} onChange={e => set('total_units_kwh', e.target.value)} />
              </Field>
              <Field label="Max Demand (kW)">
                <Input type="number" min="0" step="0.1" placeholder="e.g. 320"
                  value={form.max_demand_kw} onChange={e => set('max_demand_kw', e.target.value)} />
              </Field>
              <Field label="Peak Demand (kW)">
                <Input type="number" min="0" step="0.1" placeholder="e.g. 280"
                  value={form.peak_demand_kw} onChange={e => set('peak_demand_kw', e.target.value)} />
              </Field>
            </FormGrid>
          </div>

          <div style={{ borderTop:'1px solid hsl(var(--border))', paddingTop:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'hsl(var(--muted-foreground))', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:12 }}>ToD Slot Consumption</div>
            <FormGrid cols={3}>
              <Field label="Peak Slot (kWh)" hint="High tariff hours">
                <Input type="number" min="0" step="1" placeholder="e.g. 12000"
                  value={form.tod_peak_kwh} onChange={e => set('tod_peak_kwh', e.target.value)} />
              </Field>
              <Field label="Off-Peak (kWh)" hint="Normal hours">
                <Input type="number" min="0" step="1" placeholder="e.g. 25000"
                  value={form.tod_offpeak_kwh} onChange={e => set('tod_offpeak_kwh', e.target.value)} />
              </Field>
              <Field label="Night Slot (kWh)" hint="Low tariff hours">
                <Input type="number" min="0" step="1" placeholder="e.g. 8000"
                  value={form.tod_night_kwh} onChange={e => set('tod_night_kwh', e.target.value)} />
              </Field>
            </FormGrid>
          </div>

          {saveErr && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#DC2626', fontWeight:600 }}>
              {saveErr}
            </div>
          )}

          <SubmitRow onClose={() => setOpen(false)} loading={saving} label="Save EB Data" />
        </form>
      </Modal>

    </div>
  );
}
