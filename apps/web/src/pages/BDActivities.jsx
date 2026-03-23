import { useState } from 'react';
import { useApiMulti } from '../hooks/useApi.js';
import { bdApi } from '../lib/api.js';
import { date } from '../lib/fmt.js';
import { Spinner, ErrorBanner, Empty } from '../components/Spinner.jsx';
import QuickLogModal from '../components/QuickLogModal.jsx';
import { Plus, Search, Filter } from 'lucide-react';

const ACTIVITY_TYPES = [
  { key: 'call',       label: 'Call',       emoji: '📞', color: '#3b82f6' },
  { key: 'email',      label: 'Email',      emoji: '✉️', color: '#8b5cf6' },
  { key: 'meeting',    label: 'Meeting',    emoji: '🤝', color: '#10b981' },
  { key: 'whatsapp',   label: 'WhatsApp',   emoji: '💬', color: '#22c55e' },
  { key: 'site_visit', label: 'Site Visit', emoji: '📍', color: '#f59e0b' },
  { key: 'demo',       label: 'Demo',       emoji: '🖥️', color: '#F26B4E' },
];

const OUTCOME_LABELS = {
  interested:            'Interested',
  not_interested:        'Not Interested',
  follow_up:             'Follow-up Needed',
  proposal_requested:    'Proposal Requested',
  technical_discussion:  'Technical Discussion',
  pricing_discussion:    'Pricing Discussion',
  no_answer:             'No Answer',
  other:                 'Other',
};

const OUTCOME_COLORS = {
  interested:           '#10b981',
  proposal_requested:   '#3b82f6',
  technical_discussion: '#8b5cf6',
  pricing_discussion:   '#F26B4E',
  follow_up:            '#f59e0b',
  not_interested:       '#ef4444',
  no_answer:            '#94a3b8',
  other:                '#94a3b8',
};

function typeConfig(key) {
  return ACTIVITY_TYPES.find(t => t.key === key) ?? { emoji: '📋', color: '#aaa', label: key };
}

// Group activities by date label
function groupByDate(activities) {
  const groups = {};
  const today     = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  activities.forEach(a => {
    const d   = new Date(a.logged_at);
    const key = d.toDateString();
    let label;
    if (key === today)           label = 'Today';
    else if (key === yesterday)  label = 'Yesterday';
    else                         label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    if (!groups[label]) groups[label] = [];
    groups[label].push(a);
  });

  return Object.entries(groups);
}

