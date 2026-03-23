import { useState, useEffect, useRef } from 'react';
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

const INDUSTRY_TYPES = [
  'Hospital / Healthcare','Hotel / Hospitality','Manufacturing','IT / Data Centre',
  'Education / Institution','Retail / Commercial','Cold Storage / Logistics',
  'Textile','Pharma','Food Processing','Real Estate','Government / PSU',
  'Steel / Metal','Cement','Chemical','Other',
];

const PROJECT_TYPES = [
  'C&I — Rooftop Solar + BESS','C&I — BESS Only','C&I — Open Access',
  'Utility Scale BESS','EV Charging + BESS','Behind the Meter BESS',
  'Peak Demand Reduction','ToD Arbitrage','Other',
];

const LEAD_STATUSES = ['new','contacted','qualified','proposal_sent','negotiation','won','lost','dormant'];

const TIMELINES = ['< 1 month','1–3 months','3–6 months','6–12 months','12–18 months','> 18 months'];

const STATE_LATLNG = {
  'Andhra Pradesh':     [15.9, 79.7],  'Arunachal Pradesh':  [28.2, 94.7],
  'Assam':              [26.2, 92.9],  'Bihar':              [25.1, 85.3],
  'Chhattisgarh':       [21.3, 81.9],  'Goa':                [15.3, 74.0],
  'Gujarat':            [22.3, 71.2],  'Haryana':            [29.1, 76.1],
  'Himachal Pradesh':   [31.1, 77.2],  'Jharkhand':          [23.6, 85.3],
  'Karnataka':          [15.3, 75.7],  'Kerala':             [10.9, 76.3],
  'Madhya Pradesh':     [23.5, 77.9],  'Maharashtra':        [19.7, 75.7],
  'Manipur':            [24.7, 93.9],  'Meghalaya':          [25.5, 91.4],
  'Mizoram':            [23.2, 92.9],  'Nagaland':           [26.2, 94.6],
  'Odisha':             [20.9, 84.5],  'Punjab':             [31.1, 75.3],
  'Rajasthan':          [27.0, 74.2],  'Sikkim':             [27.5, 88.5],
  'Tamil Nadu':         [11.1, 78.7],  'Telangana':          [18.1, 79.0],
  'Tripura':            [23.9, 91.9],  'Uttar Pradesh':      [27.1, 80.9],
  'Uttarakhand':        [30.1, 79.3],  'West Bengal':        [23.0, 87.9],
  'Delhi':              [28.6, 77.2],  'Jammu & Kashmir':    [33.7, 76.9],
  'Ladakh':             [34.2, 77.6],  'Chandigarh':         [30.7, 76.8],
  'Puducherry':         [11.9, 79.8],
};

const EMPTY = {
  // Identity
  company_name:'', contact_person:'', email:'', phone:'',
  alternate_contact:'', alternate_phone:'', website:'',
  // Location
  city:'', state:'', gstin:'',
  // Classification
  industry_type:'', project_type:'', requirement_kwh:'',
  // BD tracking
  lead_status:'new', bd_name:'', meeting_date:'', timeline:'', remarks:'',
  // Sales milestones (booleans)
  qualified: false, budgetary_quote: false, tech_discussion: false,
  tc_offer: false, final_quote: false,
};

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize:11, fontWeight:700, color:'hsl(var(--muted-foreground))', textTransform:'uppercase', letterSpacing:'0.6px', borderBottom:'1px solid #F3F4F6', paddingBottom:8, marginTop:4 }}>
      {children}
    </div>
  );
}

function CheckBox({ label, checked, onChange }) {
  return (
    <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:12, color:'hsl(var(--foreground))', fontWeight:600, userSelect:'none' }}>
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)}
        style={{ width:15, height:15, accentColor:'#F26B4E', cursor:'pointer' }} />
      {label}
    </label>
  );
}

