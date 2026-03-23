import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sun, AlertTriangle, Clock, TrendingUp,
  Bell, ShieldCheck, ArrowRight, ChevronRight, RefreshCw,
} from 'lucide-react';
import { bdApi } from '../lib/api.js';
import { inr, date, daysSince } from '../lib/fmt.js';
import { Spinner, ErrorBanner } from '../components/Spinner.jsx';
import { SplineScene } from '@/components/ui/spline-scene';
import { SpotlightSVG, Spotlight } from '@/components/ui/spotlight';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useApi } from '../hooks/useApi.js';

// ── Stage config ─────────────────────────────────────────────────────────────
const STAGES = [
  { key: 'first_connect',          label: 'First Connect',          color: '#94a3b8' },
  { key: 'requirement_captured',   label: 'Requirement Captured',   color: '#60a5fa' },
  { key: 'proposal_sent',          label: 'Proposal Sent',          color: '#a78bfa' },
  { key: 'technical_closure',      label: 'Technical Closure',      color: '#f59e0b' },
  { key: 'commercial_negotiation', label: 'Commercial Negotiation', color: '#F26B4E' },
  { key: 'po_received',            label: 'PO Received',            color: '#10b981' },
];

// ── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = '#F26B4E', icon: Icon }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.92)', borderRadius: 14, padding: '16px 18px',
      border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <div style={{ background: color + '18', borderRadius: 10, padding: 8, flexShrink: 0 }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'hsl(var(--muted-foreground))', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: 'hsl(var(--foreground))', lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Pipeline stage bubbles ────────────────────────────────────────────────────
function StageBubbles({ opps }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
      {STAGES.map(s => {
        const count = opps.filter(o => o.stage === s.key).length;
        const val   = opps.filter(o => o.stage === s.key).reduce((a, o) => a + Number(o.estimated_value ?? 0), 0);
        return (
          <div key={s.key} style={{
            background: count > 0 ? s.color + '12' : 'rgba(255,255,255,0.7)',
            border: `1px solid ${count > 0 ? s.color + '40' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: 12, padding: '14px 10px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: count > 0 ? s.color : '#ccc' }}>{count}</div>
            <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', marginTop: 2, fontWeight: 600 }}>{inr(val)}</div>
            <div style={{ fontSize: 9, color: 'hsl(var(--muted-foreground))', marginTop: 3, lineHeight: 1.3 }}>{s.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Deal row ──────────────────────────────────────────────────────────────────
function DealRow({ opp, navigate }) {
  const stage = STAGES.find(s => s.key === opp.stage);
  const days  = opp.stage_updated_at ? daysSince(opp.stage_updated_at) : null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px', borderRadius: 10,
      background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.05)',
      marginBottom: 6, cursor: 'pointer', transition: 'box-shadow 0.15s',
    }}
      onClick={() => navigate('/epc/bd/opportunities')}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: (stage?.color ?? '#ccc') + '20',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 800, color: stage?.color ?? '#ccc',
      }}>
        {(opp.company_name ?? opp.account_name ?? '?')[0].toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--foreground))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {opp.company_name ?? opp.account_name ?? '—'}
        </div>
        <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {opp.title}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--foreground))' }}>{inr(opp.estimated_value)}</div>
        <div style={{ fontSize: 10, color: stage?.color ?? 'hsl(var(--muted-foreground))', fontWeight: 600 }}>{stage?.label ?? opp.stage}</div>
      </div>
      {days !== null && (
        <div style={{
          fontSize: 10, fontWeight: 700, color: days > 14 ? '#ef4444' : '#10b981',
          background: days > 14 ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${days > 14 ? '#fecaca' : '#bbf7d0'}`,
          borderRadius: 6, padding: '2px 7px', flexShrink: 0,
        }}>
          {days}d
        </div>
      )}
      <ChevronRight size={12} style={{ color: '#ccc', flexShrink: 0 }} />
    </div>
  );
}

// ── Follow-up row ─────────────────────────────────────────────────────────────
function FuRow({ fu, navigate }) {
  const due     = fu.due_date ? new Date(fu.due_date) : null;
  const overdue = due && due < new Date();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
      borderRadius: 10, background: overdue ? '#fef2f2' : 'rgba(255,255,255,0.85)',
      border: `1px solid ${overdue ? '#fecaca' : 'rgba(0,0,0,0.05)'}`,
      marginBottom: 6, cursor: 'pointer',
    }}
      onClick={() => navigate('/epc/bd/follow-ups')}
    >
      <div style={{ width: 28, height: 28, borderRadius: 7, background: overdue ? '#fee2e2' : '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Clock size={13} style={{ color: overdue ? '#ef4444' : '#f97316' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--foreground))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {fu.company_name ?? '—'}
        </div>
        <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{fu.opp_title ?? '—'}</div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: overdue ? '#ef4444' : '#6b7280', flexShrink: 0 }}>
        {due ? due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
      </div>
      <ChevronRight size={12} style={{ color: '#ccc', flexShrink: 0 }} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EPCCommandCenter({ product = 'epc' }) {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApi(() => bdApi.dashboard());

  const [opps,     setOpps]     = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [oppsLoading, setOppsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      bdApi.opps({ product_type: 'epc' }).catch(() => []),
      bdApi.followUps({ product_type: 'epc' }).catch(() => []),
    ]).then(([o, fu]) => {
      setOpps(Array.isArray(o) ? o : o?.data ?? []);
      setFollowUps(Array.isArray(fu) ? fu : fu?.data ?? []);
    }).finally(() => setOppsLoading(false));
  }, []);

  if (loading || oppsLoading) return <Spinner />;
  if (error) return <ErrorBanner message={error} />;

  const d = data ?? {};

  const openOpps         = opps.filter(o => !['won','lost'].includes(o.stage));
  const totalOpenDeals   = openOpps.length;
  const totalPipelineVal = openOpps.reduce((s, o) => s + Number(o.estimated_value ?? 0), 0);
  const overdueFollowUps = followUps.filter(fu => fu.due_date && new Date(fu.due_date) < new Date());
  const hotDeals         = opps.filter(o => ['commercial_negotiation','technical_closure'].includes(o.stage));
  const staleDeals       = opps.filter(o => o.stale);

  return (
    <div style={{ fontFamily: "'Chivo', sans-serif", color: 'hsl(var(--foreground))' }}>

      {/* ── Hero banner with Spline 3D robot ── */}
      <div className="relative w-full h-[320px] rounded-2xl overflow-hidden bg-[#0d0d0d] mb-7 border border-white/10">

        {/* SVG spotlight sweep */}
        <SpotlightSVG className="-top-40 left-0 md:left-40 md:-top-20" fill="#F26B4E" />

        {/* Mouse-tracking glow */}
        <Spotlight className="z-10" size={320} />

        {/* Grid texture */}
        <div className="absolute inset-0 z-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        {/* Left: text */}
        <div className="absolute inset-0 z-20 flex flex-col justify-center pl-10 pr-4 max-w-lg">
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs font-bold px-3 py-1">
              Solar EPC · BD Portal
            </Badge>
            <Badge variant="outline" className="border-white/20 text-white/50 text-xs">
              Live
            </Badge>
          </div>

          <h1 className="text-4xl font-black leading-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
            EPC Command<br />Centre
          </h1>

          <p className="mt-3 text-sm text-white/50 leading-relaxed max-w-sm">
            Solar EPC pipeline · {totalOpenDeals} open deals ·{' '}
            <span className="text-orange-400 font-semibold">{inr(totalPipelineVal)}</span> in play
          </p>

          <div className="flex items-center gap-3 mt-5">
            <div className="flex flex-col">
              <span className="text-2xl font-black text-white">{totalOpenDeals}</span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Open Deals</span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex flex-col">
              <span className="text-2xl font-black text-orange-400">{overdueFollowUps.length}</span>
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
        <KpiCard label="Open Deals"          value={totalOpenDeals}          sub={`${inr(totalPipelineVal)} pipeline`}               color="#F26B4E" icon={TrendingUp} />
        <KpiCard label="Follow-ups Overdue"  value={overdueFollowUps.length} sub={overdueFollowUps.length > 0 ? 'Action required' : 'All clear'} color={overdueFollowUps.length > 0 ? '#ef4444' : '#10b981'} icon={Clock} />
        <KpiCard label="Pending Approvals"   value={d.pending_approvals ?? 0} sub={d.pending_approvals > 0 ? 'Waiting on you' : 'Nothing pending'} color={d.pending_approvals > 0 ? '#f59e0b' : '#10b981'} icon={Bell} />
        <KpiCard label="Stale Deals"         value={staleDeals.length}        sub={staleDeals.length > 0 ? 'Pipeline risk' : 'Pipeline healthy'}   color={staleDeals.length > 0 ? '#f59e0b' : '#10b981'} icon={AlertTriangle} />
      </div>

      {/* ── Pipeline by stage ── */}
      <div style={{ background: 'rgba(255,255,255,0.88)', borderRadius: 16, padding: '18px 20px', marginBottom: 20, border: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>Pipeline by Stage</div>
          <button onClick={refetch} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <RefreshCw size={13} style={{ color: 'hsl(var(--muted-foreground))' }} />
          </button>
        </div>
        <StageBubbles opps={opps} />
      </div>

      {/* ── Two-column: follow-ups + hot deals ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* Follow-ups due */}
        <div style={{ background: 'rgba(255,255,255,0.88)', borderRadius: 16, padding: '18px 20px', border: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>
              Follow-ups Due
              {overdueFollowUps.length > 0 && (
                <span style={{ marginLeft: 8, background: '#fef2f2', color: '#ef4444', fontSize: 10, fontWeight: 800, borderRadius: 20, padding: '2px 8px', border: '1px solid #fecaca' }}>
                  {overdueFollowUps.length} overdue
                </span>
              )}
            </div>
            <button onClick={() => navigate('/epc/bd/follow-ups')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#F26B4E', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={11} />
            </button>
          </div>
          {followUps.length === 0
            ? <div style={{ textAlign: 'center', color: '#bbb', fontSize: 13, padding: '20px 0' }}>All clear</div>
            : followUps.slice(0, 5).map(fu => <FuRow key={fu.id} fu={fu} navigate={navigate} />)
          }
        </div>

        {/* Hot deals */}
        <div style={{ background: 'rgba(255,255,255,0.88)', borderRadius: 16, padding: '18px 20px', border: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>Hot Deals
              <span style={{ marginLeft: 8, background: '#fff7ed', color: '#F26B4E', fontSize: 10, fontWeight: 800, borderRadius: 20, padding: '2px 8px', border: '1px solid #fed7aa' }}>
                {hotDeals.length}
              </span>
            </div>
            <button onClick={() => navigate('/epc/bd/opportunities')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#F26B4E', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={11} />
            </button>
          </div>
          {hotDeals.length === 0
            ? <div style={{ textAlign: 'center', color: '#bbb', fontSize: 13, padding: '20px 0' }}>No hot deals right now</div>
            : hotDeals.slice(0, 5).map(opp => <DealRow key={opp.id} opp={opp} navigate={navigate} />)
          }
        </div>
      </div>

    </div>
  );
}
