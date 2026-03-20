import { useState } from 'react';
import { useApiMulti } from '../hooks/useApi.js';
import { bdApi } from '../lib/api.js';
import { Spinner, ErrorBanner, Empty } from '../components/Spinner.jsx';
import { Search, Plus, User, Mail, Phone, Star, X } from 'lucide-react';

// ── Add Contact Modal ────────────────────────────────────────────────────────
function AddContactModal({ accounts, onClose, onSaved }) {
  const [form, setForm] = useState({
    account_id: '', name: '', designation: '',
    email: '', phone: '', linkedin: '', notes: '', is_primary: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim())       { setError('Name is required'); return; }
    if (!form.account_id)        { setError('Account is required'); return; }
    setSaving(true);
    try {
      await bdApi.createContact({ ...form, account_id: parseInt(form.account_id) });
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
        width: 500, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Add Contact</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Account */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>Account *</label>
              <select value={form.account_id} onChange={e => set('account_id', e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                <option value="">— Select account —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.company_name}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                ['name',        'Full Name *',   'text'],
                ['designation', 'Designation',   'text'],
                ['email',       'Email',         'email'],
                ['phone',       'Phone',         'tel'],
                ['linkedin',    'LinkedIn URL',  'url'],
              ].map(([key, label, type]) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>{label}</label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={e => set(key, e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 7,
                      border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                    onFocus={e => e.target.style.borderColor = '#F26B4E'}
                    onBlur={e => e.target.style.borderColor = '#e0e0e0'}
                  />
                </div>
              ))}

              {/* Notes full width */}
              <div style={{ gridColumn: '1 / 3' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  rows={2}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 7,
                    border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit',
                    outline: 'none', boxSizing: 'border-box', resize: 'vertical',
                  }}
                  onFocus={e => e.target.style.borderColor = '#F26B4E'}
                  onBlur={e => e.target.style.borderColor = '#e0e0e0'}
                />
              </div>
            </div>

            {/* Primary toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={form.is_primary}
                onChange={e => set('is_primary', e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#F26B4E' }}
              />
              <span style={{ fontWeight: 600, color: '#555' }}>Mark as primary contact for this account</span>
            </label>
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
              {saving ? 'Saving…' : 'Save Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function BDContacts() {
  const [search,   setSearch]   = useState('');
  const [showAdd,  setShowAdd]  = useState(false);
  const [filterAcc, setFilterAcc] = useState('');

  const { contacts: contactsRes, accounts: accountsRes, loading, error, refetch } = useApiMulti({
    contacts: bdApi.contacts,
    accounts: bdApi.accounts,
  });

  if (loading) return <Spinner />;
  if (error)   return <ErrorBanner message={error} />;

  const contacts = contactsRes?.data ?? [];
  const accounts = accountsRes?.data ?? [];

  const filtered = contacts.filter(c => {
    const matchSearch = !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.designation?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.company_name?.toLowerCase().includes(search.toLowerCase());
    const matchAcc = !filterAcc || String(c.account_id) === filterAcc;
    return matchSearch && matchAcc;
  });

  return (
    <div style={{ fontFamily: "'Chivo', sans-serif", color: '#2D2D2D' }}>
      {showAdd && (
        <AddContactModal
          accounts={accounts}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); refetch(); }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Contacts</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>
            {contacts.length} contacts across {accounts.length} accounts
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: '#F26B4E', color: '#fff', border: 'none',
            borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <Plus size={15} /> Add Contact
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
          <input
            type="text"
            placeholder="Search name, email, designation…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px 9px 34px', borderRadius: 8,
              border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit',
              outline: 'none', boxSizing: 'border-box', background: '#fff',
            }}
            onFocus={e => e.target.style.borderColor = '#F26B4E'}
            onBlur={e => e.target.style.borderColor = '#e0e0e0'}
          />
        </div>
        <select
          value={filterAcc}
          onChange={e => setFilterAcc(e.target.value)}
          style={{
            padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e0e0e0',
            fontSize: 13, fontFamily: 'inherit', background: '#fff', minWidth: 200,
          }}
        >
          <option value="">All Accounts</option>
          {accounts.map(a => <option key={a.id} value={String(a.id)}>{a.company_name}</option>)}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0
        ? <Empty message={search || filterAcc ? 'No contacts match the filter.' : 'No contacts yet — add your first contact.'} />
        : (
          <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '2px solid #f0f0f0' }}>
                  {['Name', 'Account', 'Designation', 'Email', 'Phone', ''].map((h, i) => (
                    <th key={i} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f5f5f5' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: '#F26B4E18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          fontSize: 11, fontWeight: 700, color: '#F26B4E',
                        }}>
                          {c.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                            {c.name}
                            {c.is_primary && (
                              <Star size={11} fill="#F26B4E" color="#F26B4E" title="Primary contact" />
                            )}
                          </div>
                          {c.notes && <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>{c.notes}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#555', fontWeight: 600 }}>
                      {c.company_name || '—'}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#666' }}>
                      {c.designation || '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {c.email
                        ? <a href={`mailto:${c.email}`} style={{ color: '#F26B4E', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Mail size={12} /> {c.email}
                          </a>
                        : <span style={{ color: '#ccc' }}>—</span>
                      }
                    </td>
                    <td style={{ padding: '12px 14px', color: '#666' }}>
                      {c.phone
                        ? <a href={`tel:${c.phone}`} style={{ color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Phone size={12} /> {c.phone}
                          </a>
                        : <span style={{ color: '#ccc' }}>—</span>
                      }
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      {c.linkedin && (
                        <a href={c.linkedin} target="_blank" rel="noreferrer"
                          style={{ fontSize: 11, color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}>
                          LinkedIn ↗
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  );
}