function LeafletMap({ clients }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (document.getElementById('leaflet-css')) { setReady(true); return; }
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || mapInstanceRef.current) return;
    const L = window.L;
    const map = L.map(mapRef.current, { center:[22.5,80.0], zoom:5, scrollWheelZoom:false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap', maxZoom:18 }).addTo(map);
    mapInstanceRef.current = map;
    return () => { map.remove(); mapInstanceRef.current = null; };
  }, [ready]);

  useEffect(() => {
    if (!ready || !mapInstanceRef.current) return;
    const L = window.L;
    const map = mapInstanceRef.current;
    map.eachLayer(layer => { if (layer instanceof L.Marker || layer instanceof L.CircleMarker) map.removeLayer(layer); });

    const byState = {};
    clients.forEach(c => {
      if (c.state && STATE_LATLNG[c.state]) {
        if (!byState[c.state]) byState[c.state] = [];
        byState[c.state].push(c);
      }
    });

    Object.entries(byState).forEach(([state, sc]) => {
      const [lat, lng] = STATE_LATLNG[state];
      const r = Math.min(12 + sc.length * 4, 28);
      const circle = L.circleMarker([lat,lng], { radius:r, fillColor:'#F26B4E', color:'white', weight:2, fillOpacity:0.9 }).addTo(map);
      const names = sc.map(c => `<div style="padding:2px 0;font-size:12px;color:#2D2D2D">${c.company_name}</div>`).join('');
      circle.bindPopup(`<div style="font-family:-apple-system,sans-serif;min-width:160px"><div style="font-weight:800;font-size:13px;color:#F26B4E;margin-bottom:6px">${state}</div>${names}</div>`, { maxWidth:240 });
      L.marker([lat,lng], { icon: L.divIcon({ className:'', html:`<div style="width:${r*2}px;height:${r*2}px;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:${r<16?11:13}px;pointer-events:none">${sc.length}</div>`, iconSize:[r*2,r*2], iconAnchor:[r,r] }) }).addTo(map);
    });
  }, [ready, clients]);

  return (
    <div className="section-card" style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <span style={{ fontSize:13, fontWeight:700, color:'hsl(var(--foreground))' }}>Client Locations</span>
        <span style={{ fontSize:12, color:'hsl(var(--muted-foreground))' }}>{clients.filter(c=>c.state&&STATE_LATLNG[c.state]).length} of {clients.length} clients mapped</span>
      </div>
      {!ready && <div style={{ height:420, display:'flex', alignItems:'center', justifyContent:'center', background:'hsl(var(--muted))', borderRadius:12, color:'hsl(var(--muted-foreground))', fontSize:13 }}>Loading map…</div>}
      <div ref={mapRef} style={{ height:420, borderRadius:12, overflow:'hidden', display: ready ? 'block' : 'none' }} />
    </div>
  );
}

