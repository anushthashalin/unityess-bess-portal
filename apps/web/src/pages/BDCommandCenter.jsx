import { useState, useCallback } from 'react';
import { useApi } from '../hooks/useApi.js';
import { bdApi } from '../lib/api.js';
import { inr, date, daysSince } from '../lib/fmt.js';
import { Spinner, ErrorBanner, Empty } from '../components/Spinner.jsx';
import AddToCalendar from '../components/AddToCalendar.jsx';
import {
  AlertCircle, Clock, CheckCircle, TrendingUp,
  Bell, ChevronRight, RefreshCw, Zap, Battery, ArrowRight,
} from 'lucide-react';
import { SplineScene } from '@/components/ui/spline-scene';
import { SpotlightSVG, Spotlight } from '@/components/ui/spotlight';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// ── Stage config ────────────────────────────────────────────────────────────
const STAGES = [
  { key: 'first_connect',          label: 'First Connect',         color: '#94a3b8' },
  { key: 'requirement_captured',   label: 'Requirement Captured',  color: '#60a5fa' },
  { key: 'proposal_sent',          label: 'Proposal Sent',         color: '#a78bfa' },
  { key: 'technical_closure',      label: 'Technical Closure',     color: '#f59e0b' },
  { key: 'commercial_negotiation', label: 'Commercial Negotiation',color: '#F26B4E' },
  { key: 'po_received',            label: 'PO Received',           color: '#10b981' },
];

const ACTIVITY_ICONS = {
  call:     '📞', email:    '✉️', meeting:  '🤝',
  site_visit: '📍', whatsapp: '💬', demo: '🖥️',
};

const APPROVAL_LABELS = {
  discount:         'Discount Request',
  payment_terms:    'Payment Terms Change',
  site_visit:       'Site Visit Approval',
  freight:          'Freight Waiver',
  validity_extension: 'Validity Extension',
};

// ── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = '#F26B4E', icon: Icon }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '18px 20px',
      borderLeft: `4px solid ${color}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      {Icon && (
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: color + '18', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} color={color} />
        </div>
      )}
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#2D2D2D', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: color, marginTop: 2, fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  );
}

function SectionHeader({ title, count, color = '#2D2D2D' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
        {title}
      </span>
      {count !== undefined && (
        <span style={{
          background: color + '18', color, fontSize: 11, fontWeight: 700,
          padding: '2px 8px', borderRadius: 20,
        }}>
          {count}
        </span>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function BDCommandCenter() {
  const { data, loading, error, refetch } = useApi(bdApi.dashboard);
  const { data: autoStatus, refetch: refetchAuto } = useApi(bdApi.automationStatus);
  const [runningAuto, setRunningAuto] = useState(false);
  const [autoLog, setAutoLog] = useState(null);

  const handleRunAutomation = useCallback(async () => {
    setRunningAuto(true);
    try {
      const result = await bdApi.runAutomation();
      setAutoLog(result.log);
      refetch();
      refetchAuto();
    } finally {
      setRunningAuto(false);
    }
  }, [refetch, refetchAuto]);

  if (loading) return <Spinner />;
  if (error)   return <ErrorBanner message={error} />;

  const d = data ?? {};
  const pipeline          = d.pipeline          ?? [];
  const hotDeals          = d.hot_deals         ?? [];
  const dueFollowUps      = d.due_follow_ups    ?? [];
  const pendingApprovals  = d.pending_approval_list ?? [];
  const recentActivities  = d.recent_activities ?? [];

  // Build stage map for funnel
  const stageMap = {};
  pipeline.forEach(r => { stageMap[r.stage] = r; });
  const totalPipelineValue = pipeline.reduce((s, r) => s + parseFloat(r.value || 0), 0);
  const totalOpenDeals     = pipeline.reduce((s, r) => s + (r.count || 0), 0);

  return (
    <div style={{ fontFamily: "'Chivo', sans-serif", color: '#2D2D2D' }}>

      {/* ── Hero banner with Spline 3D ── */}
      <div className="relative w-full h-[320px] rounded-2xl overflow-hidden bg-[#0d0d0d] mb-7 border border-white/10">

        {/* SVG spotlight sweep */}
        <SpotlightSVG className="-top-40 left-0 md:left-40 md:-top-20" fill="#F26B4E" />

        {/* Mouse-tracking glow */}
        <Spotlight className="z-10" size={320} />

        {/* Grid texture overlay */}
        <div
          className="absolute inset-0 z-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Left: text content */}
        <div className="absolute inset-0 z-20 flex flex-col justify-center pl-10 pr-4 max-w-lg">
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs font-bold px-3 py-1">
              UnityESS · BD Portal
            </Badge>
            <Badge variant="outline" className="border-white/20 text-white/50 text-xs">
              Live
            </Badge>
          </div>

          <h1 className="text-4xl font-black leading-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
            BD Command<br />Center
          </h1>

          <p className="mt-3 text-sm text-white/50 leading-relaxed max-w-sm">
            C&I BESS pipeline · {totalOpenDeals} open deals ·{' '}
            <span className="text-orange-400 font-semibold">{inr(totalPipelineValue)}</span> in play
          </p>

          <div className="flex items-center gap-3 mt-5">
            <div className="flex flex-col">
              <span className="text-2xl font-black text-white">{totalOpenDeals}</span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Open Deals</span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex flex-col">
              <span className="text-2xl font-black text-orange-400">{d.overdue_followups ?? 0}</span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Overdue</span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex flex-col">
              <span className="text-2xl font-black text-white">{d.pending_approvals ?? 0}</span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Approvals</span>
            </div>
          </div>
        </div>

        {/* Right: Spline 3D scene */}
        <div className="absolute right-0 top-0 h-full w-[55%] z-10">
          <SplineScene
            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
            className="w-full h-full"
          />
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 inset-x-0 h-16 z-30 bg-gradient-to-t from-[#0d0d0d] to-transparent" />
      </div>

      {/* ── KPI row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <KpiCard
          label="Open Deals"
          value={totalOpenDeals}
          sub={`${inr(totalPipelineValue)} pipeline`}
          color="#F26B4E"
          icon={TrendingUp}
        />
        <KpiCard
          label="Follow-ups Overdue"
          value={d.overdue_followups ?? 0}
          sub={d.overdue_followups > 0 ? 'Action required' : 'All clear'}
          color={d.overdue_followups > 0 ? '#ef4444' : '#10b981'}
          icon={Clock}
        />
        <KpiCard
          label="Pending Approvals"
          value={d.pending_approvals ?? 0}
          sub={d.pending_approvals > 0 ? 'Waiting on you' : 'Nothing pending'}
          color={d.pending_approvals > 0 ? '#f59e0b' : '#10b981'}
          icon={Bell}
        />
        <KpiCard
          label="Stale Deals"
          value={d.stale_deals ?? 0}
          sub={d.stale_deals > 0 ? 'No activity 60+ days' : 'Pipeline healthy'}
          color={d.stale_deals > 0 ? '#ef4444' : '#10b981'}
          icon={AlertCircle}
        />
      </div>

      {/* ── Pipeline funnel ── */}
      <div style={{
        background: '#fff', borderRadius: 10, padding: '20px 24px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 24,
      }}>
        <SectionHeader title="Pipeline by Stage" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
          {STAGES.map(s => {
            const row = stageMap[s.key];
            const count = row?.count ?? 0;
            const val   = parseFloat(row?.value ?? 0);
            return (
              <div key={s.key} style={{ textAlign: 'center' }}>
                <div style={{
                  background: s.color + '18', border: `2px solid ${s.color}`,
                  borderRadius: 10, padding: '14px 8px',
                }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{count}</div>
                  <div style={{ fontSize: 10, color: '#888', marginTop: 2, fontWeight: 600 }}>{inr(val)}</div>
                </div>
                <div style={{ fontSize: 10, color: '#666', marginTop: 6, fontWeight: 600, lineHeight: 1.3 }}>
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Automation status panel ── */}
      <div style={{
        background: '#fff', borderRadius: 10, padding: '16px 24px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 24,
        display: 'flex', alignItems: 'flex-start', gap: 20,
        borderLeft: '4px solid #a78bfa',
      }}>
        {/* Icon */}
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: '#a78bfa18', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Zap size={18} color="#a78bfa" />
        </div>

        {/* Body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#2D2D2D', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Automation Engine
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: autoStatus?.running ? '#fde68a' : '#d1fae5',
              color: autoStatus?.running ? '#92400e' : '#065f46',
            }}>
              {autoStatus?.running ? 'RUNNING' : 'IDLE'}
            </span>
          </div>

          <div style={{ fontSize: 12, color: '#888' }}>
            {autoStatus?.last_run
              ? <>Last run: <strong style={{ color: '#2D2D2D' }}>{new Date(autoStatus.last_run).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</strong></>
              : 'Not yet run this session'
            }
            {autoStatus?.next_run && (
              <span style={{ marginLeft: 12 }}>
                · Next: <strong style={{ color: '#2D2D2D' }}>{new Date(autoStatus.next_run).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</strong>
              </span>
            )}
          </div>

          {/* Log output */}
          {autoLog && autoLog.length > 0 && (
            <div style={{
              marginTop: 10, background: '#f8f8f8', borderRadius: 6,
              padding: '8px 12px', fontSize: 11, color: '#666',
              fontFamily: 'monospace', lineHeight: 1.7,
              maxHeight: 100, overflowY: 'auto',
            }}>
              {autoLog.map((line, i) => (
                <div key={i} style={{ color: line.includes('✓') ? '#10b981' : line.includes('⚠') ? '#f59e0b' : '#666' }}>
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Run Now button */}
        <button
          onClick={handleRunAutomation}
          disabled={runningAuto}
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            border: '1.5px solid #a78bfa', cursor: runningAuto ? 'not-allowed' : 'pointer',
            background: runningAuto ? '#f8f8f8' : '#a78bfa18',
            color: runningAuto ? '#aaa' : '#7c3aed',
            fontFamily: "'Chivo', sans-serif",
            transition: 'all 0.15s',
          }}
        >
          <RefreshCw size={13} style={{ animation: runningAuto ? 'spin 1s linear infinite' : 'none' }} />
          {runningAuto ? 'Running…' : 'Run Now'}
        </button>
      </div>

      {/* ── Two-column: Follow-ups + Hot Deals ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

        {/* Follow-ups due */}
        <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <SectionHeader title="Follow-ups Due" count={dueFollowUps.length} color="#ef4444" />
          {dueFollowUps.length === 0
            ? <Empty message="No overdue follow-ups" />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {dueFollowUps.map(f => {
                  const overdueDays = daysSince(f.due_date);
                  return (
                    <div key={f.id} style={{
                      borderRadius: 8, padding: '10px 14px',
                      background: overdueDays > 0 ? '#fff5f5' : '#f0fdf4',
                      border: `1px solid ${overdueDays > 0 ? '#fecaca' : '#bbf7d0'}`,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#2D2D2D' }}>{f.company_name}</div>
                        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{f.opp_title}</div>
                        {f.notes && <div style={{ fontSize: 11, color: '#666', marginTop: 3, fontStyle: 'italic' }}>"{f.notes}"</div>}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <div style={{
                          fontSize: 11, fontWeight: 700,
                          color: overdueDays > 0 ? '#ef4444' : '#10b981',
                        }}>
                          {overdueDays > 0 ? `${overdueDays}d overdue` : 'Due today'}
                        </div>
                        <div style={{ fontSize: 10, color: '#aaa', textTransform: 'capitalize' }}>
                          {f.follow_up_type?.replace('_', ' ')}
                        </div>
                        <AddToCalendar
                          title={`Follow-up: ${f.company_name} — ${f.opp_title}`}
                          dateStr={f.due_date}
                          description={f.notes ? `Notes: ${f.notes}` : ''}
                          size="sm"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>

        {/* Hot deals */}
        <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <SectionHeader title="Hot Deals" count={hotDeals.length} color="#F26B4E" />
          {hotDeals.length === 0
            ? <Empty message="No deals in negotiation or technical closure" />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {hotDeals.map(d => (
                  <div key={d.id} style={{
                    borderRadius: 8, padding: '10px 14px',
                    background: d.stale ? '#fff8f0' : '#fafafa',
                    border: `1px solid ${d.stale ? '#fed7aa' : '#eee'}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{d.company_name}</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{d.title}</div>
                      {d.contact_name && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>Contact: {d.contact_name}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#F26B4E' }}>{inr(d.estimated_value)}</div>
                      <div style={{
                        fontSize: 10, marginTop: 3, fontWeight: 600,
                        color: (d.days_silent ?? 0) > 7 ? '#ef4444' : '#888',
                      }}>
                        {d.days_silent != null ? `${d.days_silent}d silent` : '—'}
                      </div>
                      <div style={{
                        fontSize: 9, marginTop: 3, textTransform: 'uppercase',
                        letterSpacing: '0.4px', fontWeight: 700,
                        color: STAGES.find(s => s.key === d.stage)?.color ?? '#888',
                      }}>
                        {STAGES.find(s => s.key === d.stage)?.label ?? d.stage}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>

      {/* ── Two-column: Approvals + Recent Activity ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Pending approvals */}
        <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <SectionHeader title="Pending Approvals" count={pendingApprovals.length} color="#f59e0b" />
          {pendingApprovals.length === 0
            ? <Empty message="No approvals pending" />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pendingApprovals.map(a => (
                  <div key={a.id} style={{
                    borderRadius: 8, padding: '10px 14px',
                    background: '#fffbeb', border: '1px solid #fde68a',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{a.company_name}</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{APPROVAL_LABELS[a.approval_type] ?? a.approval_type}</div>
                      {a.notes && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>"{a.notes}"</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                      <div style={{
                        background: '#f59e0b', color: '#fff',
                        fontSize: 10, fontWeight: 700,
                        padding: '3px 8px', borderRadius: 20,
                      }}>PENDING</div>
                      <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>
                        {a.requested_by_name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>

        {/* Recent activity */}
        <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <SectionHeader title="Recent Activity" color="#60a5fa" />
          {recentActivities.length === 0
            ? <Empty message="No activities logged yet" />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {recentActivities.map((a, i) => (
                  <div key={a.id} style={{
                    display: 'flex', gap: 12, paddingBottom: 12,
                    borderBottom: i < recentActivities.length - 1 ? '1px solid #f0f0f0' : 'none',
                    paddingTop: i > 0 ? 12 : 0,
                  }}>
                    <div style={{ fontSize: 18, flexShrink: 0, paddingTop: 1 }}>
                      {ACTIVITY_ICONS[a.type] ?? '📋'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#2D2D2D' }}>
                        {a.company_name}
                        <span style={{ fontWeight: 400, color: '#aaa', marginLeft: 6 }}>
                          via {a.type?.replace('_', ' ')}
                        </span>
                      </div>
                      {a.summary && (
                        <div style={{
                          fontSize: 11, color: '#666', marginTop: 2,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {a.summary}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: '#bbb', marginTop: 3 }}>
                        {date(a.logged_at)} · {a.logged_by_name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>
    </div>
  );
}
