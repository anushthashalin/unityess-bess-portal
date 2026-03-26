import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Mail, Phone, MapPin, Building, Pencil, Map, LayoutGrid, Zap, ChevronDown, ChevronUp } from 'lucide-react';
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

const TARIFF_CATEGORIES = [
  'HT - Industrial','HT - Commercial','LT - Industrial','LT - Commercial',
  'EHT - Industrial','EHT - Commercial','HT - General','LT - General',
];

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
  company_name:'', contact_person:'', email:'', phone:'',
  alternate_contact:'', alternate_phone:'', website:'',
  city:'', state:'', gstin:'',
  industry_type:'', project_type:'', requirement_kwh:'',
  lead_status:'new', bd_name:'', meeting_date:'', timeline:'', remarks:'',
  qualified: false, budgetary_quote: false, tech_discussion: false,
  tc_offer: false, final_quote: false,
};

const SITE_EMPTY = {
  client_id:'', site_name:'', address:'', state:'', discom:'',
  tariff_category:'', sanctioned_load_kva:'', contract_demand_kva:'',
  connection_voltage_kv:'', meter_number:'',
};

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.6px', borderBottom:'1px solid #F3F4F6', paddingBottom:8, marginTop:4 }}>
      {children}
    </div>
  );
}

function CheckBox({ label, checked, onChange }) {
  return (
    <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:12, color:'#2D2D2D', fontWeight:600, userSelect:'none' }}>
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
      const totalKwh = sc.reduce((s, c) => s + parseFloat(c.requirement_kwh || 0), 0);
      const label = totalKwh >= 1000
        ? `${(totalKwh / 1000).toFixed(1)}MWh`
        : totalKwh > 0 ? `${Math.round(totalKwh)}kWh` : `${sc.length}`;
      const r = totalKwh > 0 ? Math.min(12 + Math.floor(totalKwh / 100), 36) : Math.min(12 + sc.length * 4, 28);
      const circle = L.circleMarker([lat,lng], { radius:r, fillColor:'#F26B4E', color:'white', weight:2, fillOpacity:0.9 }).addTo(map);
      const names = sc.map(c => {
        const kwh = parseFloat(c.requirement_kwh || 0);
        const cap = kwh >= 1000 ? `${(kwh/1000).toFixed(1)} MWh` : kwh > 0 ? `${Math.round(kwh)} kWh` : '—';
        return `<div style="padding:2px 0;font-size:12px;color:#2D2D2D">${c.company_name} <span style="color:#F26B4E;font-weight:700">${cap}</span></div>`;
      }).join('');
      const totalLabel = totalKwh >= 1000 ? `${(totalKwh/1000).toFixed(1)} MWh` : totalKwh > 0 ? `${Math.round(totalKwh)} kWh` : '';
      circle.bindPopup(`<div style="font-family:-apple-system,sans-serif;min-width:180px"><div style="font-weight:800;font-size:13px;color:#F26B4E;margin-bottom:2px">${state}</div>${totalLabel ? `<div style="font-size:11px;color:#888;margin-bottom:6px">Total: ${totalLabel}</div>` : ''}${names}</div>`, { maxWidth:260 });
      const fs = r < 18 ? 10 : r < 24 ? 11 : 12;
      L.marker([lat,lng], { icon: L.divIcon({ className:'', html:`<div style="width:${r*2}px;height:${r*2}px;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:${fs}px;pointer-events:none;text-align:center;line-height:1.1">${label}</div>`, iconSize:[r*2,r*2], iconAnchor:[r,r] }) }).addTo(map);
    });
  }, [ready, clients]);

  return (
    <div className="section-card" style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <span style={{ fontSize:13, fontWeight:700, color:'#2D2D2D' }}>Client Locations</span>
        <span style={{ fontSize:12, color:'#9CA3AF' }}>{clients.filter(c=>c.state&&STATE_LATLNG[c.state]).length} of {clients.length} clients mapped</span>
      </div>
      {!ready && <div style={{ height:420, display:'flex', alignItems:'center', justifyContent:'center', background:'#F9FAFB', borderRadius:12, color:'#9CA3AF', fontSize:13 }}>Loading map…</div>}
      <div ref={mapRef} style={{ height:420, borderRadius:12, overflow:'hidden', display: ready ? 'block' : 'none' }} />
    </div>
  );
}

