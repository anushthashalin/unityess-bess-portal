import { useState, useCallback } from 'react';
import { useApiMulti } from '../hooks/useApi.js';
import { bdApi } from '../lib/api.js';
import { date } from '../lib/fmt.js';
import { Spinner, ErrorBanner, Empty } from '../components/Spinner.jsx';
import QuickLogModal from '../components/QuickLogModal.jsx';
import AddToCalendar from '../components/AddToCalendar.jsx';
import { CheckCircle, Clock, AlarmClock, Plus, X, PhoneCall, Mail, MessageSquare, Users, MapPin, Monitor } from 'lucide-react';

const TYPE_CONFIG = {
  call:       { label: 'Call',       icon: PhoneCall,    color: '#3b82f6' },
  email:      { label: 'Email',      icon: Mail,         color: '#8b5cf6' },
  whatsapp:   { label: 'WhatsApp',   icon: MessageSquare,color: '#22c55e' },
  meeting:    { label: 'Meeting',    icon: Users,        color: '#10b981' },
  site_visit: { label: 'Site Visit', icon: MapPin,       color: '#f59e0b' },
  demo:       { label: 'Demo',       icon: Monitor,      color: '#F26B4E' },
};

const STAGE_LABELS = {
  first_connect:          'First Connect',
  requirement_captured:   'Req. Captured',
  proposal_sent:          'Proposal Sent',
  technical_closure:      'Tech. Closure',
  commercial_negotiation: 'Commercial',
  po_received:            'PO Received',
};

const STAGE_COLORS = {
  first_connect:          '#94a3b8',
  requirement_captured:   '#3b82f6',
  proposal_sent:          '#8b5cf6',
  technical_closure:      '#f59e0b',
  commercial_negotiation: '#F26B4E',
  po_received:            '#10b981',
};

