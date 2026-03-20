import { useState } from 'react';
import { MapPin, Zap, Plus } from 'lucide-react';
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
  const [open, setOpen]       = useState(false);
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [refresh, setRefresh] = useState(0);

  const { sites, clients } = useApiMulti({
    sites:   bessApi.sites,
    clients: bessApi.clients,
  }, [refresh]);

  const loading = sites?.loading || clients?.loading;
  if (loading) return <Spinner />;
  if (sites?.error) return <ErrorBanner message={sites.error} />;

  const rows   = sites?.data   ?? [];
  const cl     = clients?.data ?? [];

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async e => {
    e.preventDefault();
    setSaveErr('');
    if (!form.client_id) { setSaveErr('Please select a client.'); return; }
    if (!form.site_name.trim()) { setSaveErr('Site name is required.'); return; }
    setSaving(true);
    try {
      await bessApi.createSite(form);
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
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:900, color:'#2D2D2D', margin:0 }}>Sites</h1>
          <p style={{ fontSize:13, color:'#9CA3AF', margin:'4px 0 0' }}>{rows.length} registered sites</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(EMPTY); setSaveErr(''); setOpen(true); }}>
          <Plus size={14} style={{ marginRight:6, display:'inline' }} />Add Site
        </button>
      </div>

      {/* Table */}
      <div className="section-card">
        {rows.length === 0
          ? <div style={{ padding:48, textAlign:'center', color:'#9CA3AF', fontSize:14 }}>No sites yet.</div>
          : <div style={{ overflowX:'auto' }}>
              <table className="bess-table">
                <thead>
                  <tr>
                    <th>Site Name</th><th>Client</th><th>State / DISCOM</th>
                    <th>Category</th><th>Sanctioned Load</th><th>Contract Demand</th><th>Voltage</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(s => (
                    <tr key={s.id}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <MapPin size={14} color="#F26B4E" />
                          <span style={{ fontWeight:700 }}>{s.site_name}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight:600 }}>{s.company_name}</td>
                      <td>
                        <div style={{ fontWeight:600 }}>{s.state}</div>
                        <div style={{ fontSize:11, color:'#9CA3AF' }}>{s.discom}</div>
                      </td>
                      <td>
                        <span style={{
                          background:`${categoryColor[catKey(s.tariff_category)] ?? '#9CA3AF'}18`,
                          color: categoryColor[catKey(s.tariff_category)] ?? '#9CA3AF',
                          fontWeight:700, fontSize:12, padding:'2px 10px', borderRadius:12,
                        }}>
                          {s.tariff_category}
                        </span>
                      </td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <Zap size={12} color="#9CA3AF" />
                          {Number(s.sanctioned_load_kva).toLocaleString('en-IN')} kVA
                        </div>
                      </td>
                      <td>{Number(s.contract_demand_kva).toLocaleString('en-IN')} kVA</td>
                      <td style={{ fontFamily:'monospace', fontWeight:700 }}>{s.connection_voltage_kv} kV</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>

      {/* ── Add Site Modal ── */}
      <Modal open={open} onClose={() => setOpen(false)} title="Add New Site" width={580}>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>

          <FormGrid cols={2}>
            <Field label="Client" required>
              <select className="bess-input" value={form.client_id}
                onChange={e => set('client_id', e.target.value)} style={{ width:'100%' }}>
                <option value="">Select client…</option>
                {cl.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </Field>
            <Field label="Site Name" required>
              <Input placeholder="e.g. Amrita Hospital — Faridabad" value={form.site_name} onChange={e => set('site_name', e.target.value)} />
            </Field>
          </FormGrid>

          <FormGrid cols={1}>
            <Field label="Address">
              <Input placeholder="Full address of the metering point" value={form.address} onChange={e => set('address', e.target.value)} />
            </Field>
          </FormGrid>

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

          <SubmitRow onClose={() => setOpen(false)} loading={saving} label="Add Site" />
        </form>
      </Modal>

    </div>
  );
}
