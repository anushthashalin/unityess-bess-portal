import { useState } from 'react';
import { FileText, Download, Plus } from 'lucide-react';
import { useApiMulti } from '../hooks/useApi.js';
import { bessApi } from '../lib/api.js';
import { inr, date } from '../lib/fmt.js';
import { Spinner, ErrorBanner } from '../components/Spinner.jsx';
import Modal, { Field, Input, FormGrid, SubmitRow } from '../components/Modal.jsx';

const PROPOSAL_STATUSES = ['draft','sent','negotiation','won','lost'];

const EMPTY = {
  client_id:'', site_id:'', bess_config_id:'', proposal_date:'',
  status:'draft', capex_ex_gst:'', annual_savings:'',
  payback_years:'', irr_percent:'', validity_days:'90', notes:'',
};

export default function Proposals() {
  const [open, setOpen]       = useState(false);
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [refresh, setRefresh] = useState(0);

  const { proposals, clients, sites, configs } = useApiMulti({
    proposals: bessApi.proposals,
    clients:   bessApi.clients,
    sites:     bessApi.sites,
    configs:   bessApi.configs,
  }, [refresh]);

  const loading = proposals?.loading || clients?.loading || sites?.loading || configs?.loading;
  if (loading) return <Spinner />;
  if (proposals?.error) return <ErrorBanner message={proposals.error} />;

  const rows = (proposals?.data ?? []).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  const cl   = clients?.data  ?? [];
  const sl   = sites?.data    ?? [];
  const cfg  = configs?.data  ?? [];

  // Filter sites by selected client
  const clientSites = form.client_id
    ? sl.filter(s => String(s.client_id) === String(form.client_id))
    : sl;

  const totalCapex   = rows.reduce((s,p) => s + Number(p.capex_ex_gst   ?? 0), 0);
  const totalSavings = rows.reduce((s,p) => s + Number(p.annual_savings  ?? 0), 0);
  const avgIRR       = rows.length ? (rows.reduce((s,p) => s + Number(p.irr_percent ?? 0), 0) / rows.length).toFixed(1) : '—';
  const avgPayback   = rows.length ? (rows.reduce((s,p) => s + Number(p.payback_years ?? 0), 0) / rows.length).toFixed(1) : '—';

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async e => {
    e.preventDefault();
    setSaveErr('');
    if (!form.client_id) { setSaveErr('Please select a client.'); return; }
    if (!form.capex_ex_gst) { setSaveErr('CAPEX is required.'); return; }
    setSaving(true);
    try {
      await bessApi.createProposal(form);
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
          <h1 style={{ fontSize:22, fontWeight:900, color:'#2D2D2D', margin:0 }}>Proposals</h1>
          <p style={{ fontSize:13, color:'#9CA3AF', margin:'4px 0 0' }}>{rows.length} proposals · Ex-GST</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(EMPTY); setSaveErr(''); setOpen(true); }}>
          <Plus size={14} style={{ marginRight:6, display:'inline' }} />New Proposal
        </button>
      </div>

      {/* KPI cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
        {[
          { label:'Total CAPEX Pipeline',   value: inr(totalCapex),   sub:'Ex-GST' },
          { label:'Annual Savings (Total)', value: inr(totalSavings) + '/yr', sub:'Across all proposals' },
          { label:'Average IRR',            value: avgIRR === '—' ? '—' : `${avgIRR}%`, sub:'Post-tax' },
          { label:'Average Payback',        value: avgPayback === '—' ? '—' : `${avgPayback} yrs`, sub:'Simple payback' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="kpi-card">
            <div style={{ fontSize:11, color:'#9CA3AF', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>{label}</div>
            <div style={{ fontSize:22, fontWeight:900, color:'#2D2D2D' }}>{value}</div>
            <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="section-card">
        {rows.length === 0
          ? <div style={{ padding:48, textAlign:'center', color:'#9CA3AF', fontSize:14 }}>No proposals yet.</div>
          : <div style={{ overflowX:'auto' }}>
              <table className="bess-table">
                <thead>
                  <tr>
                    <th>Proposal No.</th><th>Client</th><th>Date</th>
                    <th>CAPEX (Ex-GST)</th><th>Annual Savings</th>
                    <th>Payback</th><th>IRR</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <FileText size={13} color="#F26B4E" />
                          <span style={{ fontWeight:700, fontFamily:'monospace' }}>{p.proposal_number}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight:700 }}>{p.company_name}</td>
                      <td style={{ color:'#6B7280' }}>{date(p.proposal_date ?? p.created_at)}</td>
                      <td style={{ fontWeight:800 }}>{inr(p.capex_ex_gst)}</td>
                      <td style={{ color:'#16A34A', fontWeight:700 }}>{inr(p.annual_savings)}{p.annual_savings ? '/yr' : ''}</td>
                      <td>{p.payback_years ? `${p.payback_years} yrs` : '—'}</td>
                      <td style={{ fontWeight:800, color:'#F26B4E' }}>{p.irr_percent ? `${p.irr_percent}%` : '—'}</td>
                      <td><span className={`badge badge-${p.status}`}>{p.status.replace(/\b\w/g,c=>c.toUpperCase())}</span></td>
                      <td>
                        <button style={{ background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', display:'flex', alignItems:'center', gap:4, fontSize:12 }}>
                          <Download size={13}/> PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>

      {/* ── New Proposal Modal ── */}
      <Modal open={open} onClose={() => setOpen(false)} title="New Proposal" width={600}>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Client + Site + Config */}
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
            <Field label="BESS Configuration">
              <select className="bess-input" value={form.bess_config_id}
                onChange={e => set('bess_config_id', e.target.value)} style={{ width:'100%' }}>
                <option value="">Select BESS config…</option>
                {cfg.map(c => <option key={c.id} value={c.id}>{c.config_name} — {c.num_units} units</option>)}
              </select>
            </Field>
            <Field label="Proposal Date">
              <Input type="date" value={form.proposal_date} onChange={e => set('proposal_date', e.target.value)} />
            </Field>
          </FormGrid>

          {/* Financials */}
          <div style={{ borderTop:'1px solid #F3F4F6', paddingTop:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:12 }}>Financial Parameters</div>
            <FormGrid cols={2}>
              <Field label="CAPEX Ex-GST (₹)" required>
                <Input type="number" min="0" step="1000" placeholder="e.g. 85,00,000"
                  value={form.capex_ex_gst} onChange={e => set('capex_ex_gst', e.target.value)} />
              </Field>
              <Field label="Annual Savings (₹/yr)">
                <Input type="number" min="0" step="1000" placeholder="e.g. 18,00,000"
                  value={form.annual_savings} onChange={e => set('annual_savings', e.target.value)} />
              </Field>
              <Field label="Payback Period (years)">
                <Input type="number" min="0" step="0.1" placeholder="e.g. 4.7"
                  value={form.payback_years} onChange={e => set('payback_years', e.target.value)} />
              </Field>
              <Field label="IRR (%)">
                <Input type="number" min="0" step="0.1" placeholder="e.g. 18.5"
                  value={form.irr_percent} onChange={e => set('irr_percent', e.target.value)} />
              </Field>
            </FormGrid>
          </div>

          {/* Status + Validity */}
          <FormGrid cols={2}>
            <Field label="Status">
              <select className="bess-input" value={form.status}
                onChange={e => set('status', e.target.value)} style={{ width:'100%' }}>
                {PROPOSAL_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </Field>
            <Field label="Validity (days)">
              <Input type="number" min="1" max="365" placeholder="90"
                value={form.validity_days} onChange={e => set('validity_days', e.target.value)} />
            </Field>
          </FormGrid>

          {/* Notes */}
          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Key assumptions, scope inclusions/exclusions, client-specific notes…"
              rows={3}
              style={{
                border:'1px solid #E5E7EB', borderRadius:8, padding:'9px 12px',
                fontSize:13, fontFamily:'Chivo, sans-serif', color:'#2D2D2D',
                outline:'none', width:'100%', resize:'vertical', boxSizing:'border-box',
                transition:'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={e => { e.target.style.borderColor='#F26B4E'; e.target.style.boxShadow='0 0 0 3px rgba(242,107,78,0.12)'; }}
              onBlur={e => { e.target.style.borderColor='#E5E7EB'; e.target.style.boxShadow='none'; }}
            />
          </Field>

          {saveErr && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#DC2626', fontWeight:600 }}>
              {saveErr}
            </div>
          )}

          <SubmitRow onClose={() => setOpen(false)} loading={saving} label="Create Proposal" />
        </form>
      </Modal>

    </div>
  );
}
