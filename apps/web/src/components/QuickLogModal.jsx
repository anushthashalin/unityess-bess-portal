import { useState } from 'react';
import { bdApi } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { X } from 'lucide-react';

const ACTIVITY_TYPES = [
  { key: 'call',       label: 'Call',        emoji: '📞' },
  { key: 'email',      label: 'Email',       emoji: '✉️' },
  { key: 'meeting',    label: 'Meeting',     emoji: '🤝' },
  { key: 'whatsapp',   label: 'WhatsApp',    emoji: '💬' },
  { key: 'site_visit', label: 'Site Visit',  emoji: '📍' },
  { key: 'demo',       label: 'Demo',        emoji: '🖥️' },
];

const DIRECTIONS  = ['outbound', 'inbound'];
const OUTCOMES    = ['interested', 'not_interested', 'follow_up', 'proposal_requested', 'technical_discussion', 'pricing_discussion', 'no_answer', 'other'];

function field(label, children) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 7,
  border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box', background: '#fff',
};

const selectStyle = { ...inputStyle };

/**
 * QuickLogModal
 * Props:
 *   opps        — array of opportunity objects (id, title, company_name)
 *   defaultOppId — pre-select an opportunity
 *   onClose     — called when modal is dismissed
 *   onSaved     — called after successful save
 */
export default function QuickLogModal({ opps = [], defaultOppId = '', onClose, onSaved }) {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    opp_id:           defaultOppId ? String(defaultOppId) : '',
    type:             'call',
    direction:        'outbound',
    summary:          '',
    outcome:          '',
    next_action:      '',
    next_action_date: '',
    duration_min:     '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.opp_id)    { setError('Select an opportunity'); return; }
    if (!form.summary.trim()) { setError('Summary is required'); return; }
    setSaving(true);
    setError('');
    try {
      await bdApi.createActivity({
        opp_id:           parseInt(form.opp_id),
        type:             form.type,
        direction:        form.direction,
        summary:          form.summary.trim(),
        outcome:          form.outcome || null,
        next_action:      form.next_action.trim() || null,
        next_action_date: form.next_action_date || null,
        duration_min:     form.duration_min ? parseInt(form.duration_min) : null,
        logged_by:        user?.id ?? null,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: '26px 30px',
        width: 520, maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        fontFamily: "'Chivo', sans-serif",
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Log Activity</h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#aaa' }}>Record a touchpoint against an opportunity</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Activity type selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 8 }}>Activity Type</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ACTIVITY_TYPES.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => set('type', t.key)}
                style={{
                  padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                  border: form.type === t.key ? '2px solid #F26B4E' : '1.5px solid #e0e0e0',
                  background: form.type === t.key ? '#fff5f3' : '#fff',
                  color: form.type === t.key ? '#F26B4E' : '#555',
                  fontSize: 12, fontWeight: form.type === t.key ? 700 : 400,
                  display: 'flex', alignItems: 'center', gap: 5,
                  transition: 'all 0.12s',
                }}
              >
                <span>{t.emoji}</span> {t.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Opportunity */}
            {field('Opportunity *',
              <select value={form.opp_id} onChange={e => set('opp_id', e.target.value)} style={selectStyle}>
                <option value="">— Select opportunity —</option>
                {opps.map(o => (
                  <option key={o.id} value={o.id}>{o.company_name} — {o.title}</option>
                ))}
              </select>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Direction */}
              {field('Direction',
                <select value={form.direction} onChange={e => set('direction', e.target.value)} style={selectStyle}>
                  {DIRECTIONS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                </select>
              )}

              {/* Duration */}
              {field('Duration (min)',
                <input type="number" min="1" value={form.duration_min} onChange={e => set('duration_min', e.target.value)}
                  placeholder="e.g. 30" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#F26B4E'}
                  onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
              )}
            </div>

            {/* Summary */}
            {field('Summary *',
              <textarea value={form.summary} onChange={e => set('summary', e.target.value)} rows={3}
                placeholder="What was discussed / outcome of the call…"
                style={{ ...inputStyle, resize: 'vertical' }}
                onFocus={e => e.target.style.borderColor = '#F26B4E'}
                onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
            )}

            {/* Outcome */}
            {field('Outcome',
              <select value={form.outcome} onChange={e => set('outcome', e.target.value)} style={selectStyle}>
                <option value="">— Select outcome —</option>
                {OUTCOMES.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
              </select>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Next action */}
              {field('Next Action',
                <input type="text" value={form.next_action} onChange={e => set('next_action', e.target.value)}
                  placeholder="e.g. Send revised proposal"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#F26B4E'}
                  onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
              )}

              {/* Next action date */}
              {field('Next Action Date',
                <input type="date" value={form.next_action_date} onChange={e => set('next_action_date', e.target.value)}
                  min={today}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#F26B4E'}
                  onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
              )}
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 14, background: '#fff5f3', border: '1px solid #F26B4E', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: '#c0392b' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" onClick={onClose}
              style={{ padding: '9px 18px', borderRadius: 7, border: '1.5px solid #ddd', background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: '9px 20px', borderRadius: 7, border: 'none', background: saving ? '#f0a899' : '#F26B4E', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Logging…' : 'Log Activity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