export default function BDActivities({ product = 'bess' }) {
  const [showLog,     setShowLog]     = useState(false);
  const [search,      setSearch]      = useState('');
  const [typeFilter,  setTypeFilter]  = useState('');

  const { activities: activitiesRes, opps: oppsRes, loading, error, refetch } = useApiMulti({
    activities: bdApi.activities,
    opps:       () => bdApi.opps({ product_type: product }),
  }, [product]);

  if (loading) return <Spinner />;
  if (error)   return <ErrorBanner message={error} />;

  const activities = activitiesRes?.data ?? [];
  const opps       = oppsRes?.data       ?? [];

  const filtered = activities.filter(a => {
    const matchSearch = !search ||
      a.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.opp_title?.toLowerCase().includes(search.toLowerCase()) ||
      a.summary?.toLowerCase().includes(search.toLowerCase()) ||
      a.logged_by_name?.toLowerCase().includes(search.toLowerCase());
    const matchType = !typeFilter || a.type === typeFilter;
    return matchSearch && matchType;
  });

  const grouped = groupByDate(filtered);

  // Stats
  const todayCount = activities.filter(a => new Date(a.logged_at).toDateString() === new Date().toDateString()).length;
  const weekCount  = activities.filter(a => (Date.now() - new Date(a.logged_at)) < 7 * 86400000).length;

  return (
    <div style={{ fontFamily: "'Chivo', sans-serif", color: 'hsl(var(--foreground))' }}>
      {showLog && (
        <QuickLogModal
          opps={opps.filter(o => !o.closed_at && o.stage !== 'lost')}
          onClose={() => setShowLog(false)}
          onSaved={() => { setShowLog(false); refetch(); }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Activity Log</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>
            {todayCount} today · {weekCount} this week · {activities.length} total
          </p>
        </div>
        <button
          onClick={() => setShowLog(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: '#F26B4E', color: '#fff', border: 'none',
            borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
          <Plus size={15} /> Log Activity
        </button>
      </div>

      {/* Activity type summary chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          onClick={() => setTypeFilter('')}
          style={{
            padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
            border: !typeFilter ? '2px solid #F26B4E' : '1.5px solid #e0e0e0',
            background: !typeFilter ? '#fff5f3' : '#fff',
            color: !typeFilter ? '#F26B4E' : '#666',
            fontSize: 12, fontWeight: !typeFilter ? 700 : 400,
          }}>
          All ({activities.length})
        </button>
        {ACTIVITY_TYPES.map(t => {
          const count = activities.filter(a => a.type === t.key).length;
          if (count === 0) return null;
          return (
            <button key={t.key}
              onClick={() => setTypeFilter(typeFilter === t.key ? '' : t.key)}
              style={{
                padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                border: typeFilter === t.key ? `2px solid ${t.color}` : '1.5px solid #e0e0e0',
                background: typeFilter === t.key ? t.color + '18' : '#fff',
                color: typeFilter === t.key ? t.color : '#666',
                fontSize: 12, fontWeight: typeFilter === t.key ? 700 : 400,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
              {t.emoji} {t.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 360 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
        <input type="text" placeholder="Search company, opportunity, summary…" value={search} onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '9px 12px 9px 34px', borderRadius: 8,
            border: '1.5px solid hsl(var(--border))', fontSize: 13, fontFamily: 'inherit',
            outline: 'none', boxSizing: 'border-box', background: 'hsl(var(--card))',
          }}
          onFocus={e => e.target.style.borderColor = '#F26B4E'}
          onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
      </div>

      {/* Activity feed */}
      {filtered.length === 0 ? (
        <Empty message={search || typeFilter ? 'No activities match the filter.' : 'No activities logged yet — log your first touchpoint.'} />
      ) : (
        <div>
          {grouped.map(([dateLabel, dayActivities]) => (
            <div key={dateLabel} style={{ marginBottom: 24 }}>
              {/* Date divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap' }}>
                  {dateLabel}
                </span>
                <div style={{ flex: 1, height: 1, background: '#f0f0f0' }} />
                <span style={{ fontSize: 11, color: '#ccc', whiteSpace: 'nowrap' }}>{dayActivities.length}</span>
              </div>

              {/* Activity cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {dayActivities.map(a => {
                  const tc = typeConfig(a.type);
                  const outcomeColor = OUTCOME_COLORS[a.outcome] ?? '#aaa';
                  return (
                    <div key={a.id} style={{
                      background: 'hsl(var(--card))', borderRadius: 10, padding: '14px 16px',
                      border: '1px solid #f0f0f0', borderLeft: `4px solid ${tc.color}`,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      display: 'flex', gap: 14, alignItems: 'flex-start',
                    }}>
                      {/* Icon */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: tc.color + '18',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16,
                      }}>
                        {tc.emoji}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: 13, color: 'hsl(var(--foreground))' }}>{a.company_name}</span>
                            <span style={{ color: '#aaa', fontSize: 12, marginLeft: 8 }}>via {tc.label}</span>
                            {a.direction === 'inbound' && (
                              <span style={{ marginLeft: 6, fontSize: 10, background: '#f0fdf4', color: '#10b981', fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>
                                INBOUND
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: '#bbb', flexShrink: 0, marginLeft: 12 }}>
                            {new Date(a.logged_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            {a.duration_min && <span style={{ marginLeft: 6 }}>· {a.duration_min}m</span>}
                          </div>
                        </div>

                        <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginBottom: 6, lineHeight: 1.5 }}>
                          <span style={{ color: '#aaa', fontSize: 11 }}>{a.opp_title}</span>
                        </div>

                        {a.summary && (
                          <div style={{ fontSize: 13, color: '#444', lineHeight: 1.5, marginBottom: a.outcome || a.next_action ? 8 : 0 }}>
                            {a.summary}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          {a.outcome && (
                            <span style={{
                              fontSize: 11, fontWeight: 700,
                              background: outcomeColor + '18', color: outcomeColor,
                              padding: '2px 8px', borderRadius: 20,
                            }}>
                              {OUTCOME_LABELS[a.outcome] ?? a.outcome}
                            </span>
                          )}
                          {a.next_action && (
                            <span style={{ fontSize: 11, color: '#60a5fa' }}>
                              → {a.next_action}
                              {a.next_action_date && <span style={{ color: '#bbb' }}> ({date(a.next_action_date)})</span>}
                            </span>
                          )}
                          {a.logged_by_name && (
                            <span style={{ fontSize: 11, color: '#ccc', marginLeft: 'auto' }}>
                              {a.logged_by_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