export default function Clients() {
  const [search, setSearch]         = useState('');
  const [view, setView]             = useState('grid');
  const [open, setOpen]             = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [saveErr, setSaveErr]       = useState('');
  const [refresh, setRefresh]       = useState(0);

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
    (c.city ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.industry_type ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openAdd = () => { setEditTarget(null); setForm(EMPTY); setSaveErr(''); setOpen(true); };

  const openEdit = (client) => {
    setEditTarget(client);
    setForm({
      company_name:     client.company_name     ?? '',
      contact_person:   client.contact_person   ?? '',
      email:            client.email            ?? '',
      phone:            client.phone            ?? '',
      alternate_contact:client.alternate_contact?? '',
      alternate_phone:  client.alternate_phone  ?? '',
      website:          client.website          ?? '',
      city:             client.city             ?? '',
      state:            client.state            ?? '',
      gstin:            client.gstin            ?? '',
      industry_type:    client.industry_type    ?? '',
      project_type:     client.project_type     ?? '',
      requirement_kwh:  client.requirement_kwh  ?? '',
      lead_status:      client.lead_status      ?? 'new',
      bd_name:          client.bd_name          ?? '',
      meeting_date:     client.meeting_date     ? client.meeting_date.slice(0,10) : '',
      timeline:         client.timeline         ?? '',
      remarks:          client.remarks          ?? '',
      qualified:        client.qualified        ?? false,
      budgetary_quote:  client.budgetary_quote  ?? false,
      tech_discussion:  client.tech_discussion  ?? false,
      tc_offer:         client.tc_offer         ?? false,
      final_quote:      client.final_quote      ?? false,
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
      setOpen(false); setEditTarget(null); setForm(EMPTY);
      setRefresh(r => r + 1);
    } catch (err) {
      setSaveErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  const LEAD_STATUS_COLORS = {
    new:'#6B7280', contacted:'#3B82F6', qualified:'#F59E0B', proposal_sent:'#8B5CF6',
    negotiation:'#F26B4E', won:'#16A34A', lost:'#DC2626', dormant:'#9CA3AF',
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:900, color:'hsl(var(--foreground))', margin:0 }}>Clients</h1>
          <p style={{ fontSize:13, color:'hsl(var(--muted-foreground))', margin:'4px 0 0' }}>{cl.length} clients</p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <div style={{ display:'flex', background:'hsl(var(--muted))', borderRadius:8, padding:3 }}>
            {['grid','map'].map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding:'5px 10px', borderRadius:6, border:'none', cursor:'pointer', background: view===v ? 'white' : 'transparent', color: view===v ? '#2D2D2D' : '#9CA3AF', fontWeight:700, fontSize:12, boxShadow: view===v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                {v === 'grid' ? '⊞ Grid' : '⊕ Map'}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={openAdd}>
            <Plus size={14} style={{ marginRight:6, display:'inline' }} />Add Client
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ position:'relative', maxWidth:360 }}>
        <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--muted-foreground))' }} />
        <input className="bess-input" style={{ paddingLeft:36, width:'100%' }}
          placeholder="Search by name, city, state, industry…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {view === 'map' && <LeafletMap clients={filtered} />}

      {view === 'grid' && (
        filtered.length === 0
          ? <div style={{ padding:48, textAlign:'center', color:'hsl(var(--muted-foreground))', fontSize:14 }}>No clients found.</div>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
              {filtered.map(client => {
                const clientProposals = pr.filter(p => p.client_id === client.id);
                const clientProjects  = pj.filter(p => p.client_id === client.id);
                const totalCapex = clientProposals.reduce((s,p) => s + Number(p.capex_ex_gst ?? 0), 0);
                const lsc = LEAD_STATUS_COLORS[client.lead_status] ?? '#6B7280';
                return (
                  <div key={client.id} className="kpi-card" style={{ position:'relative' }}>
                    <button onClick={() => openEdit(client)}
                      style={{ position:'absolute', top:12, right:12, background:'hsl(var(--muted))', border:'none', borderRadius:6, padding:'5px 7px', cursor:'pointer', color:'hsl(var(--muted-foreground))', display:'flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600 }}
                      onMouseEnter={e => { e.currentTarget.style.background='#FEF2EF'; e.currentTarget.style.color='#F26B4E'; }}
                      onMouseLeave={e => { e.currentTarget.style.background='#F3F4F6'; e.currentTarget.style.color='#6B7280'; }}>
                      <Pencil size={11} /> Edit
                    </button>

                    <div style={{ display:'flex', alignItems:'flex-start', marginBottom:10, paddingRight:52 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:38, height:38, borderRadius:9, background:'#FEF2EF', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <Building size={17} color="#F26B4E" />
                        </div>
                        <div>
                          <div style={{ fontWeight:800, fontSize:14, color:'hsl(var(--foreground))' }}>{client.company_name}</div>
                          <div style={{ fontSize:11, color:'hsl(var(--muted-foreground))', marginTop:1 }}>{client.contact_person || '—'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Status + Industry */}
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                      {client.lead_status && (
                        <span style={{ fontSize:10, fontWeight:700, background:`${lsc}18`, color:lsc, padding:'2px 8px', borderRadius:10, textTransform:'uppercase', letterSpacing:'0.4px' }}>
                          {client.lead_status.replace('_',' ')}
                        </span>
                      )}
                      {client.industry_type && (
                        <span style={{ fontSize:10, fontWeight:600, background:'hsl(var(--muted))', color:'hsl(var(--muted-foreground))', padding:'2px 8px', borderRadius:10 }}>
                          {client.industry_type}
                        </span>
                      )}
                    </div>

                    <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:10 }}>
                      {client.email && <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, color:'hsl(var(--muted-foreground))' }}><Mail size={11} color="#9CA3AF" />{client.email}</div>}
                      {client.phone && <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, color:'hsl(var(--muted-foreground))' }}><Phone size={11} color="#9CA3AF" />{client.phone}</div>}
                      {(client.city || client.state) && <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, color:'hsl(var(--muted-foreground))' }}><MapPin size={11} color="#9CA3AF" />{[client.city, client.state].filter(Boolean).join(', ')}</div>}
                      {client.requirement_kwh && <div style={{ fontSize:12, color:'hsl(var(--muted-foreground))' }}>Requirement: <strong style={{ color:'hsl(var(--foreground))' }}>{Number(client.requirement_kwh).toLocaleString('en-IN')} kWh</strong></div>}
                    </div>

                    {/* BD milestones */}
                    {(client.qualified || client.budgetary_quote || client.tech_discussion || client.tc_offer || client.final_quote) && (
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:10 }}>
                        {[['Q','qualified'],['BQ','budgetary_quote'],['TD','tech_discussion'],['TC','tc_offer'],['FQ','final_quote']].map(([label, key]) =>
                          client[key] ? <span key={key} style={{ fontSize:9, fontWeight:700, background:'#DCFCE7', color:'#16A34A', padding:'2px 6px', borderRadius:6 }}>{label}</span> : null
                        )}
                      </div>
                    )}

                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', borderTop:'1px solid hsl(var(--border))', paddingTop:10, gap:6 }}>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:16, fontWeight:900, color:'hsl(var(--foreground))' }}>{clientProposals.length}</div>
                        <div style={{ fontSize:10, color:'hsl(var(--muted-foreground))', fontWeight:600, textTransform:'uppercase' }}>Proposals</div>
                      </div>
                      <div style={{ textAlign:'center', borderLeft:'1px solid #F3F4F6', borderRight:'1px solid #F3F4F6' }}>
                        <div style={{ fontSize:16, fontWeight:900, color:'hsl(var(--foreground))' }}>{clientProjects.length}</div>
                        <div style={{ fontSize:10, color:'hsl(var(--muted-foreground))', fontWeight:600, textTransform:'uppercase' }}>Projects</div>
                      </div>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:14, fontWeight:900, color:'#F26B4E' }}>{inr(totalCapex)}</div>
                        <div style={{ fontSize:10, color:'hsl(var(--muted-foreground))', fontWeight:600, textTransform:'uppercase' }}>Value</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
      )}

      {/* ── Add / Edit Client Modal ── */}
      <Modal open={open} onClose={() => { setOpen(false); setEditTarget(null); }}
        title={editTarget ? `Edit — ${editTarget.company_name}` : 'Add New Client'} width={640}>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* ── Company Identity ── */}
          <SectionLabel>Company Details</SectionLabel>
          <Field label="Company Name" required>
            <Input placeholder="e.g. Amrita Hospitals Pvt. Ltd." value={form.company_name} onChange={e => set('company_name', e.target.value)} />
          </Field>
          <FormGrid cols={2}>
            <Field label="Industry Type">
              <select className="bess-input" value={form.industry_type} onChange={e => set('industry_type', e.target.value)} style={{ width:'100%' }}>
                <option value="">Select industry…</option>
                {INDUSTRY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Website">
              <Input placeholder="https://company.com" value={form.website} onChange={e => set('website', e.target.value)} />
            </Field>
          </FormGrid>
          <FormGrid cols={2}>
            <Field label="GSTIN">
              <Input placeholder="e.g. 07AABCU9603R1ZX" value={form.gstin}
                onChange={e => set('gstin', e.target.value.toUpperCase())}
                style={{ fontFamily:'monospace', letterSpacing:'0.5px' }} />
            </Field>
          </FormGrid>

          {/* ── Primary Contact ── */}
          <SectionLabel>Primary Contact</SectionLabel>
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
            <Field label="Alternate Contact Person">
              <Input placeholder="Secondary contact name" value={form.alternate_contact} onChange={e => set('alternate_contact', e.target.value)} />
            </Field>
            <Field label="Alternate Phone">
              <Input placeholder="+91 98XXXXXXXX" value={form.alternate_phone} onChange={e => set('alternate_phone', e.target.value)} />
            </Field>
          </FormGrid>

          {/* ── Location ── */}
          <SectionLabel>Location</SectionLabel>
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

          {/* ── BESS Requirement ── */}
          <SectionLabel>BESS Requirement</SectionLabel>
          <FormGrid cols={2}>
            <Field label="Project Type">
              <select className="bess-input" value={form.project_type} onChange={e => set('project_type', e.target.value)} style={{ width:'100%' }}>
                <option value="">Select type…</option>
                {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Requirement (kWh)">
              <Input type="number" min="0" step="1" placeholder="e.g. 500"
                value={form.requirement_kwh} onChange={e => set('requirement_kwh', e.target.value)} />
            </Field>
          </FormGrid>

          {/* ── BD Tracking ── */}
          <SectionLabel>BD Tracking</SectionLabel>
          <FormGrid cols={2}>
            <Field label="Lead Status">
              <select className="bess-input" value={form.lead_status} onChange={e => set('lead_status', e.target.value)} style={{ width:'100%' }}>
                {LEAD_STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
              </select>
            </Field>
            <Field label="BD Person (Owner)">
              <Input placeholder="e.g. Kedar / Fateh" value={form.bd_name} onChange={e => set('bd_name', e.target.value)} />
            </Field>
          </FormGrid>
          <FormGrid cols={2}>
            <Field label="Last / Next Meeting Date">
              <Input type="date" value={form.meeting_date} onChange={e => set('meeting_date', e.target.value)} />
            </Field>
            <Field label="Expected Timeline">
              <select className="bess-input" value={form.timeline} onChange={e => set('timeline', e.target.value)} style={{ width:'100%' }}>
                <option value="">Select timeline…</option>
                {TIMELINES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </FormGrid>

          {/* ── Sales Milestones ── */}
          <SectionLabel>Sales Milestones</SectionLabel>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, padding:'4px 0' }}>
            <CheckBox label="Qualified" checked={form.qualified} onChange={v => set('qualified', v)} />
            <CheckBox label="Budg. Quote" checked={form.budgetary_quote} onChange={v => set('budgetary_quote', v)} />
            <CheckBox label="Tech Disc." checked={form.tech_discussion} onChange={v => set('tech_discussion', v)} />
            <CheckBox label="T&C Offer" checked={form.tc_offer} onChange={v => set('tc_offer', v)} />
            <CheckBox label="Final Quote" checked={form.final_quote} onChange={v => set('final_quote', v)} />
          </div>

          {/* ── Remarks ── */}
          <Field label="Remarks / Notes">
            <textarea value={form.remarks} onChange={e => set('remarks', e.target.value)}
              placeholder="Key observations, site conditions, decision makers, blockers…"
              rows={3}
              style={{ border:'1px solid #E5E7EB', borderRadius:8, padding:'9px 12px', fontSize:13, fontFamily:'Chivo, sans-serif', color:'hsl(var(--foreground))', outline:'none', width:'100%', resize:'vertical', boxSizing:'border-box', transition:'border-color 0.15s, box-shadow 0.15s' }}
              onFocus={e => { e.target.style.borderColor='#F26B4E'; e.target.style.boxShadow='0 0 0 3px rgba(242,107,78,0.12)'; }}
              onBlur={e => { e.target.style.borderColor='#E5E7EB'; e.target.style.boxShadow='none'; }}
            />
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
