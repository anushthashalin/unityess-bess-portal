import { useState, useCallback } from 'react';
import { Search, Plus, Mail, Phone, MapPin, Building } from 'lucide-react';
import { useApiMulti } from '../hooks/useApi.js';
import { bessApi } from '../lib/api.js';
import { inr } from '../lib/fmt.js';
import { Spinner, ErrorBanner } from '../components/Spinner.jsx';
import Modal, { Field, Input, FormGrid, SubmitRow } from '../components/Modal.jsx';

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan',
  'Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Delhi','Jammu & Kashmir','Ladakh','Chandigarh','Puducherry',
];

const EMPTY = { company_name:'', contact_person:'', email:'', phone:'', city:'', state:'', gstin:'' };

export default function Clients() {
  const [search, setSearch]     = useState('');
  const [open, setOpen]         = useState(false);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [saveErr, setSaveErr]   = useState('');
  const [refresh, setRefresh]   = useState(0);

  const { clients, proposals, projects } = useApiMulti({
    clients:   bessApi.clients,
    proposals: bessApi.proposals,
    projects:  bessApi.projects,
  }, [refresh]);

  const loading = clients?.loading || proposals?.loading || projects?.loading;
  if (loading) return <Spinner />;
  if (clients?.error) return <ErrorBanner message={clients.error} />;

  const cl = clients?.data   ?? [];
  const pr = proposals?.data ?? [];
  const pj = projects?.data  ?? [];

  const filtered = cl.filter(c =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.state ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async e => {
    e.preventDefault();
    setSaveErr('');
    if (!form.company_name.trim()) { setSaveErr('Company name is required.'); return; }
    setSaving(true);
    try {
      await bessApi.createClient(form);
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
          <h1 style={{ fontSize:22, fontWeight:900, color:'#2D2D2D', margin:0 }}>Clients</h1>
          <p style={{ fontSize:13, color:'#9CA3AF', margin:'4px 0 0' }}>{cl.length} clients</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(EMPTY); setSaveErr(''); setOpen(true); }}>
          <Plus size={14} style={{ marginRight:6, display:'inline' }} />Add Client
        </button>
      </div>

      {/* Search */}
      <div style={{ position:'relative', maxWidth:340 }}>
        <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#9CA3AF' }} />
        <input className="bess-input" style={{ paddingLeft:36, width:'100%' }}
          placeholder="Search by name or state…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Cards */}
      {filtered.length === 0
        ? <div style={{ padding:48, textAlign:'center', color:'#9CA3AF', fontSize:14 }}>
            No clients yet. Add your first client to get started.
          </div>
        : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
            {filtered.map(client => {
              const clientProposals = pr.filter(p => p.client_id === client.id);
              const clientProjects  = pj.filter(p => p.client_id === client.id);
              const totalCapex      = clientProposals.reduce((s, p) => s + Number(p.capex_ex_gst ?? 0), 0);
              return (
                <div key={client.id} className="kpi-card" style={{ cursor:'pointer' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:40, height:40, borderRadius:10, background:'#FEF2EF', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <Building size={18} color="#F26B4E" />
                      </div>
                      <div>
                        <div style={{ fontWeight:800, fontSize:14, color:'#2D2D2D' }}>{client.company_name}</div>
                        <div style={{ fontSize:12, color:'#6B7280', marginTop:1 }}>{client.contact_person}</div>
                      </div>
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, color:'#F26B4E', background:'#FEF2EF', padding:'2px 8px', borderRadius:12 }}>
                      {clientProjects.length > 0 ? 'Active' : 'Lead'}
                    </span>
                  </div>

                  <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
                    {client.email && <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'#6B7280' }}><Mail size={12} color="#9CA3AF" />{client.email}</div>}
                    {client.phone && <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'#6B7280' }}><Phone size={12} color="#9CA3AF" />{client.phone}</div>}
                    {(client.city || client.state) && <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'#6B7280' }}><MapPin size={12} color="#9CA3AF" />{[client.city, client.state].filter(Boolean).join(', ')}</div>}
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', borderTop:'1px solid #F3F4F6', paddingTop:12, gap:8 }}>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:18, fontWeight:900, color:'#2D2D2D' }}>{clientProposals.length}</div>
                      <div style={{ fontSize:10, color:'#9CA3AF', fontWeight:600, textTransform:'uppercase' }}>Proposals</div>
                    </div>
                    <div style={{ textAlign:'center', borderLeft:'1px solid #F3F4F6', borderRight:'1px solid #F3F4F6' }}>
                      <div style={{ fontSize:18, fontWeight:900, color:'#2D2D2D' }}>{clientProjects.length}</div>
                      <div style={{ fontSize:10, color:'#9CA3AF', fontWeight:600, textTransform:'uppercase' }}>Projects</div>
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:16, fontWeight:900, color:'#F26B4E' }}>{inr(totalCapex)}</div>
                      <div style={{ fontSize:10, color:'#9CA3AF', fontWeight:600, textTransform:'uppercase' }}>Value</div>
                    </div>
                  </div>
                  {client.gstin && <div style={{ marginTop:10, fontSize:11, color:'#9CA3AF', fontFamily:'monospace' }}>GSTIN: {client.gstin}</div>}
                </div>
              );
            })}
          </div>
      }

      {/* ── Add Client Modal ── */}
      <Modal open={open} onClose={() => setOpen(false)} title="Add New Client" width={560}>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <FormGrid cols={1}>
            <Field label="Company Name" required>
              <Input placeholder="e.g. Amrita Hospitals Pvt. Ltd." value={form.company_name} onChange={e => set('company_name', e.target.value)} />
            </Field>
          </FormGrid>

          <FormGrid cols={2}>
            <Field label="Contact Person">
              <Input placeholder="e.g. Rajesh Kumar" value={form.contact_person} onChange={e => set('contact_person', e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input placeholder="+91 98XXXXXXXX" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </Field>
            <Field label="Email" cols={2}>
              <Input type="email" placeholder="contact@company.com" value={form.email} onChange={e => set('email', e.target.value)} />
            </Field>
          </FormGrid>

          <FormGrid cols={2}>
            <Field label="City">
              <Input placeholder="e.g. New Delhi" value={form.city} onChange={e => set('city', e.target.value)} />
            </Field>
            <Field label="State">
              <select
                className="bess-input"
                value={form.state}
                onChange={e => set('state', e.target.value)}
                style={{ width:'100%' }}
              >
                <option value="">Select state…</option>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </FormGrid>

          <FormGrid cols={1}>
            <Field label="GSTIN" hint="15-character GST identification number (optional)">
              <Input placeholder="e.g. 07AABCU9603R1ZX" value={form.gstin}
                onChange={e => set('gstin', e.target.value.toUpperCase())}
                style={{ fontFamily:'monospace', letterSpacing:'0.5px' }} />
            </Field>
          </FormGrid>

          {saveErr && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#DC2626', fontWeight:600 }}>
              {saveErr}
            </div>
          )}

          <SubmitRow onClose={() => setOpen(false)} loading={saving} label="Add Client" />
        </form>
      </Modal>

    </div>
  );
}
