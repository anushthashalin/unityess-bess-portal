import { useState } from 'react';
import { Search, Plus, Mail, Phone, MapPin, Building, Pencil, Map, LayoutGrid } from 'lucide-react';
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

// Approximate state centres as % of India bounding box (lng 68-97, lat 8-37)
// Format: [x%, y%] where 0,0 = top-left of SVG viewport
const STATE_COORDS = {
  'Andhra Pradesh':     [62, 68], 'Arunachal Pradesh':  [92, 22],
  'Assam':              [87, 28], 'Bihar':              [68, 38],
  'Chhattisgarh':       [60, 52], 'Goa':                [42, 72],
  'Gujarat':            [30, 50], 'Haryana':            [48, 28],
  'Himachal Pradesh':   [50, 18], 'Jharkhand':          [68, 47],
  'Karnataka':          [48, 72], 'Kerala':             [48, 83],
  'Madhya Pradesh':     [52, 46], 'Maharashtra':        [46, 60],
  'Manipur':            [90, 36], 'Meghalaya':          [85, 32],
  'Mizoram':            [89, 40], 'Nagaland':           [91, 30],
  'Odisha':             [68, 57], 'Punjab':             [44, 22],
  'Rajasthan':          [38, 38], 'Sikkim':             [78, 26],
  'Tamil Nadu':         [56, 82], 'Telangana':          [58, 62],
  'Tripura':            [87, 42], 'Uttar Pradesh':      [58, 34],
  'Uttarakhand':        [52, 24], 'West Bengal':        [74, 42],
  'Delhi':              [50, 30], 'Jammu & Kashmir':    [46, 10],
  'Ladakh':             [50, 8],  'Chandigarh':         [46, 22],
  'Puducherry':         [60, 80],
};

const EMPTY = { company_name:'', contact_person:'', email:'', phone:'', city:'', state:'', gstin:'' };

