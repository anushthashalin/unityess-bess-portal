import { useState, useCallback, useMemo } from 'react';
import { useApi } from '../hooks/useApi.js';
import { bdApi } from '../lib/api.js';
import { inr, date } from '../lib/fmt.js';
import { Spinner, ErrorBanner, Empty } from '../components/Spinner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import EmailComposeModal from '../components/EmailComposeModal.jsx';
import {
  FileText, Plus, ChevronDown, ChevronRight, Send,
  CheckCircle, XCircle, Clock, Eye, Mail,
} from 'lucide-react';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
  draft:    { label: 'Draft',    bg: '#f1f5f9', color: '#64748b' },
  sent:     { label: 'Sent',     bg: '#eff6ff', color: '#2563eb' },
  accepted: { label: 'Accepted', bg: '#f0fdf4', color: '#16a34a' },
  rejected: { label: 'Rejected', bg: '#fef2f2', color: '#dc2626' },
  expired:  { label: 'Expired',  bg: '#fafafa', color: '#9ca3af' },
};

const SCOPE_LABELS = {
  bess_only:       'BESS Only',
  solar_bess:      'Solar + BESS',
  epc_full:        'Full EPC',
  om:              'O&M',
  retrofit:        'Retrofit',
};

const PAYMENT_PRESETS = [
  '30% advance, 60% before dispatch, 10% on commissioning',
  '50% advance, 40% before dispatch, 10% on commissioning',
  '40% advance, 50% on delivery, 10% on commissioning',
  'As per LC terms',
];

function StatusChip({ status }) {
  const s = STATUS[status] ?? STATUS.draft;
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: 10, fontWeight: 700, padding: '3px 9px',
      borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.5px',
    }}>
      {s.label}
    </span>
  );
}