const categoryColor = { HT:'#F26B4E', LT:'#3B82F6', EHT:'#7C3AED' };
const catKey = cat => cat?.split(' - ')[0] ?? '';

export default function Clients() {
  const [search, setSearch]         = useState('');
  const [view, setView]             = useState('grid');

  // Client modal state
  const [open, setOpen]             = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [saveErr, setSaveErr]       = useState('');

  // Site inline state
  const [expandedClientId, setExpandedClientId] = useState(null);
  const [siteOpen, setSiteOpen]                 = useState(false);
  const [siteEditTarget, setSiteEditTarget]     = useState(null);
  const [siteClientId, setSiteClientId]         = useState(null); // client context for Add Site
  const [siteForm, setSiteForm]                 = useState(SITE_EMPTY);
  const [siteSaving, setSiteSaving]             = useState(false);
  const [siteSaveErr, setSiteSaveErr]           = useState('');

  const [refresh, setRefresh] = useState(0);

  const { clients, proposals, projects, sites } = useApiMulti({
    clients:   bessApi.clients,
    proposals: bessApi.proposals,
    projects:  bessApi.projects,
    sites:     bessApi.sites,
  }, [refresh]);

  const loading = clients?.loading || proposals?.loading || projects?.loading || sites?.loading;
  if (loading) return <Spinner />;
  if (clients?.error) return <ErrorBanner message={clients.error} />;

  const cl = clients?.data   ?? [];
  const pr = proposals?.data ?? [];
  const pj = projects?.data  ?? [];
  const st = sites?.data     ?? [];

  const filtered = cl.filter(c =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.state ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.city ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.industry_type ?? '').toLowerCase().includes(search.toLowerCase())
  );

  // ── Client handlers ────────────────────────────────────────────────────────
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

  // ── Site handlers ──────────────────────────────────────────────────────────
  const sset = (k, v) => setSiteForm(f => ({ ...f, [k]: v }));

  const openAddSite = (clientId) => {
    setSiteClientId(clientId);
    setSiteEditTarget(null);
    setSiteForm({ ...SITE_EMPTY, client_id: String(clientId) });
    setSiteSaveErr('');
    setSiteOpen(true);
  };

  const openEditSite = (site) => {
    setSiteClientId(site.client_id);
    setSiteEditTarget(site);
    setSiteForm({
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
    setSiteSaveErr('');
    setSiteOpen(true);
  };

  const handleSiteSubmit = async e => {
    e.preventDefault();
    setSiteSaveErr('');
    if (!siteForm.site_name.trim()) { setSiteSaveErr('Site name is required.'); return; }
    setSiteSaving(true);
    try {
      if (siteEditTarget) {
        await bessApi.patchSite(siteEditTarget.id, siteForm);
      } else {
        await bessApi.createSite(siteForm);
      }
      setSiteOpen(false); setSiteEditTarget(null); setSiteForm(SITE_EMPTY);
      setRefresh(r => r + 1);
    } catch (err) {
      setSiteSaveErr(err.message);
    } finally {
      setSiteSaving(false);
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
          <h1 style={{ fontSize:22, fontWeight:900, color:'#2D2D2D', margin:0 }}>Clients</h1>
          <p style={{ fontSize:13, color:'#9CA3AF', margin:'4px 0 0' }}>{cl.length} clients · {st.length} sites</p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <div style={{ display:'flex', background:'#F3F4F6', borderRadius:8, padding:3 }}>
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
        <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#9CA3AF' }} />
        <input className="bess-input" style={{ paddingLeft:36, width:'100%' }}
          placeholder="Search by name, city, state, industry…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {view === 'map' && <LeafletMap clients={filtered} />}

      {view === 'grid' && (
        filtered.length === 0
          ? <div style={{ padding:48, textAlign:'center', color:'#9CA3AF', fontSize:14 }}>No clients found.</div>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
              {filtered.map(client => {
                const clientProposals = pr.filter(p => p.client_id === client.id);
                const clientProjects  = pj.filter(p => p.client_id === client.id);
                const clientSites     = st.filter(s => s.client_id === client.id);
                const totalCapex      = clientProposals.reduce((s,p) => s + Number(p.capex_ex_gst ?? 0), 0);
                const lsc             = LEAD_STATUS_COLORS[client.lead_status] ?? '#6B7280';
                const isExpanded      = expandedClientId === client.id;

                return (
                  <div key={client.id} className="kpi-card" style={{ position:'relative' }}>
                    <button onClick={() => openEdit(client)}
                      style={{ position:'absolute', top:12, right:12, background:'#F3F4F6', border:'none', borderRadius:6, padding:'5px 7px', cursor:'pointer', color:'#6B7280', display:'flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600 }}
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
                          <div style={{ fontWeight:800, fontSize:14, color:'#2D2D2D' }}>{client.company_name}</div>
                          <div style={{ fontSize:11, color:'#6B7280', marginTop:1 }}>{client.contact_person || '—'}</div>
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
                        <span style={{ fontSize:10, fontWeight:600, background:'#F3F4F6', color:'#6B7280', padding:'2px 8px', borderRadius:10 }}>
                          {client.industry_type}
                        </span>
                      )}
                    </div>

                    <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:10 }}>
                      {client.email && <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, color:'#6B7280' }}><Mail size={11} color="#9CA3AF" />{client.email}</div>}
                      {client.phone && <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, color:'#6B7280' }}><Phone size={11} color="#9CA3AF" />{client.phone}</div>}
                      {(client.city || client.state) && <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, color:'#6B7280' }}><MapPin size={11} color="#9CA3AF" />{[client.city, client.state].filter(Boolean).join(', ')}</div>}
                      {client.requirement_kwh && <div style={{ fontSize:12, color:'#6B7280' }}>Requirement: <strong style={{ color:'#2D2D2D' }}>{Number(client.requirement_kwh).toLocaleString('en-IN')} kWh</strong></div>}
                    </div>

                    {/* BD milestones */}
                    {(client.qualified || client.budgetary_quote || client.tech_discussion || client.tc_offer || client.final_quote) && (
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:10 }}>
                        {[['Q','qualified'],['BQ','budgetary_quote'],['TD','tech_discussion'],['TC','tc_offer'],['FQ','final_quote']].map(([label, key]) =>
                          client[key] ? <span key={key} style={{ fontSize:9, fontWeight:700, background:'#DCFCE7', color:'#16A34A', padding:'2px 6px', borderRadius:6 }}>{label}</span> : null
                        )}
                      </div>
                    )}

                    {/* Stats row */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', borderTop:'1px solid #F3F4F6', paddingTop:10, gap:4 }}>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:15, fontWeight:900, color:'#2D2D2D' }}>{clientProposals.length}</div>
                        <div style={{ fontSize:10, color:'#9CA3AF', fontWeight:600, textTransform:'uppercase' }}>Proposals</div>
                      </div>
                      <div style={{ textAlign:'center', borderLeft:'1px solid #F3F4F6' }}>
                        <div style={{ fontSize:15, fontWeight:900, color:'#2D2D2D' }}>{clientProjects.length}</div>
                        <div style={{ fontSize:10, color:'#9CA3AF', fontWeight:600, textTransform:'uppercase' }}>Projects</div>
                      </div>
                      {/* Sites — clickable toggle */}
                      <div
                        onClick={() => setExpandedClientId(isExpanded ? null : client.id)}
                        style={{ textAlign:'center', borderLeft:'1px solid #F3F4F6', cursor:'pointer', borderRadius:6, padding:'2px 0', transition:'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background='#FEF2EF'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:3 }}>
                          <div style={{ fontSize:15, fontWeight:900, color: isExpanded ? '#F26B4E' : '#2D2D2D' }}>{clientSites.length}</div>
                          {isExpanded ? <ChevronUp size={10} color="#F26B4E" /> : <ChevronDown size={10} color="#9CA3AF" />}
                        </div>
                        <div style={{ fontSize:10, color: isExpanded ? '#F26B4E' : '#9CA3AF', fontWeight:600, textTransform:'uppercase' }}>Sites</div>
                      </div>
                      <div style={{ textAlign:'center', borderLeft:'1px solid #F3F4F6' }}>
                        <div style={{ fontSize:12, fontWeight:900, color:'#F26B4E' }}>{inr(totalCapex)}</div>
                        <div style={{ fontSize:10, color:'#9CA3AF', fontWeight:600, textTransform:'uppercase' }}>Value</div>
                      </div>
                    </div>

                    {/* ── Inline Sites Panel ── */}
                    {isExpanded && (
                      <div style={{ marginTop:12, borderTop:'1px solid #F3F4F6', paddingTop:12 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                          <span style={{ fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.5px' }}>Sites</span>
                          <button
                            onClick={() => openAddSite(client.id)}
                            style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700, color:'#F26B4E', background:'#FEF2EF', border:'1px solid #FDDDD4', borderRadius:6, padding:'4px 10px', cursor:'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.background='#FDDDD4'}
                            onMouseLeave={e => e.currentTarget.style.background='#FEF2EF'}>
                            <Plus size={11} /> Add Site
                          </button>
                        </div>

                        {clientSites.length === 0 ? (
                          <div style={{ fontSize:12, color:'#9CA3AF', textAlign:'center', padding:'10px 0' }}>
                            No sites registered yet.
                          </div>
                        ) : (
                          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                            {clientSites.map(site => {
                              const ck = catKey(site.tariff_category);
                              const cc = categoryColor[ck] ?? '#9CA3AF';
                              return (
                                <div key={site.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#F9FAFB', borderRadius:8, padding:'8px 12px', border:'1px solid #F3F4F6' }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:9, minWidth:0 }}>
                                    <div style={{ width:28, height:28, borderRadius:7, background:`${cc}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                      <MapPin size={13} color={cc} />
                                    </div>
                                    <div style={{ minWidth:0 }}>
                                      <div style={{ fontWeight:700, fontSize:12, color:'#2D2D2D', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:140 }}>{site.site_name}</div>
                                      <div style={{ fontSize:10, color:'#9CA3AF', marginTop:1 }}>
                                        {[site.state, site.discom].filter(Boolean).join(' · ') || '—'}
                                        {site.sanctioned_load_kva ? ` · ${Number(site.sanctioned_load_kva).toLocaleString('en-IN')} kVA` : ''}
                                      </div>
                                    </div>
                                  </div>
                                  <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                                    {site.tariff_category && (
                                      <span style={{ fontSize:9, fontWeight:700, background:`${cc}18`, color:cc, padding:'2px 7px', borderRadius:8 }}>{site.tariff_category}</span>
                                    )}
                                    <button
                                      onClick={() => openEditSite(site)}
                                      style={{ background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', padding:'3px', borderRadius:4, display:'flex', alignItems:'center' }}
                                      onMouseEnter={e => e.currentTarget.style.color='#F26B4E'}
                                      onMouseLeave={e => e.currentTarget.style.color='#9CA3AF'}>
                                      <Pencil size={11} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
      )}

      {/* ── Add / Edit Client Modal ── */}
      <Modal open={open} onClose={() => { setOpen(false); setEditTarget(null); }}
        title={editTarget ? `Edit — ${editTarget.company_name}` : 'Add New Client'} width={640}>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>

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

          <SectionLabel>Sales Milestones</SectionLabel>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, padding:'4px 0' }}>
            <CheckBox label="Qualified" checked={form.qualified} onChange={v => set('qualified', v)} />
            <CheckBox label="Budg. Quote" checked={form.budgetary_quote} onChange={v => set('budgetary_quote', v)} />
            <CheckBox label="Tech Disc." checked={form.tech_discussion} onChange={v => set('tech_discussion', v)} />
            <CheckBox label="T&C Offer" checked={form.tc_offer} onChange={v => set('tc_offer', v)} />
            <CheckBox label="Final Quote" checked={form.final_quote} onChange={v => set('final_quote', v)} />
          </div>

          <Field label="Remarks / Notes">
            <textarea value={form.remarks} onChange={e => set('remarks', e.target.value)}
              placeholder="Key observations, site conditions, decision makers, blockers…"
              rows={3}
              style={{ border:'1px solid #E5E7EB', borderRadius:8, padding:'9px 12px', fontSize:13, fontFamily:'Chivo, sans-serif', color:'#2D2D2D', outline:'none', width:'100%', resize:'vertical', boxSizing:'border-box', transition:'border-color 0.15s, box-shadow 0.15s' }}
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

      {/* ── Add / Edit Site Modal ── */}
      <Modal open={siteOpen} onClose={() => { setSiteOpen(false); setSiteEditTarget(null); }}
        title={siteEditTarget ? `Edit Site — ${siteEditTarget.site_name}` : 'Add New Site'} width={580}>
        <form onSubmit={handleSiteSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>

          <FormGrid cols={2}>
            <Field label="Site Name" required>
              <Input placeholder="e.g. Amrita Hospital — Faridabad" value={siteForm.site_name} onChange={e => sset('site_name', e.target.value)} />
            </Field>
            <Field label="Meter Number">
              <Input placeholder="EB meter number" value={siteForm.meter_number} onChange={e => sset('meter_number', e.target.value)} />
            </Field>
          </FormGrid>

          <Field label="Address">
            <Input placeholder="Full address of the metering point" value={siteForm.address} onChange={e => sset('address', e.target.value)} />
          </Field>

          <FormGrid cols={2}>
            <Field label="State">
              <select className="bess-input" value={siteForm.state} onChange={e => sset('state', e.target.value)} style={{ width:'100%' }}>
                <option value="">Select state…</option>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="DISCOM">
              <Input placeholder="e.g. DHBVN, MSEDCL, BESCOM" value={siteForm.discom} onChange={e => sset('discom', e.target.value)} />
            </Field>
          </FormGrid>

          <Field label="Tariff Category">
            <select className="bess-input" value={siteForm.tariff_category} onChange={e => sset('tariff_category', e.target.value)} style={{ width:'100%' }}>
              <option value="">Select category…</option>
              {TARIFF_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <FormGrid cols={3}>
            <Field label="Sanctioned Load (kVA)">
              <Input type="number" min="0" step="0.1" placeholder="e.g. 500"
                value={siteForm.sanctioned_load_kva} onChange={e => sset('sanctioned_load_kva', e.target.value)} />
            </Field>
            <Field label="Contract Demand (kVA)">
              <Input type="number" min="0" step="0.1" placeholder="e.g. 400"
                value={siteForm.contract_demand_kva} onChange={e => sset('contract_demand_kva', e.target.value)} />
            </Field>
            <Field label="Voltage (kV)">
              <Input type="number" min="0" step="0.001" placeholder="e.g. 11"
                value={siteForm.connection_voltage_kv} onChange={e => sset('connection_voltage_kv', e.target.value)} />
            </Field>
          </FormGrid>

          {siteSaveErr && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#DC2626', fontWeight:600 }}>
              {siteSaveErr}
            </div>
          )}

          <SubmitRow onClose={() => { setSiteOpen(false); setSiteEditTarget(null); }} loading={siteSaving}
            label={siteEditTarget ? 'Save Changes' : 'Add Site'} />
        </form>
      </Modal>

    </div>
  );
}
