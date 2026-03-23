import { useState, useCallback } from 'react';
import { useApiMulti } from '../hooks/useApi.js';
import { bdApi } from '../lib/api.js';
import { inr, date, daysSince } from '../lib/fmt.js';
import { Spinner, ErrorBanner, Empty } from '../components/Spinner.jsx';
import {
  Search, Plus, LayoutGrid, List, AlertTriangle,
  X, ChevronRight, Calendar
} from 'lucide-react';
import AddToCalendar from '../components/AddToCalendar.jsx';

// ── Constants ────────────────────────────────────────────────────────────────
const STAGES = [
  { key: 'first_connect',          label: 'First Connect',         color: '#94a3b8', bg: '#f1f5f9' },
  { key: 'requirement_captured',   label: 'Req. Captured',         color: '#3b82f6', bg: '#eff6ff' },
  { key: 'proposal_sent',          label: 'Proposal Sent',         color: '#8b5cf6', bg: '#f5f3ff' },
  { key: 'technical_closure',      label: 'Tech. Closure',         color: '#f59e0b', bg: '#fffbeb' },
  { key: 'commercial_negotiation', label: 'Commercial Neg.',       color: '#F26B4E', bg: '#fff5f3' },
  { key: 'po_received',            label: 'PO Received',           color: '#10b981', bg: '#f0fdf4' },
  { key: 'lost',                   label: 'Lost',                  color: '#ef4444', bg: '#fef2f2' },
];

const SCOPE_TYPES = [
  'supply_only', 'dc_block_pcs', 'rms_order', 'supply_install', 'tpc'
];

const SCOPE_LABELS = {
  supply_only:    'Supply Only',
  dc_block_pcs:   'DC Block + PCS',
  rms_order:      'RMS Order',
  supply_install: 'Supply & Install',
  tpc:            'TPC',
};

function stageConfig(key) {
  return STAGES.find(s => s.key === key) ?? { color: '#aaa', bg: '#f5f5f5', label: key };
}

