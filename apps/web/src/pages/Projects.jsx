import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useApiMulti } from '../hooks/useApi.js';
import { bessApi } from '../lib/api.js';
import { inr } from '../lib/fmt.js';
import { Spinner, ErrorBanner } from '../components/Spinner.jsx';
import Modal, { Field, Input, FormGrid, SubmitRow } from '../components/Modal.jsx';

const STAGES = ['lead','proposal','negotiation','po_received','installation','commissioned'];

const PROJECT_STATUSES = [
  'lead','proposal','negotiation','po_received','installation','commissioned','active',
];

const EMPTY = {
  client_id:'', site_id:'', proposal_id:'', status:'lead',
  po_number:'', po_value_inr:'', installation_date:'', commissioning_date:'',
};

export default function Projects() {
  const [open, setOpen]       = useState(false);
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [patchingId, setPatchingId] = useState(null);

  const handleStageClick = async (projectId, newStage) => {
    setPatchingId(projectId);
    try {
      await bessApi.patchProject(projectId, { status: newStage });
      setRefresh(r => r + 1);
    } catch (err) {
      console.error('Stage update failed:', err.message);
    } finally {
      setPatchingId(null);
    }
  };

  const { projects, proposals, configs, clients, sites } = useApiMulti({
    projects:  bessApi.projects,
    proposals: bessApi.proposals,
    configs:   bessApi.configs,
    clients:   bessApi.clients,
    sites:     bessApi.sites,
  }, [refresh]);

  const loading = projects?.loading || proposals?.loading || configs?.loading || clients?.loading || sites?.loading;
  if (loading) return <Spinner />;
  if (projects?.error) return <ErrorBanner message={projects.error} />;

  const pj  = projects?.data  ?? [];
  const pr  = proposals?.data ?? [];
  const cfg = configs?.data   ?? [];
  const cl  = clients?.data   ?? [];
  const sl  = sites?.data     ?? [];

  const idx = s => STAGES.indexOf(s);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const clientProposals = form.client_id
    ? pr.filter(p => String(p.client_id) === String(form.client_id))
    : pr;
  const clientSites = form.client_id
    ? sl.filter(s => String(s.client_id) === String(form.client_id))
    : sl;

  const handleSubmit = async e => {
    e.preventDefault();
    setSaveErr('');
    if (!form.client_id) { setSaveErr('Please select a client.'); return; }
    setSaving(true);
    try {
      await bessApi.createProject(form);
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
          <h1 style={{ fontSize:22, fontWeight:900, color:'hsl(var(--foreground))', margin:0 }}>Projects</h1>
          <p style={{ fontSize:13, color:'hsl(var(--muted-foreground))', margin:'4px 0 0' }}>{pj.length} projects in pipeline</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(EMPTY); setSaveErr(''); setOpen(true); }}>
          <Plus size={14} style={{ marginRight:6, display:'inline' }} />New Project
        </button>
      </div>

      {/* Project cards with pipeline tracker */}
      {pj.length === 0
        ? <div style={{ padding:64, textAlign:'center', color:'hsl(var(--muted-foreground))', fontSize:14 }}>
            No projects yet. Create your first project to start tracking.
          </div>
        : pj.map(proj => {
            const proposal = pr.find(p => p.id === proj.proposal_id);
            const config   = cfg.find(c => c.id === proposal?.bess_config_id);
            const stageIdx = idx(proj.status);
            return (
              <div key={proj.id} className="section-card">
                <div style={{ padding:'16px 20px', borderBottom:'1px solid #F3F4F6', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                      <span style={{ fontFamily:'monospace', fontWeight:800, color:'#F26B4E', fontSize:13 }}>{proj.project_code}</span>
                      <span className={`badge badge-${proj.status}`}>
                        {proj.status.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
                      </span>
                    </div>
                    <div style={{ fontSize:16, fontWeight:800 }}>{proj.company_name}</div>
                    {config && <div style={{ fontSize:12, color:'hsl(var(--muted-foreground))', marginTop:2 }}>{config.num_units} × {config.config_name}</div>}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    {proposal && (
                      <>
                        <div style={{ fontSize:20, fontWeight:900, color:'#F26B4E' }}>{inr(proposal.capex_ex_gst)}</div>
                        <div style={{ fontSize:11, color:'hsl(var(--muted-foreground))' }}>
                          Ex-GST · IRR {proposal.irr_percent ?? '—'}% · {proposal.payback_years ?? '—'} yrs payback
                        </div>
                      </>
                    )}
                    {proj.po_number && (
                      <div style={{ fontSize:11, color:'hsl(var(--muted-foreground))', marginTop:4, fontFamily:'monospace' }}>
                        PO: {proj.po_number}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ padding:'14px 20px' }}>
                  <div style={{ display:'flex', alignItems:'center', position:'relative' }}>
                    <div style={{ position:'absolute', top:11, left:11, right:11, height:2, background:'#E5E7EB', zIndex:0 }} />
                    <div style={{
                      position:'absolute', top:11, left:11,
                      width:`${stageIdx < 0 ? 0 : (stageIdx / (STAGES.length-1)) * 88}%`,
                      height:2, background:'#F26B4E', zIndex:1, transition:'width 0.4s',
                    }} />
                    {STAGES.map((stage, i) => {
                      const done = i < stageIdx, current = i === stageIdx;
                      const isUpdating = patchingId === proj.id;
                      return (
                        <div key={stage} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', zIndex:2 }}>
                          <button
                            onClick={() => !isUpdating && handleStageClick(proj.id, stage)}
                            title={`Move to ${stage.replace(/_/g,' ')}`}
                            style={{
                              width:22, height:22, borderRadius:'50%',
                              background: done || current ? '#F26B4E' : 'white',
                              border:`2px solid ${done || current ? '#F26B4E' : '#E5E7EB'}`,
                              display:'flex', alignItems:'center', justifyContent:'center',
                              fontSize:10, color: done || current ? 'white' : '#9CA3AF', fontWeight:800,
                              cursor: isUpdating ? 'wait' : (current ? 'default' : 'pointer'),
                              padding:0,
                              transition:'transform 0.1s, box-shadow 0.1s',
                              outline:'none',
                            }}
                            onMouseEnter={e => { if (!current && !isUpdating) { e.currentTarget.style.transform='scale(1.2)'; e.currentTarget.style.boxShadow='0 0 0 3px rgba(242,107,78,0.2)'; }}}
                            onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='none'; }}
                          >
                            {isUpdating && current ? '…' : done ? '✓' : i+1}
                          </button>
                          <div style={{
                            fontSize:10, marginTop:5, textAlign:'center',
                            fontWeight: current ? 700 : 400,
                            color: current ? '#F26B4E' : done ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                            maxWidth:64, lineHeight:1.3,
                          }}>
                            {stage.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
      }

      {/* ── New Project Modal ── */}
      <Modal open={open} onClose={() => setOpen(false)} title="New Project" width={580}>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>

          <FormGrid cols={2}>
            <Field label="Client" required>
              <select className="bess-input" value={form.client_id}
                onChange={e => set('client_id', e.target.value)} style={{ width:'100%' }}>
                <option value="">Select client…</option>
                {cl.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </Field>
            <Field label="Site">
              <select className="bess-input" value={form.site_id}
                onChange={e => set('site_id', e.target.value)} style={{ width:'100%' }}>
                <option value="">Select site…</option>
                {clientSites.map(s => <option key={s.id} value={s.id}>{s.site_name}</option>)}
              </select>
            </Field>
          </FormGrid>

          <FormGrid cols={2}>
            <Field label="Linked Proposal">
              <select className="bess-input" value={form.proposal_id}
                onChange={e => set('proposal_id', e.target.value)} style={{ width:'100%' }}>
                <option value="">Select proposal…</option>
                {clientProposals.map(p => (
                  <option key={p.id} value={p.id}>{p.proposal_number} — {inr(p.capex_ex_gst)}</option>
                ))}
              </select>
            </Field>
            <Field label="Stage / Status">
              <select className="bess-input" value={form.status}
                onChange={e => set('status', e.target.value)} style={{ width:'100%' }}>
                {PROJECT_STATUSES.map(s => (
                  <option key={s} value={s}>{s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>
                ))}
              </select>
            </Field>
          </FormGrid>

          <div style={{ borderTop:'1px solid hsl(var(--border))', paddingTop:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'hsl(var(--muted-foreground))', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:12 }}>Purchase Order Details</div>
            <FormGrid cols={2}>
              <Field label="PO Number">
                <Input placeholder="e.g. PO/2025-26/0042" value={form.po_number} onChange={e => set('po_number', e.target.value)} />
              </Field>
              <Field label="PO Value (₹ Ex-GST)">
                <Input type="number" min="0" step="1000" placeholder="e.g. 85,00,000"
                  value={form.po_value_inr} onChange={e => set('po_value_inr', e.target.value)} />
              </Field>
            </FormGrid>
          </div>

          <div style={{ borderTop:'1px solid hsl(var(--border))', paddingTop:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'hsl(var(--muted-foreground))', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:12 }}>Key Dates</div>
            <FormGrid cols={2}>
              <Field label="Target Installation Date">
                <Input type="date" value={form.installation_date} onChange={e => set('installation_date', e.target.value)} />
              </Field>
              <Field label="Target Commissioning Date">
                <Input type="date" value={form.commissioning_date} onChange={e => set('commissioning_date', e.target.value)} />
              </Field>
            </FormGrid>
          </div>

          {saveErr && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#DC2626', fontWeight:600 }}>
              {saveErr}
            </div>
          )}

          <SubmitRow onClose={() => setOpen(false)} loading={saving} label="Create Project" />
        </form>
      </Modal>

    </div>
  );
}
