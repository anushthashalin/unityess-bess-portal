import { useState, useCallback } from 'react';
import { useApiMulti } from '../hooks/useApi.js';
import { bdApi } from '../lib/api.js';
import { inr, date } from '../lib/fmt.js';
import { Spinner, ErrorBanner, Empty } from '../components/Spinner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { CheckCircle, XCircle, Plus, X, Clock, ChevronDown, ChevronUp } from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────────
const APPROVAL_TYPES = [
  { key: 'discount',           label: 'Discount Request',    color: '#F26B4E', icon: '💰' },
  { key: 'payment_terms',      label: 'Payment Terms Change',color: '#8b5cf6', icon: '📋' },
  { key: 'site_visit',         label: 'Site Visit',          color: '#10b981', icon: '📍' },
  { key: 'freight',            label: 'Freight Waiver',      color: '#3b82f6', icon: '🚚' },
  { key: 'validity_extension', label: 'Validity Extension',  color: '#f59e0b', icon: '📅' },
];

const STAGE_COLORS = {
  first_connect: '#94a3b8', requirement_captured: '#3b82f6',
  proposal_sent: '#8b5cf6', technical_closure: '#f59e0b',
  commercial_negotiation: '#F26B4E', po_received: '#10b981',
};
const STAGE_LABELS = {
  first_connect: 'First Connect', requirement_captured: 'Req. Captured',
  proposal_sent: 'Proposal Sent', technical_closure: 'Tech. Closure',
  commercial_negotiation: 'Commercial', po_received: 'PO Received',
};

function typeConfig(key) {
  return APPROVAL_TYPES.find(t => t.key === key) ?? { label: key, color: '#aaa', icon: '❓' };
}