// ── Add Follow-up Modal ──────────────────────────────────────────────────────
function AddFollowUpModal({ opps, users, onClose, onSaved }) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [form, setForm] = useState({ opp_id: '', due_date: tomorrow, type: 'call', assigned_to: '' });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.opp_id)   { setError('Select an opportunity'); return; }
    if (!form.due_date) { setError('Due date is required'); return; }
    setSaving(true);
    try {
      await bdApi.createFollowUp({
        opp_id:      parseInt(form.opp_id),
        due_date:    form.due_date,
        type:        form.type,
        assigned_to: form.assigned_to ? parseInt(form.assigned_to) : null,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '26px 30px', width: 460, boxShadow: '0 8px 40px rgba(0,0,0,0.15)', fontFamily: "'Chivo', sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Add Follow-up</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>Opportunity *</label>
              <select value={form.opp_id} onChange={e => set('opp_id', e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                <option value="">— Select opportunity —</option>
                {opps.map(o => <option key={o.id} value={o.id}>{o.company_name} — {o.title}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>Due Date *</label>
                <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#F26B4E'}
                  onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>Type</label>
                <select value={form.type} onChange={e => set('type', e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>Assign To</label>
              <select value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          {error && <div style={{ marginTop: 12, background: '#fff5f3', border: '1px solid #F26B4E', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: '#c0392b' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 7, border: '1.5px solid #ddd', background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '9px 18px', borderRadius: 7, border: 'none', background: saving ? '#f0a899' : '#F26B4E', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Saving…' : 'Add Follow-up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Follow-up card ───────────────────────────────────────────────────────────
function FollowUpCard({ f, onDone, onSnooze, onLog }) {
  const tc = TYPE_CONFIG[f.type] ?? { label: f.type, icon: Clock, color: '#aaa' };
  const Icon = tc.icon;
  const overdue = f.days_overdue > 0;
  const dueToday = f.days_overdue === 0;

  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '14px 16px',
      border: `1px solid ${overdue ? '#fecaca' : dueToday ? '#fde68a' : '#e8f4ff'}`,
      borderLeft: `4px solid ${overdue ? '#ef4444' : dueToday ? '#f59e0b' : '#3b82f6'}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      display: 'flex', gap: 14, alignItems: 'flex-start',
    }}>
      {/* Type icon */}
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: tc.color + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={15} color={tc.color} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{f.company_name}</span>
            <span style={{ color: '#aaa', fontSize: 11, marginLeft: 8 }}>{tc.label}</span>
            {f.follow_up_number > 1 && (
              <span style={{ marginLeft: 6, fontSize: 10, color: '#aaa' }}>#{f.follow_up_number}</span>
            )}
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700, flexShrink: 0, marginLeft: 12,
            color: overdue ? '#ef4444' : dueToday ? '#f59e0b' : '#3b82f6',
          }}>
            {overdue ? `${f.days_overdue}d overdue` : dueToday ? 'Due today' : date(f.due_date)}
          </div>
        </div>

        <div style={{ fontSize: 11, color: '#888', marginTop: 2, marginBottom: 8 }}>
          {f.opp_title}
          {f.stage && (
            <span style={{
              marginLeft: 8, fontSize: 10, fontWeight: 700,
              color: STAGE_COLORS[f.stage] ?? '#aaa',
            }}>
              {STAGE_LABELS[f.stage] ?? f.stage}
            </span>
          )}
          {f.assigned_to_name && <span style={{ color: '#bbb', marginLeft: 8 }}>→ {f.assigned_to_name}</span>}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => onLog(f)}
            style={{
              padding: '5px 12px', borderRadius: 6, border: '1.5px solid #F26B4E',
              background: '#fff', color: '#F26B4E', fontSize: 11, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            Log Activity
          </button>
          <button onClick={() => onDone(f.id)}
            style={{
              padding: '5px 12px', borderRadius: 6, border: '1.5px solid #10b981',
              background: '#fff', color: '#10b981', fontSize: 11, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
            <CheckCircle size={11} /> Mark Done
          </button>
          <button onClick={() => onSnooze(f.id)}
            style={{
              padding: '5px 12px', borderRadius: 6, border: '1.5px solid #e0e0e0',
              background: '#fff', color: '#888', fontSize: 11,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
            <AlarmClock size={11} /> Snooze 2d
          </button>
          <AddToCalendar
            title={`${tc.label}: ${f.company_name} — ${f.opp_title}`}
            dateStr={f.due_date}
            description={[
              `Follow-up type: ${tc.label}`,
              f.opp_title ? `Opportunity: ${f.opp_title}` : '',
              f.assigned_to_name ? `Assigned to: ${f.assigned_to_name}` : '',
            ].filter(Boolean).join('\n')}
          />
        </div>
      </div>
    </div>
  );
}

// ── Section ──────────────────────────────────────────────────────────────────
function Section({ title, color, items, onDone, onSnooze, onLog, emptyMsg }) {
  if (items.length === 0 && !emptyMsg) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{title}</span>
        <span style={{ background: color + '18', color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{items.length}</span>
        <div style={{ flex: 1, height: 1, background: '#f0f0f0' }} />
      </div>
      {items.length === 0
        ? <div style={{ fontSize: 13, color: '#ccc', padding: '10px 0' }}>{emptyMsg}</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(f => <FollowUpCard key={f.id} f={f} onDone={onDone} onSnooze={onSnooze} onLog={onLog} />)}
          </div>
      }
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function BDFollowUps({ product = 'bess' }) {
  const [showAdd, setShowAdd]       = useState(false);
  const [logOpp,  setLogOpp]        = useState(null); // opp object for QuickLogModal
  const [showDone, setShowDone]     = useState(false);

  const { followUps: fuRes, done: doneRes, opps: oppsRes, users: usersRes, loading, error, refetch } = useApiMulti({
    followUps: () => bdApi.followUps({ product_type: product }),
    done:      () => bdApi.followUps({ status: 'done', product_type: product }),
    opps:      () => bdApi.opps({ product_type: product }),
    users:     bdApi.users,
  }, [product]);

  const handleDone = useCallback(async (id) => {
    await bdApi.patchFollowUp(id, { status: 'done' });
    refetch();
  }, [refetch]);

  const handleSnooze = useCallback(async (id) => {
    const snoozeDate = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    await bdApi.patchFollowUp(id, { snooze_until: snoozeDate });
    refetch();
  }, [refetch]);

  if (loading) return <Spinner />;
  if (error)   return <ErrorBanner message={error} />;

  const pending  = fuRes?.data    ?? [];
  const done     = doneRes?.data  ?? [];
  const opps     = oppsRes?.data  ?? [];
  const users    = usersRes?.data ?? [];

  const today    = new Date().toISOString().slice(0, 10);
  const in7      = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const overdue  = pending.filter(f => f.due_date < today);
  const dueToday = pending.filter(f => f.due_date === today);
  const upcoming = pending.filter(f => f.due_date > today && f.due_date <= in7);
  const later    = pending.filter(f => f.due_date > in7);

  const openOpps = opps.filter(o => !o.closed_at && o.stage !== 'lost');

  return (
    <div style={{ fontFamily: "'Chivo', sans-serif", color: '#2D2D2D' }}>
      {showAdd && (
        <AddFollowUpModal
          opps={openOpps}
          users={users}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); refetch(); }}
        />
      )}

      {logOpp && (
        <QuickLogModal
          opps={openOpps}
          defaultOppId={logOpp.opp_id}
          onClose={() => setLogOpp(null)}
          onSaved={() => { setLogOpp(null); refetch(); }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Follow-up Queue</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>
            {overdue.length > 0 && <span style={{ color: '#ef4444', fontWeight: 700 }}>{overdue.length} overdue · </span>}
            {dueToday.length} due today · {upcoming.length} this week · {later.length} later
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: '#F26B4E', color: '#fff', border: 'none',
          borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <Plus size={15} /> Add Follow-up
        </button>
      </div>

      {pending.length === 0 && done.length === 0 ? (
        <Empty message="No follow-ups yet. Add one or log an activity with a next action date." />
      ) : (
        <>
          <Section title="Overdue"     color="#ef4444" items={overdue}  onDone={handleDone} onSnooze={handleSnooze} onLog={f => setLogOpp(f)} />
          <Section title="Due Today"   color="#f59e0b" items={dueToday} onDone={handleDone} onSnooze={handleSnooze} onLog={f => setLogOpp(f)} emptyMsg="Nothing due today." />
          <Section title="This Week"   color="#3b82f6" items={upcoming} onDone={handleDone} onSnooze={handleSnooze} onLog={f => setLogOpp(f)} />
          <Section title="Later"       color="#94a3b8" items={later}    onDone={handleDone} onSnooze={handleSnooze} onLog={f => setLogOpp(f)} />

          {/* Completed toggle */}
          {done.length > 0 && (
            <div>
              <button onClick={() => setShowDone(v => !v)} style={{
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 12, fontWeight: 700, color: '#aaa', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0',
              }}>
                <CheckCircle size={14} />
                {showDone ? 'Hide' : 'Show'} completed ({done.length})
              </button>
              {showDone && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, opacity: 0.6 }}>
                  {done.slice(0, 20).map(f => (
                    <div key={f.id} style={{
                      background: '#fafafa', borderRadius: 8, padding: '10px 14px',
                      border: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#888' }}>{f.company_name}</span>
                        <span style={{ fontSize: 11, color: '#bbb', marginLeft: 8 }}>{f.opp_title}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#bbb' }}>
                        <CheckCircle size={12} color="#10b981" />
                        {date(f.due_date)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
