import { useState } from 'react';
import { MapPin, Zap, Plus, Pencil } from 'lucide-react';
import { useApiMulti } from '../hooks/useApi.js';
import { bessApi } from '../lib/api.js';
import { Spinner, ErrorBanner } from '../components/Spinner.jsx';
import Modal, { Field, Input, FormGrid, SubmitRow } from '../components/Modal.jsx';

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan',
  'Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Delhi','Jammu & Kashmir','Ladakh','Chandigarh','Puducherry',
];

const TARIFF_CATEGORIES = [
  'HT - Industrial','HT - Commercial','LT - Industrial','LT - Commercial',
  'EHT - Industrial','EHT - Commercial','HT - General','LT - General',
];

const EMPTY = {
  client_id:'', site_name:'', address:'', state:'', discom:'',
  tariff_category:'', sanctioned_load_kva:'', contract_demand_kva:'',
  connection_voltage_kv:'', meter_number:'',
};

const categoryColor = { HT:'#F26B4E', LT:'#3B82F6', EHT:'#7C3AED' };
const catKey = cat => cat?.split(' - ')[0] ?? '';

export default function Sites() {
  const [open, setOpen]             = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [saveErr, setSaveErr]       = useState('');
  const [refresh, setRefresh]       = useState(0);

  const { sites, clients } = useApiMulti({
    sites:   bessApi.sites,
    clients: bessApi.clients,
  }, [refresh]);

  const loading = sites?.loading || clients?.loading;
  if (loading) return <Spinner />;
  if (sites?.error) return <ErrorBanner message={sites.error} />;

  const rows = sites?.data   ?? [];
  const cl   = clients?.data ?? [];

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY);
    setSaveErr('');
    setOpen(true);
  };

  const openEdit = (site) => {
    setEditTarget(site);
    setForm({
      client_id:             String(site.client_id ?? ''),
      site_name:             site.site_name             ?? '',
      address:               site.address               ?? '',
      state:                 site.state                 ?? '',
      discom:                site.discom                ?? '',
      tariff_category:       site.tariff_category       ?? '',
      sanctioned_load_kva:   String(site.sanctioned_load_kva   ?? ''),
      contract_demand_kva:   String(site.contract_demand_kva   ?? ''),
      connection_voltage_kv: String(site.connection_voltage_kv ?? ''),
      meter_number:          site.meter_number          ?? '',
    });
    setSaveErr('');
    setOpen(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSaveErr('');
    if (!editTarget && !form.client_id) { setSaveErr('Please select a client.'); return; }
    if (!form.site_name.trim()) { setSaveErr('Site name is required.'); return; }
    setSaving(true);
    try {
      if (editTarget) {
        await bessApi.patchSite(editTarget.id, form);
      } else {
        await bessApi.createSite(form);
      }
      setOpen(false);
      setEditTarget(null);
      setForm(EMPTY);
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
          <h1 style={{ fontSize:22, fontWeight:900, color:'hsl(var(--foreground))', margin:0 }}>Sites</h1>
          <p style={{ fontSize:13, color:'hsl(var(--muted-foreground))', margin:'4px 0 0' }}>{rows.length} registered sites</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          <Plus size={14} style={{ marginRight:6, display:'inline' }} />Add Site
        </button>
      </div>

      {/* Tile grid */}
      {rows.length === 0
        ? <div style={{ padding:48, textAlign:'center', color:'hsl(var(--muted-foreground))', fontSize:14 }}>No sites yet.</div>
        : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:16 }}>
            {rows.map(s => {
              const ck = catKey(s.tariff_category);
              const cc = categoryColor[ck] ?? '#9CA3AF';
              return (
                <div key={s.id} className="kpi-card" style={{ position:'relative' }}>
                  <button
                    onClick={() => openEdit(s)}
                    style={{ position:'absolute', top:12, right:12, background:'hsl(var(--muted))', border:'none', borderRadius:6, padding:'5px 7px', cursor:'pointer', color:'hsl(var(--muted-foreground))', display:'flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600 }}
                    onMouseEnter={e => { e.currentTarget.style.background='#FEF2EF'; e.currentTarget.style.color='#F26B4E'; }}
                    onMouseLeave={e => { e.currentTarget.style.background='#F3F4F6'; e.currentTarget.style.color='#6B7280'; }}
                  >
                    <Pencil size={11} /> Edit
                  </button>

                  <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:12, paddingRight:52 }}>
                    <div style={{ width:38, height:38, borderRadius:9, background:`${cc}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <MapPin size={17} color={cc} />
                    </div>
                    <div>
                      <div style={{ fontWeight:800, fontSize:14, color:'hsl(var(--foreground))', lineHeight:1.3 }}>{s.site_name}</div>
                      <div style={{ fontSize:12, color:'hsl(var(--muted-foreground))', marginTop:2 }}>{s.company_name}</div>
                    </div>
                  </div>

                  {s.tariff_category && (
                    <span style={{ display:'inline-block', background:`${cc}18`, color:cc, fontWeight:700, fontSize:11, padding:'2px 10px', borderRadius:12, marginBottom:10 }}>
                      {s.tariff_category}
                    </span>
                  )}

                  {(s.state || s.discom) && (
                    <div style={{ fontSize:12, color:'hsl(var(--muted-foreground))', marginBottom:10 }}>
                      {[s.state, s.discom].filter(Boolean).join(' · ')}
                    </div>
                  )}

                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', borderTop:'1px solid hsl(var(--border))', paddingTop:10, gap:6 }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:800, color:'hsl(var(--foreground))', display:'flex', alignItems:'center', gap:4 }}>
                        <Zap size={11} color="#F26B4E" />{Number(s.sanctioned_load_kva || 0).toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize:10, color:'hsl(var(--muted-foreground))', fontWeight:600, textTransform:'uppercase', marginTop:1 }}>Sanct. kVA</div>
                    </div>
                    <div>
                      <div style={{ fontSize:12, fontWeight:800, color:'hsl(var(--foreground))' }}>{Number(s.contract_demand_kva || 0).toLocaleString('en-IN')}</div>
                      <div style={{ fontSize:10, color:'hsl(var(--muted-foreground))', fontWeight:600, textTransform:'uppercase', marginTop:1 }}>Contract kVA</div>
                    </div>
                    <div>
                      <div style={{ fontSize:12, fontWeight:800, color:'hsl(var(--foreground))', fontFamily:'monospace' }}>{s.connection_voltage_kv || '—'} kV</div>
                      <div style={{ fontSize:10, color:'hsl(var(--muted-foreground))', fontWeight:600, textTransform:'uppercase', marginTop:1 }}>Voltage</div>
                    </div>
                  </div>

                  {s.meter_number && (
                    <div style={{ marginTop:8, fontSize:11, color:'hsl(var(--muted-foreground))', fontFamily:'monospace' }}>Meter: {s.meter_number}</div>
                  )}
                </div>
              );
            })}
          </div>
      }

      {/* ── Add / Edit Site Modal ── */}
      <Modal open={open} onClose={() => { setOpen(false); setEditTarget(null); }} title={editTarget ? `Edit — ${editTarget.site_name}` : 'Add New Site'} width={580}>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>

          <FormGrid cols={2}>
            <Field label="Client" required={!editTarget}>
              <select className="bess-input" value={form.client_id}
                onChange={e => set('client_id', e.target.value)} style={{ width:'100%' }}
                disabled={!!editTarget}>
                <option value="">Select client…</option>
                {cl.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </Field>
            <Field label="Site Name" required>
              <Input placeholder="e.g. Amrita Hospital — Faridabad" value={form.site_name} onChange={e => set('site_name', e.target.value)} />
            </Field>
          </FormGrid>

          <Field label="Address">
            <Input placeholder="Full address of the metering point" value={form.address} onChange={e => set('address', e.target.value)} />
          </Field>

          <FormGrid cols={2}>
            <Field label="State">
              <select className="bess-input" value={form.state}
                onChange={e => set('state', e.target.value)} style={{ width:'100%' }}>
                <option value="">Select state…</option>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="DISCOM">
              <Input placeholder="e.g. DHBVN, MSEDCL, BESCOM" value={form.discom} onChange={e => set('discom', e.target.value)} />
            </Field>
          </FormGrid>

          <FormGrid cols={2}>
            <Field label="Tariff Category">
              <select className="bess-input" value={form.tariff_category}
                onChange={e => set('tariff_category', e.target.value)} style={{ width:'100%' }}>
                <option value="">Select category…</option>
                {TARIFF_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Meter Number">
              <Input placeholder="EB meter number" value={form.meter_number} onChange={e => set('meter_number', e.target.value)} />
            </Field>
          </FormGrid>

          <FormGrid cols={3}>
            <Field label="Sanctioned Load (kVA)">
              <Input type="number" min="0" step="0.1" placeholder="e.g. 500"
                value={form.sanctioned_load_kva} onChange={e => set('sanctioned_load_kva', e.target.value)} />
            </Field>
            <Field label="Contract Demand (kVA)">
              <Input type="number" min="0" step="0.1" placeholder="e.g. 400"
                value={form.contract_demand_kva} onChange={e => set('contract_demand_kva', e.target.value)} />
            </Field>
            <Field label="Voltage (kV)">
              <Input type="number" min="0" step="0.001" placeholder="e.g. 11"
                value={form.connection_voltage_kv} onChange={e => set('connection_voltage_kv', e.target.value)} />
            </Field>
          </FormGrid>

          {saveErr && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#DC2626', fontWeight:600 }}>
              {saveErr}
            </div>
          )}

          <SubmitRow onClose={() => { setOpen(false); setEditTarget(null); }} loading={saving}
            label={editTarget ? 'Save Changes' : 'Add Site'} />
        </form>
      </Modal>

    </div>
  );
}