// ── Request Approval Modal ───────────────────────────────────────────────────
function RequestModal({ opps, users, currentUser, onClose, onSaved }) {
  const [form, setForm] = useState({
    opp_id: '', type: '', deviation_value: '', justification: '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.opp_id)          { setError('Select an opportunity'); return; }
    if (!form.type)             { setError('Select an approval type'); return; }
    if (!form.justification.trim()) { setError('Justification is required'); return; }
    setSaving(true);
    try {
      await bdApi.createApproval({
        opp_id:          parseInt(form.opp_id),
        type:            form.type,
        deviation_value: form.deviation_value ? parseFloat(form.deviation_value) : null,
        justification:   form.justification.trim(),
        requested_by:    currentUser?.id ?? null,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const selectedType = typeConfig(form.type);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '26px 30px', width: 500, boxShadow: '0 8px 40px rgba(0,0,0,0.15)', fontFamily: "'Chivo', sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Request Approval</h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#aaa' }}>Submit for Kedar's review</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa' }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Approval type selector */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 8 }}>Approval Type *</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {APPROVAL_TYPES.map(t => (
                  <button key={t.key} type="button" onClick={() => set('type', t.key)}
                    style={{
                      padding: '9px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                      border: form.type === t.key ? `2px solid ${t.color}` : '1.5px solid #e8e8e8',
                      background: form.type === t.key ? t.color + '12' : '#fafafa',
                      color: '#2D2D2D', fontSize: 13, textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'all 0.12s',
                    }}>
                    <span style={{ fontSize: 16 }}>{t.icon}</span>
                    <span style={{ fontWeight: form.type === t.key ? 700 : 400 }}>{t.label}</span>
                    {form.type === t.key && (
                      <span style={{ marginLeft: 'auto', width: 18, height: 18, borderRadius: '50%', background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle size={11} color="#fff" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Opportunity */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>Opportunity *</label>
              <select value={form.opp_id} onChange={e => set('opp_id', e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                <option value="">— Select opportunity —</option>
                {opps.map(o => <option key={o.id} value={o.id}>{o.company_name} — {o.title}</option>)}
              </select>
            </div>

            {/* Deviation value (conditional) */}
            {['discount', 'freight'].includes(form.type) && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>
                  {form.type === 'discount' ? 'Discount % *' : 'Freight Amount (₹)'}
                </label>
                <input type="number" step="0.01" value={form.deviation_value} onChange={e => set('deviation_value', e.target.value)}
                  placeholder={form.type === 'discount' ? 'e.g. 2.5' : 'e.g. 15000'}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#F26B4E'}
                  onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
                {form.type === 'discount' && form.deviation_value > 5 && (
                  <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>⚠ Max discount policy is 5%</div>
                )}
              </div>
            )}

            {/* Justification */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>Justification *</label>
              <textarea value={form.justification} onChange={e => set('justification', e.target.value)} rows={3}
                placeholder="Why is this approval needed? What's the business case?"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
                onFocus={e => e.target.style.borderColor = '#F26B4E'}
                onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
            </div>
          </div>

          {error && <div style={{ marginTop: 12, background: '#fff5f3', border: '1px solid #F26B4E', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: '#c0392b' }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 7, border: '1.5px solid #ddd', background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '9px 20px', borderRadius: 7, border: 'none', background: saving ? '#f0a899' : '#F26B4E', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Decision Modal ───────────────────────────────────────────────────────────
function DecisionModal({ approval, currentUser, onClose, onDecision }) {
  const [notes,   setNotes]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [decision, setDecision] = useState(null); // 'approved' | 'rejected'

  const tc = typeConfig(approval.type);

  async function handleDecide(status) {
    setDecision(status);
    setSaving(true);
    try {
      await bdApi.patchApproval(approval.id, {
        status,
        approver_notes: notes.trim() || null,
        approver_id:    currentUser?.id ?? null,
      });
      onDecision();
    } catch (e) {
      setSaving(false);
      setDecision(null);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '26px 30px', width: 480, boxShadow: '0 8px 40px rgba(0,0,0,0.15)', fontFamily: "'Chivo', sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Review Approval Request</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa' }}><X size={18} /></button>
        </div>

        {/* Summary card */}
        <div style={{ background: tc.color + '10', border: `1.5px solid ${tc.color}30`, borderRadius: 10, padding: '14px 16px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>{tc.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: tc.color }}>{tc.label}</div>
              <div style={{ fontSize: 11, color: '#888' }}>Requested by {approval.requested_by_name} · {date(approval.requested_at)}</div>
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{approval.company_name}</div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{approval.opp_title}</div>
          {approval.deviation_value != null && (
            <div style={{ fontSize: 12, color: tc.color, fontWeight: 700 }}>
              {approval.type === 'discount' ? `${approval.deviation_value}% discount` : `₹${Number(approval.deviation_value).toLocaleString('en-IN')} waiver`}
              {approval.type === 'discount' && approval.deviation_value > 5 && (
                <span style={{ marginLeft: 8, color: '#ef4444' }}>⚠ Exceeds 5% policy</span>
              )}
            </div>
          )}
          {approval.justification && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#555', fontStyle: 'italic', borderTop: '1px solid ' + tc.color + '20', paddingTop: 8 }}>
              "{approval.justification}"
            </div>
          )}
        </div>

        {/* Approver notes */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="Add conditions, remarks, or reason for rejection…"
            style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', resize: 'none' }}
            onFocus={e => e.target.style.borderColor = '#F26B4E'}
            onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
        </div>

        {/* Decision buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => handleDecide('rejected')} disabled={saving}
            style={{
              flex: 1, padding: '11px', borderRadius: 8, border: '2px solid #ef4444',
              background: decision === 'rejected' ? '#ef4444' : '#fff',
              color: decision === 'rejected' ? '#fff' : '#ef4444',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.15s',
            }}>
            <XCircle size={15} /> Reject
          </button>
          <button onClick={() => handleDecide('approved')} disabled={saving}
            style={{
              flex: 1, padding: '11px', borderRadius: 8, border: '2px solid #10b981',
              background: decision === 'approved' ? '#10b981' : '#fff',
              color: decision === 'approved' ? '#fff' : '#10b981',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.15s',
            }}>
            <CheckCircle size={15} /> Approve
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Approval card ────────────────────────────────────────────────────────────
function ApprovalCard({ ap, isApprover, onReview }) {
  const tc = typeConfig(ap.type);
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '14px 16px',
      border: '1px solid #f0f0f0', borderLeft: `4px solid ${tc.color}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* Left */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: tc.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
            {tc.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{ap.company_name}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{ap.opp_title}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, background: tc.color + '18', color: tc.color, padding: '2px 8px', borderRadius: 20 }}>
                {tc.label}
              </span>
              {ap.stage && (
                <span style={{ fontSize: 10, fontWeight: 700, color: STAGE_COLORS[ap.stage] ?? '#aaa' }}>
                  {STAGE_LABELS[ap.stage] ?? ap.stage}
                </span>
              )}
              {ap.deviation_value != null && (
                <span style={{ fontSize: 11, color: tc.color, fontWeight: 700 }}>
                  {ap.type === 'discount' ? `${ap.deviation_value}% off` : `₹${Number(ap.deviation_value).toLocaleString('en-IN')}`}
                  {ap.type === 'discount' && ap.deviation_value > 5 && <span style={{ color: '#ef4444', marginLeft: 4 }}>⚠</span>}
                </span>
              )}
              {ap.estimated_value && (
                <span style={{ fontSize: 11, color: '#aaa' }}>{inr(ap.estimated_value)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Right — actions or status */}
        <div style={{ flexShrink: 0, marginLeft: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {ap.status === 'pending' ? (
            isApprover ? (
              <button onClick={() => onReview(ap)}
                style={{
                  padding: '6px 14px', borderRadius: 7, border: '2px solid #F26B4E',
                  background: '#fff', color: '#F26B4E', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                Review
              </button>
            ) : (
              <span style={{ fontSize: 11, background: '#fef3c7', color: '#f59e0b', fontWeight: 700, padding: '4px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={10} /> Pending
              </span>
            )
          ) : ap.status === 'approved' ? (
            <span style={{ fontSize: 11, background: '#f0fdf4', color: '#10b981', fontWeight: 700, padding: '4px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle size={10} /> Approved
            </span>
          ) : (
            <span style={{ fontSize: 11, background: '#fef2f2', color: '#ef4444', fontWeight: 700, padding: '4px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
              <XCircle size={10} /> Rejected
            </span>
          )}
          <div style={{ fontSize: 10, color: '#bbb' }}>{date(ap.requested_at)}</div>
        </div>
      </div>

      {/* Expandable detail */}
      <button onClick={() => setExpanded(v => !v)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#bbb', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit', padding: 0 }}>
        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        {expanded ? 'Less' : 'Details'}
      </button>

      {expanded && (
        <div style={{ marginTop: 10, padding: '10px 12px', background: '#f9fafb', borderRadius: 8, fontSize: 12 }}>
          {ap.justification && <div style={{ color: '#555', marginBottom: 6 }}><strong>Justification:</strong> {ap.justification}</div>}
          <div style={{ color: '#aaa' }}>Requested by <strong style={{ color: '#666' }}>{ap.requested_by_name}</strong></div>
          {ap.approver_name && <div style={{ color: '#aaa', marginTop: 4 }}>Reviewed by <strong style={{ color: '#666' }}>{ap.approver_name}</strong>{ap.approved_at ? ` on ${date(ap.approved_at)}` : ''}</div>}
          {ap.approver_notes && <div style={{ marginTop: 6, color: '#555', fontStyle: 'italic' }}>"{ap.approver_notes}"</div>}
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function BDApprovals({ product = 'bess' }) {
  const { user } = useAuth();
  const [showRequest,  setShowRequest]  = useState(false);
  const [reviewing,    setReviewing]    = useState(null);
  const [showHistory,  setShowHistory]  = useState(false);

  const isApprover = user?.role === 'approver';

  const { pending: pendingRes, history: historyRes, opps: oppsRes, users: usersRes, loading, error, refetch } = useApiMulti({
    pending:  () => bdApi.approvals({ product_type: product }),
    history:  () => bdApi.approvals({ status: 'all', product_type: product }),
    opps:     () => bdApi.opps({ product_type: product }),
    users:    bdApi.users,
  }, [product]);

  if (loading) return <Spinner />;
  if (error)   return <ErrorBanner message={error} />;

  const pending      = pendingRes?.data  ?? [];
  const allApprovals = historyRes?.data  ?? [];
  const opps         = oppsRes?.data     ?? [];
  const users        = usersRes?.data    ?? [];

  const resolved   = allApprovals.filter(a => a.status !== 'pending');
  const openOpps   = opps.filter(o => !o.closed_at && o.stage !== 'lost');

  return (
    <div style={{ fontFamily: "'Chivo', sans-serif", color: '#2D2D2D' }}>
      {showRequest && (
        <RequestModal
          opps={openOpps}
          users={users}
          currentUser={user}
          onClose={() => setShowRequest(false)}
          onSaved={() => { setShowRequest(false); refetch(); }}
        />
      )}
      {reviewing && (
        <DecisionModal
          approval={reviewing}
          currentUser={user}
          onClose={() => setReviewing(null)}
          onDecision={() => { setReviewing(null); refetch(); }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Approvals</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>
            {pending.length > 0
              ? <span style={{ color: '#f59e0b', fontWeight: 700 }}>{pending.length} pending review</span>
              : 'No pending approvals'
            }
            {resolved.length > 0 && <span style={{ color: '#aaa' }}> · {resolved.length} resolved</span>}
          </p>
        </div>
        <button onClick={() => setShowRequest(true)} style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: '#F26B4E', color: '#fff', border: 'none',
          borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <Plus size={15} /> Request Approval
        </button>
      </div>

      {/* Approver notice */}
      {isApprover && pending.length > 0 && (
        <div style={{
          background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 10,
          padding: '12px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
        }}>
          <Clock size={16} color="#f59e0b" />
          <span><strong>{pending.length} request{pending.length > 1 ? 's' : ''}</strong> waiting for your decision. Click <strong>Review</strong> on each card to approve or reject.</span>
        </div>
      )}

      {/* Pending section */}
      {pending.length === 0 ? (
        <Empty message="No pending approvals. Use 'Request Approval' to submit a new request." />
      ) : (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Pending</span>
            <span style={{ background: '#fef3c7', color: '#f59e0b', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{pending.length}</span>
            <div style={{ flex: 1, height: 1, background: '#f0f0f0' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pending.map(ap => (
              <ApprovalCard key={ap.id} ap={ap} isApprover={isApprover} onReview={setReviewing} />
            ))}
          </div>
        </div>
      )}

      {/* History toggle */}
      {resolved.length > 0 && (
        <div>
          <button onClick={() => setShowHistory(v => !v)} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 12, fontWeight: 700, color: '#aaa', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0',
          }}>
            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showHistory ? 'Hide' : 'Show'} resolved ({resolved.length})
          </button>
          {showHistory && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Resolved</span>
                <div style={{ flex: 1, height: 1, background: '#f0f0f0' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: 0.75 }}>
                {resolved.map(ap => (
                  <ApprovalCard key={ap.id} ap={ap} isApprover={false} onReview={() => {}} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
