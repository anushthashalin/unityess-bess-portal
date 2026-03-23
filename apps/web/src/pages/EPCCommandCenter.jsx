import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sun, AlertTriangle, CheckCircle2, Clock, TrendingUp,
  Users, FileText, Bell, ShieldCheck, ArrowRight, Activity,
  Sparkles, Zap,
} from 'lucide-react';
import { bdApi } from '../lib/api.js';
import { inr, date } from '../lib/fmt.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Button } from '../components/ui/button.jsx';
import { Separator } from '../components/ui/separator.jsx';
import { Skeleton } from '../components/ui/skeleton.jsx';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table.jsx';

const STAGE_COLOR = {
  lead:         'bg-blue-50 text-blue-600 border-blue-200',
  proposal:     'bg-orange-50 text-orange-500 border-orange-200',
  negotiation:  'bg-amber-50 text-amber-600 border-amber-200',
  po_received:  'bg-green-50 text-green-600 border-green-200',
  won:          'bg-emerald-100 text-emerald-800 border-emerald-300',
  lost:         'bg-red-50 text-red-600 border-red-200',
};

function StageBadge({ stage }) {
  const cls = STAGE_COLOR[stage] ?? 'bg-gray-100 text-gray-500 border-gray-200';
  const label = (stage ?? '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color, onClick }) {
  return (
    <Card
      className={`border border-border/50 shadow-sm bg-white/95 backdrop-blur-sm transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`${color} p-2.5 rounded-xl shrink-0`}>
          <Icon size={16} />
        </div>
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-[22px] font-black text-foreground leading-tight tabular-nums">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function EPCCommandCenter() {
  const navigate = useNavigate();
  const [data, setData]     = useState(null);
  const [opps, setOpps]     = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      bdApi.dashboard().catch(() => ({})),
      bdApi.opps({ product_type: 'epc' }).catch(() => []),
      bdApi.followUps({ product_type: 'epc' }).catch(() => []),
      bdApi.approvals({ product_type: 'epc', status: 'pending' }).catch(() => []),
    ]).then(([dash, o, fu, ap]) => {
      setData(dash);
      setOpps(Array.isArray(o) ? o : o?.data ?? []);
      setFollowUps(Array.isArray(fu) ? fu : fu?.data ?? []);
      setApprovals(Array.isArray(ap) ? ap : ap?.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  const now = new Date();
  const activeOpps   = opps.filter(o => !['won', 'lost'].includes(o.stage));
  const hotDeals     = opps.filter(o => o.stage === 'negotiation');
  const overdueFollowUps = followUps.filter(fu => {
    if (fu.status === 'done') return false;
    return fu.due_date && new Date(fu.due_date) < now;
  });
  const pendingApprovals = approvals.filter(a => a.status === 'pending');

  // Pipeline value by stage
  const pipelineValue = activeOpps.reduce((s, o) => s + Number(o.value_inr ?? 0), 0);

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-foreground tracking-tight flex items-center gap-2">
            <Sun size={20} className="text-[#F26B4E]" />
            EPC Command Centre
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Live pipeline health for Solar EPC business development.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white/90 border border-border/50 rounded-xl px-3 py-1.5 shadow-sm">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <Sparkles size={11} className="text-orange-400" />
            <span className="text-[11px] font-bold text-orange-500">Solar EPC · Live</span>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={Activity}      label="Active Opportunities" value={activeOpps.length}
          sub={`₹${(pipelineValue / 1e5).toFixed(1)}L pipeline`}
          color="bg-orange-100 text-orange-500"
          onClick={() => navigate('/epc/bd/opportunities')}
        />
        <StatCard
          icon={TrendingUp}    label="Hot Deals" value={hotDeals.length}
          sub="In negotiation"
          color="bg-amber-100 text-amber-600"
          onClick={() => navigate('/epc/bd/opportunities')}
        />
        <StatCard
          icon={AlertTriangle} label="Overdue Follow-ups" value={overdueFollowUps.length}
          sub={overdueFollowUps.length > 0 ? 'Needs attention' : 'All clear'}
          color={overdueFollowUps.length > 0 ? 'bg-red-100 text-red-500' : 'bg-emerald-100 text-emerald-600'}
          onClick={() => navigate('/epc/bd/follow-ups')}
        />
        <StatCard
          icon={ShieldCheck}   label="Pending Approvals" value={pendingApprovals.length}
          sub="Awaiting sign-off"
          color="bg-violet-100 text-violet-600"
          onClick={() => navigate('/epc/bd/approvals')}
        />
      </div>

      {/* Active Opportunities */}
      <Card className="border border-border/50 shadow-sm bg-white/95 backdrop-blur-sm overflow-hidden">
        <CardHeader className="py-3.5 px-5 flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-[14px] font-bold">Active EPC Opportunities</CardTitle>
            <CardDescription className="text-[11px] mt-0.5">{activeOpps.length} deals in pipeline</CardDescription>
          </div>
          <Button size="sm" className="bg-[#F26B4E] hover:bg-[#E04D2E] text-white text-xs h-8 px-4 font-bold rounded-lg"
            onClick={() => navigate('/epc/bd/opportunities')}>
            View all <ArrowRight size={12} className="ml-1.5" />
          </Button>
        </CardHeader>
        <Separator />
        {activeOpps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-2">
            <Sun size={32} className="opacity-20" />
            <p className="text-sm">No active EPC opportunities yet.</p>
            <Button size="sm" variant="outline" className="mt-1 text-xs"
              onClick={() => navigate('/epc/bd/opportunities')}>
              Add first opportunity
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#2D2D2D] hover:bg-[#2D2D2D] border-0">
                  {['Account', 'Title', 'Value', 'Stage', 'Next Follow-up'].map(h => (
                    <TableHead key={h} className="text-white/75 text-[10px] font-bold uppercase tracking-widest h-9">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeOpps.slice(0, 8).map(o => (
                  <TableRow key={o.id} className="hover:bg-orange-50/50 transition-colors border-border/40">
                    <TableCell className="font-semibold text-[13px] py-3">{o.account_name ?? '—'}</TableCell>
                    <TableCell className="font-medium text-[13px] py-3">{o.title}</TableCell>
                    <TableCell className="font-bold text-[13px] py-3">{inr(o.value_inr)}</TableCell>
                    <TableCell className="py-3"><StageBadge stage={o.stage} /></TableCell>
                    <TableCell className="text-muted-foreground text-[13px] py-3">
                      {o.next_followup ? date(o.next_followup) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Overdue Follow-ups */}
      {overdueFollowUps.length > 0 && (
        <Card className="border border-red-200 shadow-sm bg-white/95 backdrop-blur-sm overflow-hidden">
          <CardHeader className="py-3.5 px-5 flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-red-500" />
              <CardTitle className="text-[14px] font-bold text-red-600">Overdue Follow-ups</CardTitle>
            </div>
            <Button size="sm" variant="outline" className="text-xs h-8 px-4 rounded-lg border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => navigate('/epc/bd/follow-ups')}>
              View all
            </Button>
          </CardHeader>
          <Separator />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-red-50 hover:bg-red-50 border-0">
                  {['Account', 'Note', 'Due Date', 'Days Overdue'].map(h => (
                    <TableHead key={h} className="text-red-400 text-[10px] font-bold uppercase tracking-widest h-9">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueFollowUps.slice(0, 5).map(fu => {
                  const due = new Date(fu.due_date);
                  const daysOver = Math.floor((now - due) / 86400000);
                  return (
                    <TableRow key={fu.id} className="hover:bg-red-50/50 transition-colors border-border/40">
                      <TableCell className="font-semibold text-[13px] py-3">{fu.account_name ?? '—'}</TableCell>
                      <TableCell className="text-[13px] py-3 text-muted-foreground max-w-[260px] truncate">{fu.note ?? '—'}</TableCell>
                      <TableCell className="text-[13px] py-3 text-red-500 font-semibold">{date(fu.due_date)}</TableCell>
                      <TableCell className="py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-600 border border-red-200">
                          {daysOver}d overdue
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <Card className="border border-violet-200 shadow-sm bg-white/95 backdrop-blur-sm overflow-hidden">
          <CardHeader className="py-3.5 px-5 flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-violet-500" />
              <CardTitle className="text-[14px] font-bold text-violet-700">Pending Approvals</CardTitle>
            </div>
            <Button size="sm" variant="outline" className="text-xs h-8 px-4 rounded-lg border-violet-200 text-violet-600 hover:bg-violet-50"
              onClick={() => navigate('/epc/bd/approvals')}>
              Review
            </Button>
          </CardHeader>
          <Separator />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-violet-50 hover:bg-violet-50 border-0">
                  {['Title', 'Requested by', 'Value', 'Created'].map(h => (
                    <TableHead key={h} className="text-violet-400 text-[10px] font-bold uppercase tracking-widest h-9">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingApprovals.slice(0, 5).map(ap => (
                  <TableRow key={ap.id} className="hover:bg-violet-50/50 transition-colors border-border/40">
                    <TableCell className="font-semibold text-[13px] py-3">{ap.title}</TableCell>
                    <TableCell className="text-[13px] py-3 text-muted-foreground">{ap.requested_by ?? '—'}</TableCell>
                    <TableCell className="font-bold text-[13px] py-3">{inr(ap.value_inr)}</TableCell>
                    <TableCell className="text-muted-foreground text-[13px] py-3">{date(ap.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

    </div>
  );
}