function IndiaMap({ clients }) {
  const [hovered, setHovered] = useState(null);
  // Group clients by state
  const byState = {};
  clients.forEach(c => {
    if (c.state) {
      if (!byState[c.state]) byState[c.state] = [];
      byState[c.state].push(c);
    }
  });

  return (
    <div className="section-card" style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <span style={{ fontSize:13, fontWeight:700, color:'#2D2D2D' }}>Client Locations</span>
        <span style={{ fontSize:12, color:'#9CA3AF' }}>{Object.keys(byState).length} states · {clients.length} clients</span>
      </div>
      <div style={{ position:'relative', width:'100%', paddingTop:'90%', background:'#F9FAFB', borderRadius:12, overflow:'hidden' }}>
        {/* SVG India outline — simplified */}
        <svg viewBox="0 0 500 500" style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%' }}>
          {/* Light grid */}
          {[10,20,30,40,50,60,70,80,90].map(p => (
            <g key={p}>
              <line x1={p*5} y1={0} x2={p*5} y2={500} stroke="#E5E7EB" strokeWidth={0.5} />
              <line x1={0} y1={p*5} x2={500} y2={p*5} stroke="#E5E7EB" strokeWidth={0.5} />
            </g>
          ))}
          {/* India rough outline polygon */}
          <polygon
            points="140,10 200,5 250,12 310,8 350,20 400,30 430,50 440,80 450,110 460,140 455,170 445,200 440,230 430,260 410,290 390,310 370,330 360,360 340,390 310,420 280,445 250,460 220,450 200,430 180,400 160,370 140,340 120,310 100,280 90,250 85,220 80,190 75,160 80,130 90,100 100,70 115,45 130,25"
            fill="#EFF6FF"
            stroke="#BFDBFE"
            strokeWidth={1.5}
          />
          {/* State dots */}
          {Object.entries(byState).map(([state, stateClients]) => {
            const coords = STATE_COORDS[state];
            if (!coords) return null;
            const cx = (coords[0] / 100) * 500;
            const cy = (coords[1] / 100) * 500;
            const r = Math.min(6 + stateClients.length * 3, 18);
            const isHovered = hovered === state;
            return (
              <g key={state}
                onMouseEnter={() => setHovered(state)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor:'pointer' }}
              >
                <circle cx={cx} cy={cy} r={r + 4} fill="rgba(242,107,78,0.15)" />
                <circle cx={cx} cy={cy} r={r} fill={isHovered ? '#E05A3A' : '#F26B4E'} stroke="white" strokeWidth={2} />
                <text x={cx} y={cy + 4} textAnchor="middle" fill="white" fontSize={9} fontWeight="bold">
                  {stateClients.length}
                </text>
                {isHovered && (
                  <g>
                    <rect x={cx - 60} y={cy - 38} width={120} height={26} rx={6} fill="#2D2D2D" />
                    <text x={cx} y={cy - 21} textAnchor="middle" fill="white" fontSize={9} fontWeight="bold">
                      {state}
                    </text>
                    <text x={cx} y={cy - 11} textAnchor="middle" fill="#F26B4E" fontSize={8}>
                      {stateClients.map(c => c.company_name).join(', ').slice(0, 28)}{stateClients.map(c => c.company_name).join(', ').length > 28 ? '…' : ''}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
        {clients.filter(c => !c.state).length > 0 && (
          <div style={{ position:'absolute', bottom:10, left:10, fontSize:11, color:'#9CA3AF' }}>
            {clients.filter(c => !c.state).length} clients without state assigned
          </div>
        )}
      </div>
      {/* State legend */}
      {Object.keys(byState).length > 0 && (
        <div style={{ marginTop:14, display:'flex', flexWrap:'wrap', gap:8 }}>
          {Object.entries(byState).map(([state, sc]) => (
            <span key={state} style={{ fontSize:11, background:'#FEF2EF', color:'#F26B4E', padding:'3px 10px', borderRadius:12, fontWeight:600 }}>
              {state} ({sc.length})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Clients() {
  const [search, setSearch]   = useState('');
  const [view, setView]       = useState('grid'); // 'grid' | 'map'
  const [open, setOpen]       = useState(false);
  const [editTarget, setEditTarget] = useState(null); // client object being edited
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [refresh, setRefresh] = useState(0);

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
    (c.state ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.city ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY);
    setSaveErr('');
    setOpen(true);
  };

  const openEdit = (client) => {
    setEditTarget(client);
    setForm({
      company_name:   client.company_name   ?? '',
      contact_person: client.contact_person ?? '',
      email:          client.email          ?? '',
      phone:          client.phone          ?? '',
      city:           client.city           ?? '',
      state:          client.state          ?? '',
      gstin:          client.gstin          ?? '',
    });
    setSaveErr('');
    setOpen(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSaveErr('');
    if (!form.company_name.trim()) { setSaveErr('Company name is required.'); return; }
    setSaving(true);
    try {
      if (editTarget) {
        await bessApi.patchClient(editTarget.id, form);
      } else {
        await bessApi.createClient(form);
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
          <h1 style={{ fontSize:22, fontWeight:900, color:'#2D2D2D', margin:0 }}>Clients</h1>
          <p style={{ fontSize:13, color:'#9CA3AF', margin:'4px 0 0' }}>{cl.length} clients</p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          {/* View toggle */}
          <div style={{ display:'flex', background:'#F3F4F6', borderRadius:8, padding:3 }}>
            <button onClick={() => setView('grid')} style={{ padding:'5px 10px', borderRadius:6, border:'none', cursor:'pointer', background: view==='grid' ? 'white' : 'transparent', color: view==='grid' ? '#2D2D2D' : '#9CA3AF', fontWeight:700, fontSize:12, display:'flex', alignItems:'center', gap:4 }}>
              <LayoutGrid size={13} /> Grid
            </button>
            <button onClick={() => setView('map')} style={{ padding:'5px 10px', borderRadius:6, border:'none', cursor:'pointer', background: view==='map' ? 'white' : 'transparent', color: view==='map' ? '#2D2D2D' : '#9CA3AF', fontWeight:700, fontSize:12, display:'flex', alignItems:'center', gap:4 }}>
              <Map size={13} /> Map
            </button>
          </div>
          <button className="btn-primary" onClick={openAdd}>
            <Plus size={14} style={{ marginRight:6, display:'inline' }} />Add Client
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ position:'relative', maxWidth:340 }}>
        <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#9CA3AF' }} />
        <input className="bess-input" style={{ paddingLeft:36, width:'100%' }}
          placeholder="Search by name, city or state…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Map view */}
      {view === 'map' && <IndiaMap clients={filtered} />}

      {/* Grid view */}
      {view === 'grid' && (
        filtered.length === 0
          ? <div style={{ padding:48, textAlign:'center', color:'#9CA3AF', fontSize:14 }}>
              No clients found.
            </div>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
              {filtered.map(client => {
                const clientProposals = pr.filter(p => p.client_id === client.id);
                const clientProjects  = pj.filter(p => p.client_id === client.id);
                const totalCapex      = clientProposals.reduce((s, p) => s + Number(p.capex_ex_gst ?? 0), 0);
                return (
                  <div key={client.id} className="kpi-card" style={{ position:'relative' }}>
                    {/* Edit button */}
                    <button
                      onClick={() => openEdit(client)}
                      style={{ position:'absolute', top:12, right:12, background:'#F3F4F6', border:'none', borderRadius:6, padding:'5px 7px', cursor:'pointer', color:'#6B7280', display:'flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600 }}
                      onMouseEnter={e => { e.currentTarget.style.background='#FEF2EF'; e.currentTarget.style.color='#F26B4E'; }}
                      onMouseLeave={e => { e.currentTarget.style.background='#F3F4F6'; e.currentTarget.style.color='#6B7280'; }}
                    >
                      <Pencil size={11} /> Edit
                    </button>

                    <div style={{ display:'flex', alignItems:'flex-start', marginBottom:14, paddingRight:52 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{ width:40, height:40, borderRadius:10, background:'#FEF2EF', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <Building size={18} color="#F26B4E" />
                        </div>
                        <div>
                          <div style={{ fontWeight:800, fontSize:14, color:'#2D2D2D' }}>{client.company_name}</div>
                          <div style={{ fontSize:12, color:'#6B7280', marginTop:1 }}>{client.contact_person || '—'}</div>
                        </div>
                      </div>
                      <span style={{ marginLeft:'auto', fontSize:11, fontWeight:700, color:'#F26B4E', background:'#FEF2EF', padding:'2px 8px', borderRadius:12, flexShrink:0 }}>
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
      )}

      {/* ── Add / Edit Client Modal ── */}
      <Modal open={open} onClose={() => { setOpen(false); setEditTarget(null); }} title={editTarget ? `Edit — ${editTarget.company_name}` : 'Add New Client'} width={560}>
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
          </FormGrid>

          <Field label="Email">
            <Input type="email" placeholder="contact@company.com" value={form.email} onChange={e => set('email', e.target.value)} />
          </Field>

          <FormGrid cols={2}>
            <Field label="City">
              <Input placeholder="e.g. New Delhi" value={form.city} onChange={e => set('city', e.target.value)} />
            </Field>
            <Field label="State">
              <select className="bess-input" value={form.state} onChange={e => set('state', e.target.value)} style={{ width:'100%' }}>
                <option value="">Select state…</option>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </FormGrid>

          <Field label="GSTIN">
            <Input placeholder="e.g. 07AABCU9603R1ZX" value={form.gstin}
              onChange={e => set('gstin', e.target.value.toUpperCase())}
              style={{ fontFamily:'monospace', letterSpacing:'0.5px' }} />
          </Field>

          {saveErr && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#DC2626', fontWeight:600 }}>
              {saveErr}
            </div>
          )}

          <SubmitRow onClose={() => { setOpen(false); setEditTarget(null); }} loading={saving}
            label={editTarget ? 'Save Changes' : 'Add Client'} />
        </form>
      </Modal>

    </div>
  );
}