// ── Kanban card ──────────────────────────────────────────────────────────────
function OppCard({ opp, onStageChange }) {
  const sc = stageConfig(opp.stage);
  const daysSilent = opp.last_activity_at ? daysSince(opp.last_activity_at) : null;
  const nextStage  = STAGES[STAGES.findIndex(s => s.key === opp.stage) + 1];

  return (
    <div style={{
      background: '#fff', borderRadius: 8, padding: '12px 14px',
      border: `1px solid ${opp.stale ? '#fecaca' : '#eee'}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      borderLeft: `3px solid ${sc.color}`,
      marginBottom: 8,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#2D2D2D', marginBottom: 2, lineHeight: 1.3 }}>
        {opp.company_name}
        {opp.stale && <AlertTriangle size={10} color="#ef4444" style={{ marginLeft: 5, verticalAlign: 'middle' }} />}
      </div>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>{opp.title}</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#F26B4E' }}>
          {opp.estimated_value ? inr(opp.estimated_value) : '—'}
        </span>
        {opp.scope_type && (
          <span style={{
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.4px', color: '#aaa', background: '#f5f5f5',
            padding: '2px 6px', borderRadius: 4,
          }}>
            {SCOPE_LABELS[opp.scope_type] ?? opp.scope_type}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 10, color: daysSilent > 7 ? '#ef4444' : '#aaa' }}>
          {daysSilent != null ? `${daysSilent}d silent` : 'No activity'}
        </div>
        {opp.next_action_date && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ fontSize: 10, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Calendar size={9} />
              {date(opp.next_action_date)}
            </div>
            <AddToCalendar
              title={`Follow-up: ${opp.company_name} — ${opp.title}`}
              dateStr={opp.next_action_date}
              description={[
                opp.next_action ? `Action: ${opp.next_action}` : '',
                `Stage: ${opp.stage?.replace(/_/g, ' ')}`,
                opp.owner_name ? `Owner: ${opp.owner_name}` : '',
              ].filter(Boolean).join('\n')}
              size="sm"
              label="+"
            />
          </div>
        )}
      </div>

      {nextStage && opp.stage !== 'lost' && (
        <button
          onClick={() => onStageChange(opp.id, nextStage.key)}
          style={{
            marginTop: 8, width: '100%', padding: '5px', borderRadius: 5,
            border: `1px dashed ${nextStage.color}`, background: 'transparent',
            color: nextStage.color, fontSize: 10, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}
        >
          Move to {nextStage.label} <ChevronRight size={9} />
        </button>
      )}
    </div>
  );
}

// ── Add Opportunity Modal ────────────────────────────────────────────────────
function AddOppModal({ accounts, contacts, users, onClose, onSaved, product = 'bess' }) {
  const [form, setForm] = useState({
    account_id: '', contact_id: '', owner_id: '',
    title: '', scope_type: '', estimated_value: '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  const accountContacts = contacts.filter(c => String(c.account_id) === form.account_id);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim())    { setError('Title is required'); return; }
    if (!form.account_id)      { setError('Account is required'); return; }
    setSaving(true);
    try {
      await bdApi.createOpp({
        ...form,
        account_id:      parseInt(form.account_id),
        contact_id:      form.contact_id ? parseInt(form.contact_id) : null,
        owner_id:        form.owner_id   ? parseInt(form.owner_id)   : null,
        estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
        product_type:    product,
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
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: '28px 32px',
        width: 520, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Add Opportunity</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Title */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>Opportunity Title *</label>
              <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
                placeholder="e.g. SunSure 500kWh C&I BESS"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#F26B4E'}
                onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
            </div>

            {/* Account */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>Account *</label>
              <select value={form.account_id} onChange={e => { set('account_id', e.target.value); set('contact_id', ''); }}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                <option value="">— Select account —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.company_name}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Contact */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>Contact</label>
                <select value={form.contact_id} onChange={e => set('contact_id', e.target.value)}
                  disabled={!form.account_id}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff', opacity: form.account_id ? 1 : 0.5 }}>
                  <option value="">— Select contact —</option>
                  {accountContacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Owner */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>BD Owner</label>
                <select value={form.owner_id} onChange={e => set('owner_id', e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                  <option value="">— Unassigned —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>

              {/* Scope */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>Scope Type</label>
                <select value={form.scope_type} onChange={e => set('scope_type', e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                  <option value="">— Select —</option>
                  {SCOPE_TYPES.map(s => <option key={s} value={s}>{SCOPE_LABELS[s]}</option>)}
                </select>
              </div>

              {/* Value */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>Estimated Value (₹)</label>
                <input type="number" value={form.estimated_value} onChange={e => set('estimated_value', e.target.value)}
                  placeholder="e.g. 1500000"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#F26B4E'}
                  onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
              </div>
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 14, background: '#fff5f3', border: '1px solid #F26B4E', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: '#c0392b' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 7, border: '1.5px solid #ddd', background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ padding: '9px 20px', borderRadius: 7, border: 'none', background: saving ? '#f0a899' : '#F26B4E', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Saving…' : 'Create Opportunity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function BDOpportunities({ product = 'bess' }) {
  const [view,    setView]    = useState('kanban'); // 'kanban' | 'table'
  const [search,  setSearch]  = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [stageFilter, setStageFilter] = useState('');

  const { opps: oppsRes, accounts: accountsRes, contacts: contactsRes, users: usersRes, loading, error, refetch } = useApiMulti({
    opps:     () => bdApi.opps({ product_type: product }),
    accounts: () => bdApi.accounts({ product_type: product }),
    contacts: bdApi.contacts,
    users:    bdApi.users,
  }, [product]);

  const handleStageChange = useCallback(async (oppId, newStage) => {
    try {
      await bdApi.patchOpp(oppId, { stage: newStage });
      refetch();
    } catch (e) {
      console.error('Stage update failed:', e.message);
    }
  }, [refetch]);

  if (loading) return <Spinner />;
  if (error)   return <ErrorBanner message={error} />;

  const opps     = oppsRes?.data     ?? [];
  const accounts = accountsRes?.data ?? [];
  const contacts = contactsRes?.data ?? [];
  const users    = usersRes?.data    ?? [];

  const openOpps  = opps.filter(o => !o.closed_at && o.stage !== 'lost');
  const totalVal  = openOpps.reduce((s, o) => s + parseFloat(o.estimated_value || 0), 0);
  const staleCount = openOpps.filter(o => o.stale).length;

  const filtered = opps.filter(o => {
    const matchSearch = !search ||
      o.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.title?.toLowerCase().includes(search.toLowerCase()) ||
      o.owner_name?.toLowerCase().includes(search.toLowerCase());
    const matchStage = !stageFilter || o.stage === stageFilter;
    return matchSearch && matchStage;
  });

  return (
    <div style={{ fontFamily: "'Chivo', sans-serif", color: '#2D2D2D' }}>
      {showAdd && (
        <AddOppModal
          accounts={accounts}
          contacts={contacts}
          users={users}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); refetch(); }}
          product={product}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Opportunities</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>
            {openOpps.length} open · {inr(totalVal)} pipeline
            {staleCount > 0 && <span style={{ color: '#ef4444', marginLeft: 10 }}>· {staleCount} stale</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1.5px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
            {[['kanban', LayoutGrid], ['table', List]].map(([v, Icon]) => (
              <button key={v} onClick={() => setView(v)}
                style={{
                  padding: '7px 12px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: view === v ? '#F26B4E' : '#fff',
                  color: view === v ? '#fff' : '#888',
                  display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
                }}>
                <Icon size={13} />
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAdd(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: '#F26B4E', color: '#fff', border: 'none',
              borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            <Plus size={15} /> Add Opportunity
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
          <input type="text" placeholder="Search company, title, owner…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#fff' }}
            onFocus={e => e.target.style.borderColor = '#F26B4E'}
            onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
        </div>
        <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
          <option value="">All Stages</option>
          {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Empty message={search || stageFilter ? 'No opportunities match the filter.' : 'No opportunities yet — add your first deal.'} />
      ) : view === 'kanban' ? (
        /* ── KANBAN VIEW ── */
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {STAGES.filter(s => s.key !== 'lost').map(s => {
            const colOpps = filtered.filter(o => o.stage === s.key);
            const colVal  = colOpps.reduce((sum, o) => sum + parseFloat(o.estimated_value || 0), 0);
            return (
              <div key={s.key} style={{ minWidth: 220, flex: '0 0 220px' }}>
                {/* Column header */}
                <div style={{
                  background: s.bg, border: `1px solid ${s.color}30`,
                  borderRadius: '8px 8px 0 0', padding: '8px 12px',
                  borderBottom: `2px solid ${s.color}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: s.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {s.label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, background: s.color, color: '#fff', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {colOpps.length}
                    </span>
                  </div>
                  {colVal > 0 && <div style={{ fontSize: 10, color: s.color, marginTop: 2, fontWeight: 600 }}>{inr(colVal)}</div>}
                </div>
                {/* Cards */}
                <div style={{ background: '#f8f9fa', borderRadius: '0 0 8px 8px', padding: '8px 8px', minHeight: 80, border: `1px solid ${s.color}20`, borderTop: 'none' }}>
                  {colOpps.length === 0
                    ? <div style={{ fontSize: 11, color: '#ccc', textAlign: 'center', padding: '12px 0' }}>Empty</div>
                    : colOpps.map(o => (
                        <OppCard key={o.id} opp={o} onStageChange={handleStageChange} />
                      ))
                  }
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── TABLE VIEW ── */
        <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '2px solid #f0f0f0' }}>
                {['Opportunity', 'Account', 'Scope', 'Value', 'Stage', 'Owner', 'Silent', 'Next Action'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => {
                const sc = stageConfig(o.stage);
                const daysSilent = o.last_activity_at ? daysSince(o.last_activity_at) : null;
                return (
                  <tr key={o.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f5f5f5' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                        {o.title}
                        {o.stale && <AlertTriangle size={11} color="#ef4444" />}
                      </div>
                      <div style={{ fontSize: 11, color: '#aaa' }}>{o.opp_id}</div>
                    </td>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: '#555' }}>{o.company_name}</td>
                    <td style={{ padding: '11px 14px', color: '#888', fontSize: 12 }}>
                      {SCOPE_LABELS[o.scope_type] ?? o.scope_type ?? '—'}
                    </td>
                    <td style={{ padding: '11px 14px', fontWeight: 700 }}>
                      {o.estimated_value ? inr(o.estimated_value) : <span style={{ color: '#ccc' }}>—</span>}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                        {sc.label}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', color: '#666' }}>{o.owner_name ?? '—'}</td>
                    <td style={{ padding: '11px 14px', color: daysSilent > 7 ? '#ef4444' : '#aaa', fontWeight: daysSilent > 7 ? 700 : 400 }}>
                      {daysSilent != null ? `${daysSilent}d` : '—'}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 12 }}>
                      {o.next_action_date ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: '#60a5fa', fontWeight: 600 }}>{date(o.next_action_date)}</span>
                          <AddToCalendar
                            title={`Follow-up: ${o.company_name} — ${o.title}`}
                            dateStr={o.next_action_date}
                            description={[
                              o.next_action ? `Action: ${o.next_action}` : '',
                              `Stage: ${o.stage?.replace(/_/g, ' ')}`,
                              o.owner_name ? `Owner: ${o.owner_name}` : '',
                            ].filter(Boolean).join('\n')}
                            size="sm"
                          />
                        </div>
                      ) : <span style={{ color: '#ccc' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