// ── Create Proposal Modal ─────────────────────────────────────────────────────
function CreateProposalModal({ opps, onClose, onSave }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    opp_id: '',
    units: 1,
    unit_kwh: 261,
    unit_price: '',
    discount_pct: 0,
    payment_terms: PAYMENT_PRESETS[0],
    delivery_weeks: 8,
    validity_days: 30,
    notes: '',
    scope_description: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Derived pricing
  const totalKwh      = form.units * form.unit_kwh;
  const grossValue    = (parseFloat(form.unit_price) || 0) * form.units;
  const discountAmt   = grossValue * (parseFloat(form.discount_pct) || 0) / 100;
  const netExGst      = grossValue - discountAmt;
  const gst18         = netExGst * 0.18;
  const totalWithGst  = netExGst + gst18;

  const selectedOpp = opps.find(o => String(o.id) === String(form.opp_id));

  async function handleSave() {
    if (!form.opp_id) { setErr('Select an opportunity'); return; }
    if (!form.unit_price) { setErr('Enter unit price'); return; }
    setSaving(true);
    try {
      const content = {
        units: parseInt(form.units),
        unit_kwh: parseFloat(form.unit_kwh),
        total_kwh: totalKwh,
        unit_price: parseFloat(form.unit_price),
        discount_pct: parseFloat(form.discount_pct) || 0,
        discount_amt: discountAmt,
        net_ex_gst: netExGst,
        gst_18: gst18,
        total_with_gst: totalWithGst,
        payment_terms: form.payment_terms,
        delivery_weeks: parseInt(form.delivery_weeks),
        validity_days: parseInt(form.validity_days),
        notes: form.notes,
        scope_description: form.scope_description,
      };
      await onSave({ opp_id: parseInt(form.opp_id), content, created_by: user?.id });
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  const inp = {
    border: '1px solid hsl(var(--border))', borderRadius: 7, padding: '8px 11px',
    fontSize: 13, fontFamily: "'Chivo', sans-serif", color: 'hsl(var(--foreground))',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  };
  const label = { fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))',
    textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
    }}>
      <div style={{
        background: 'hsl(var(--card))', borderRadius: 14, width: '100%', maxWidth: 680,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px', borderBottom: '1px solid #f0f0f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, background: 'hsl(var(--card))', zIndex: 1,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>New Proposal</h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
              A new version will be auto-assigned for the selected opportunity
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#aaa',
          }}>×</button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {err && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
              padding: '10px 14px', fontSize: 12, color: '#dc2626', marginBottom: 16,
            }}>
              {err}
            </div>
          )}

          {/* Opportunity selector */}
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Opportunity *</label>
            <select value={form.opp_id} onChange={e => set('opp_id', e.target.value)} style={inp}>
              <option value="">— Select opportunity —</option>
              {opps.filter(o => !['po_received','lost'].includes(o.stage)).map(o => (
                <option key={o.id} value={o.id}>
                  {o.company_name} — {o.title} [{o.opp_id}]
                </option>
              ))}
            </select>
          </div>

          {/* Opp context banner */}
          {selectedOpp && (
            <div style={{
              background: '#F26B4E0e', border: '1px solid #F26B4E30',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              fontSize: 12, color: 'hsl(var(--foreground))',
            }}>
              <strong>{selectedOpp.company_name}</strong> · {selectedOpp.city}, {selectedOpp.state}
              {selectedOpp.contact_name && <> · Contact: {selectedOpp.contact_name}</>}
              <span style={{ marginLeft: 12, color: '#F26B4E', fontWeight: 700 }}>
                {SCOPE_LABELS[selectedOpp.scope_type] ?? selectedOpp.scope_type}
              </span>
            </div>
          )}

          {/* Scope description */}
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Scope Description</label>
            <input
              value={form.scope_description}
              onChange={e => set('scope_description', e.target.value)}
              placeholder="e.g. Supply and commissioning of 2 × UESS-125-261 at DG bypass"
              style={inp}
            />
          </div>

          {/* Sizing grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={label}>No. of Units</label>
              <input type="number" min="1" value={form.units}
                onChange={e => set('units', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={label}>kWh per Unit</label>
              <input type="number" min="1" value={form.unit_kwh}
                onChange={e => set('unit_kwh', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={label}>Total Capacity</label>
              <input value={`${totalKwh} kWh`} disabled style={{ ...inp, background: '#f9f9f9', color: 'hsl(var(--muted-foreground))' }} />
            </div>
          </div>

          {/* Pricing grid */}
          <div style={{
            background: '#fafafa', borderRadius: 10, padding: '16px',
            border: '1px solid hsl(var(--border))', marginBottom: 16,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase',
              letterSpacing: '0.5px', marginBottom: 12 }}>Pricing (Ex-GST)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={label}>Unit Price (₹ ex-GST)</label>
                <input type="number" min="0" value={form.unit_price}
                  onChange={e => set('unit_price', e.target.value)}
                  placeholder="e.g. 2500000"
                  style={inp} />
              </div>
              <div>
                <label style={label}>Discount %</label>
                <input type="number" min="0" max="50" step="0.5" value={form.discount_pct}
                  onChange={e => set('discount_pct', e.target.value)} style={inp} />
              </div>
            </div>

            {/* Pricing breakdown */}
            {parseFloat(form.unit_price) > 0 && (
              <div style={{ fontSize: 12, borderTop: '1px dashed #e5e7eb', paddingTop: 12 }}>
                {[
                  ['Gross Value (ex-GST)', grossValue],
                  ['Discount', -discountAmt],
                  ['Net Value (ex-GST)', netExGst],
                  ['GST @ 18%', gst18],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'hsl(var(--muted-foreground))' }}>{label}</span>
                    <span style={{ fontWeight: 600, color: val < 0 ? '#ef4444' : '#2D2D2D' }}>
                      {val < 0 ? `(${inr(-val)})` : inr(val)}
                    </span>
                  </div>
                ))}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  borderTop: '1px solid #e5e7eb', marginTop: 6, paddingTop: 6,
                  fontWeight: 800, fontSize: 13,
                }}>
                  <span>Total (incl. 18% GST)</span>
                  <span style={{ color: '#F26B4E' }}>{inr(totalWithGst)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Commercial terms */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={label}>Delivery (weeks)</label>
              <input type="number" min="1" value={form.delivery_weeks}
                onChange={e => set('delivery_weeks', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={label}>Validity (days)</label>
              <input type="number" min="1" value={form.validity_days}
                onChange={e => set('validity_days', e.target.value)} style={inp} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={label}>Payment Terms</label>
            <select value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)} style={inp}>
              {PAYMENT_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
              <option value="custom">Custom…</option>
            </select>
            {form.payment_terms === 'custom' && (
              <input
                style={{ ...inp, marginTop: 8 }}
                placeholder="Enter custom payment terms"
                onChange={e => set('payment_terms', e.target.value === 'custom' ? '' : e.target.value)}
              />
            )}
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={label}>Notes / Special Conditions</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Installation exclusions, site readiness requirements, etc."
              style={{ ...inp, resize: 'vertical' }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={onClose} style={{
              padding: '9px 20px', border: '1px solid hsl(var(--border))', borderRadius: 8,
              background: 'hsl(var(--card))', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              fontFamily: "'Chivo', sans-serif",
            }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} style={{
              padding: '9px 20px', border: 'none', borderRadius: 8,
              background: saving ? '#ccc' : '#F26B4E', color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700,
              fontFamily: "'Chivo', sans-serif",
            }}>
              {saving ? 'Creating…' : 'Create Draft Proposal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Proposal Detail Panel ─────────────────────────────────────────────────────
function ProposalPanel({ proposal, onClose, onStatusChange, onEmail }) {
  const [changing, setChanging] = useState(false);
  const c = proposal.content ?? {};

  async function doStatus(newStatus) {
    setChanging(true);
    try { await onStatusChange(proposal.id, newStatus); }
    finally { setChanging(false); }
  }

  const row = (label, val) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0',
      borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
      <span style={{ color: 'hsl(var(--muted-foreground))' }}>{label}</span>
      <span style={{ fontWeight: 600, color: 'hsl(var(--foreground))', textAlign: 'right', maxWidth: '60%' }}>{val}</span>
    </div>
  );

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 440,
      background: 'hsl(var(--card))', boxShadow: '-4px 0 30px rgba(0,0,0,0.12)',
      zIndex: 900, display: 'flex', flexDirection: 'column', overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px', borderBottom: '1px solid #f0f0f0',
        position: 'sticky', top: 0, background: 'hsl(var(--card))', zIndex: 1,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{proposal.prop_number ?? `Proposal v${proposal.version}`}</span>
              <StatusChip status={proposal.status} />
            </div>
            <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
              {proposal.company_name} · {proposal.opp_title}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#aaa',
          }}>×</button>
        </div>
      </div>

      <div style={{ padding: '16px 24px', flex: 1 }}>
        {/* Client */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase',
            letterSpacing: '0.5px', marginBottom: 8 }}>Client</div>
          {row('Company', proposal.company_name)}
          {row('Location', [proposal.city, proposal.state].filter(Boolean).join(', ') || '—')}
          {proposal.contact_name && row('Contact', `${proposal.contact_name}${proposal.contact_designation ? ` · ${proposal.contact_designation}` : ''}`)}
          {proposal.contact_email && row('Email', proposal.contact_email)}
          {proposal.gstin && row('GSTIN', proposal.gstin)}
        </div>

        {/* Scope */}
        {c.scope_description && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase',
              letterSpacing: '0.5px', marginBottom: 8 }}>Scope</div>
            <div style={{ fontSize: 13, color: 'hsl(var(--foreground))', lineHeight: 1.6 }}>{c.scope_description}</div>
          </div>
        )}

        {/* Sizing */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase',
            letterSpacing: '0.5px', marginBottom: 8 }}>System Configuration</div>
          {row('Units', `${c.units ?? '—'} × UESS-125-${c.unit_kwh ?? 261}`)}
          {row('Total Capacity', `${c.total_kwh ?? '—'} kWh`)}
        </div>

        {/* Pricing */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase',
            letterSpacing: '0.5px', marginBottom: 8 }}>Pricing</div>
          {row('Unit Price (ex-GST)', inr(c.unit_price))}
          {row('Gross Value (ex-GST)', inr(c.units * c.unit_price))}
          {(c.discount_pct > 0) && row(`Discount (${c.discount_pct}%)`, `(${inr(c.discount_amt)})`)}
          {row('Net Value (ex-GST)', inr(c.net_ex_gst))}
          {row('GST @ 18%', inr(c.gst_18))}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '10px 0', fontWeight: 800, fontSize: 14,
            borderTop: '2px solid #e5e7eb', marginTop: 4,
          }}>
            <span>Total (incl. GST)</span>
            <span style={{ color: '#F26B4E' }}>{inr(c.total_with_gst)}</span>
          </div>
        </div>

        {/* Commercial */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase',
            letterSpacing: '0.5px', marginBottom: 8 }}>Commercial Terms</div>
          {row('Payment Terms', c.payment_terms ?? '—')}
          {row('Delivery', `${c.delivery_weeks ?? '—'} weeks from advance receipt`)}
          {row('Validity', `${c.validity_days ?? 30} days from proposal date`)}
        </div>

        {/* Notes */}
        {c.notes && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase',
              letterSpacing: '0.5px', marginBottom: 8 }}>Notes</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', lineHeight: 1.7,
              background: '#f9f9f9', borderRadius: 8, padding: '10px 12px' }}>
              {c.notes}
            </div>
          </div>
        )}

        {/* Meta */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase',
            letterSpacing: '0.5px', marginBottom: 8 }}>History</div>
          {row('Created', `${date(proposal.created_at)}${proposal.created_by_name ? ` by ${proposal.created_by_name}` : ''}`)}
          {proposal.sent_at && row('Sent', date(proposal.sent_at))}
          {proposal.closed_at && row('Closed', date(proposal.closed_at))}
        </div>
      </div>

      {/* Status action buttons */}
      <div style={{
        padding: '14px 24px', borderTop: '1px solid #f0f0f0',
        position: 'sticky', bottom: 0, background: 'hsl(var(--card))',
        display: 'flex', gap: 8, flexWrap: 'wrap',
      }}>
        {/* Email button — always available while draft or sent */}
        {['draft','sent'].includes(proposal.status) && (
          <button
            onClick={() => onEmail && onEmail(proposal)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px 14px', border: '1.5px solid #2563eb', borderRadius: 8,
              background: '#eff6ff', color: '#2563eb', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, fontFamily: "'Chivo', sans-serif",
            }}
          >
            <Mail size={13} />
            Send Email
          </button>
        )}

        {proposal.status === 'draft' && (
          <button
            onClick={() => doStatus('sent')} disabled={changing}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px 14px', border: 'none', borderRadius: 8,
              background: '#2563eb', color: '#fff', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, fontFamily: "'Chivo', sans-serif",
            }}
          >
            <Send size={13} />
            Mark as Sent
          </button>
        )}
        {proposal.status === 'sent' && (
          <>
            <button
              onClick={() => doStatus('accepted')} disabled={changing}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 14px', border: 'none', borderRadius: 8,
                background: '#16a34a', color: '#fff', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, fontFamily: "'Chivo', sans-serif",
              }}
            >
              <CheckCircle size={13} />
              Accepted
            </button>
            <button
              onClick={() => doStatus('rejected')} disabled={changing}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 14px', border: 'none', borderRadius: 8,
                background: '#dc2626', color: '#fff', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, fontFamily: "'Chivo', sans-serif",
              }}
            >
              <XCircle size={13} />
              Rejected
            </button>
            <button
              onClick={() => doStatus('expired')} disabled={changing}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 14px', border: '1px solid hsl(var(--border))', borderRadius: 8,
                background: 'hsl(var(--card))', color: '#64748b', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, fontFamily: "'Chivo', sans-serif",
              }}
            >
              <Clock size={13} />
              Expired
            </button>
          </>
        )}
        {['accepted','rejected','expired'].includes(proposal.status) && (
          <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', padding: '10px 0' }}>
            Proposal closed — create a new version if needed.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Version history row ───────────────────────────────────────────────────────
function OppVersionGroup({ oppKey, proposals, onView, onEmail }) {
  const [expanded, setExpanded] = useState(true);
  const latest = proposals[0];

  return (
    <div style={{ marginBottom: 4 }}>
      {/* Group header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', background: '#fafafa',
          borderRadius: expanded ? '8px 8px 0 0' : 8,
          border: '1px solid hsl(var(--border))',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        {expanded ? <ChevronDown size={14} color="#888" /> : <ChevronRight size={14} color="#888" />}
        <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{latest.company_name}</span>
        <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{latest.opp_title}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, color: '#F26B4E',
          background: '#F26B4E0f', padding: '2px 8px', borderRadius: 20,
        }}>
          {proposals.length} version{proposals.length > 1 ? 's' : ''}
        </span>
      </div>

      {expanded && (
        <div style={{ border: '1px solid hsl(var(--border))', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
          {proposals.map((p, i) => {
            const c = p.content ?? {};
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '11px 16px',
                  background: i % 2 === 0 ? '#fff' : '#fafafa',
                  borderTop: i > 0 ? '1px solid #f0f0f0' : 'none',
                }}
              >
                {/* Version badge */}
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: '#F26B4E18', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#F26B4E' }}>v{p.version}</span>
                </div>

                {/* Prop number */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                    {p.prop_number ?? `Version ${p.version}`}
                  </div>
                  {c.scope_description && (
                    <div style={{
                      fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 1,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {c.scope_description}
                    </div>
                  )}
                </div>

                {/* Sizing */}
                <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 70 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>
                    {c.units ? `${c.units} × ${c.unit_kwh}kWh` : '—'}
                  </div>
                  <div style={{ fontSize: 10, color: '#aaa' }}>{c.total_kwh ? `${c.total_kwh} kWh` : ''}</div>
                </div>

                {/* Value */}
                <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 90 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#F26B4E' }}>
                    {inr(c.net_ex_gst)}
                  </div>
                  <div style={{ fontSize: 10, color: '#aaa' }}>ex-GST</div>
                </div>

                {/* Discount */}
                {(c.discount_pct > 0) && (
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: '#16a34a',
                    background: '#f0fdf4', padding: '2px 7px', borderRadius: 20, flexShrink: 0,
                  }}>
                    {c.discount_pct}% off
                  </div>
                )}

                {/* Status */}
                <StatusChip status={p.status} />

                {/* Date */}
                <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 80 }}>
                  <div style={{ fontSize: 11, color: '#aaa' }}>{date(p.created_at)}</div>
                  {p.sent_at && (
                    <div style={{ fontSize: 10, color: '#2563eb', marginTop: 2 }}>
                      Sent {date(p.sent_at)}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {['draft','sent'].includes(p.status) && (
                    <button
                      onClick={() => onEmail && onEmail(p)}
                      title="Send via Email"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '5px 10px', border: '1px solid #bfdbfe', borderRadius: 7,
                        background: '#eff6ff', cursor: 'pointer',
                        fontSize: 11, fontWeight: 700, color: '#2563eb',
                        fontFamily: "'Chivo', sans-serif",
                      }}
                    >
                      <Mail size={11} />
                      Email
                    </button>
                  )}
                  <button
                    onClick={() => onView(p)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '5px 10px', border: '1px solid hsl(var(--border))', borderRadius: 7,
                      background: 'hsl(var(--card))', cursor: 'pointer',
                      fontSize: 11, fontWeight: 700, color: 'hsl(var(--foreground))',
                      fontFamily: "'Chivo', sans-serif",
                    }}
                  >
                    <Eye size={11} />
                    View
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BDProposals({ product = 'bess' }) {
  const { data: propsData, loading, error, refetch } = useApi(() => bdApi.proposals(undefined), [product]);
  const { data: oppsData } = useApi(() => bdApi.opps({ product_type: product }), [product]);
  const [showCreate, setShowCreate]     = useState(false);
  const [viewProposal, setViewProposal] = useState(null);
  const [emailProposal, setEmailProposal] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');

  const proposals = propsData?.data ?? [];
  const opps      = oppsData?.data  ?? [];

  // Filter + search
  const filtered = useMemo(() => proposals.filter(p => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.company_name?.toLowerCase().includes(q) ||
        p.opp_title?.toLowerCase().includes(q) ||
        p.prop_number?.toLowerCase().includes(q)
      );
    }
    return true;
  }), [proposals, filterStatus, search]);

  // Group by opportunity
  const groups = useMemo(() => {
    const map = {};
    filtered.forEach(p => {
      const key = p.opp_id;
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return Object.values(map);
  }, [filtered]);

  // KPIs
  const kpi = useMemo(() => ({
    total:    proposals.length,
    draft:    proposals.filter(p => p.status === 'draft').length,
    sent:     proposals.filter(p => p.status === 'sent').length,
    accepted: proposals.filter(p => p.status === 'accepted').length,
    totalValue: proposals
      .filter(p => p.status !== 'rejected' && p.status !== 'expired')
      .reduce((s, p) => s + ((p.content?.net_ex_gst) ?? 0), 0),
  }), [proposals]);

  const handleCreate = useCallback(async (body) => {
    await bdApi.createProposal(body);
    refetch();
  }, [refetch]);

  const handleStatusChange = useCallback(async (id, status) => {
    await bdApi.patchProposal(id, { status });
    // Update local view proposal state
    setViewProposal(prev => prev?.id === id ? { ...prev, status, sent_at: status === 'sent' ? new Date().toISOString() : prev.sent_at } : prev);
    refetch();
  }, [refetch]);

  if (loading) return <Spinner />;
  if (error)   return <ErrorBanner message={error} />;

  return (
    <div style={{ fontFamily: "'Chivo', sans-serif", color: 'hsl(var(--foreground))' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Proposals</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>
            Commercial proposals with full version history per opportunity
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 18px', background: '#F26B4E', color: '#fff',
            border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: "'Chivo', sans-serif",
          }}
        >
          <Plus size={15} />
          New Proposal
        </button>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total',    val: kpi.total,    color: '#64748b' },
          { label: 'Draft',    val: kpi.draft,    color: '#64748b' },
          { label: 'Sent',     val: kpi.sent,     color: '#2563eb' },
          { label: 'Accepted', val: kpi.accepted, color: '#16a34a' },
          { label: 'Pipeline Value', val: inr(kpi.totalValue), color: '#F26B4E', wide: true },
        ].map(k => (
          <div key={k.label} style={{
            background: 'hsl(var(--card))', borderRadius: 10, padding: '14px 16px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            borderLeft: `3px solid ${k.color}`,
          }}>
            <div style={{ fontSize: k.wide ? 16 : 22, fontWeight: 800, color: k.color }}>{k.val}</div>
            <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by company, opportunity, or proposal no…"
          style={{
            flex: 1, border: '1px solid hsl(var(--border))', borderRadius: 8,
            padding: '8px 12px', fontSize: 13, fontFamily: "'Chivo', sans-serif",
            outline: 'none', color: 'hsl(var(--foreground))',
          }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'draft', 'sent', 'accepted', 'rejected', 'expired'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                padding: '7px 14px', border: '1px solid hsl(var(--border))', borderRadius: 7,
                background: filterStatus === s ? '#2D2D2D' : '#fff',
                color: filterStatus === s ? '#fff' : '#666',
                cursor: 'pointer', fontSize: 11, fontWeight: 700,
                textTransform: 'capitalize', fontFamily: "'Chivo', sans-serif",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Proposals grouped by opp */}
      {groups.length === 0
        ? <Empty message={proposals.length === 0 ? 'No proposals yet — create the first one' : 'No proposals match filter'} />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {groups.map(grp => (
              <OppVersionGroup
                key={grp[0].opp_id}
                oppKey={grp[0].opp_id}
                proposals={grp}
                onView={setViewProposal}
                onEmail={setEmailProposal}
              />
            ))}
          </div>
        )
      }

      {/* Modals */}
      {showCreate && (
        <CreateProposalModal
          opps={opps}
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
        />
      )}

      {viewProposal && (
        <>
          <div
            onClick={() => setViewProposal(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 890 }}
          />
          <ProposalPanel
            proposal={viewProposal}
            onClose={() => setViewProposal(null)}
            onStatusChange={handleStatusChange}
            onEmail={p => { setEmailProposal(p); }}
          />
        </>
      )}

      {emailProposal && (
        <EmailComposeModal
          proposal={emailProposal}
          sentBy={user?.id}
          onClose={() => setEmailProposal(null)}
          onSent={() => {
            setEmailProposal(null);
            // update viewProposal status to 'sent' if it was draft
            setViewProposal(prev =>
              prev?.id === emailProposal.id && prev.status === 'draft'
                ? { ...prev, status: 'sent', sent_at: new Date().toISOString() }
                : prev
            );
            refetch();
          }}
        />
      )}
    </div>
  );
}
