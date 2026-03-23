import { useState, useMemo } from 'react';
import { useApiMulti } from '../hooks/useApi.js';
import { bdApi } from '../lib/api.js';
import { inr, date } from '../lib/fmt.js';
import { ErrorBanner, Empty } from '../components/Spinner.jsx';
import { Skeleton } from '../components/ui/skeleton.jsx';
import { Avatar, AvatarFallback } from '../components/ui/avatar.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Label } from '../components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select.jsx';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog.jsx';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../components/ui/dropdown-menu.jsx';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table.jsx';
import {
  Search, Plus, Building2, MapPin, MoreHorizontal,
  Eye, Pencil, Activity, Trash2, TrendingUp, Users, ArrowUpDown, X,
} from 'lucide-react';
import { cn } from '../lib/utils.js';

const INDUSTRIES = ['C&I Solar','Utility Solar','EPC','Manufacturing','Real Estate','Hospitality','Healthcare','Education','Government','Other'];
const SOURCES    = ['referral','cold_call','linkedin','tender','website','exhibition','other'];

const STAGE_COLORS = {
  first_connect:          { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
  requirement_captured:   { bg: 'bg-blue-50',   text: 'text-blue-600',  border: 'border-blue-200' },
  proposal_sent:          { bg: 'bg-violet-50', text: 'text-violet-600',border: 'border-violet-200' },
  technical_closure:      { bg: 'bg-amber-50',  text: 'text-amber-600', border: 'border-amber-200' },
  commercial_negotiation: { bg: 'bg-orange-50', text: 'text-orange-600',border: 'border-orange-200' },
  po_received:            { bg: 'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-200' },
};
const STAGE_LABELS = {
  first_connect: 'First Connect', requirement_captured: 'Req. Captured',
  proposal_sent: 'Proposal Sent', technical_closure: 'Tech. Closure',
  commercial_negotiation: 'Commercial', po_received: 'PO Received',
};

function StageBadge({ stage }) {
  if (!stage) return <span className="text-muted-foreground text-xs">—</span>;
  const c = STAGE_COLORS[stage] ?? { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border', c.bg, c.text, c.border)}>
      {STAGE_LABELS[stage] ?? stage}
    </span>
  );
}

function OwnerAvatar({ name }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-2">
      <Avatar className="w-6 h-6">
        <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
      </Avatar>
      <span className="text-[13px] text-muted-foreground">{name || '—'}</span>
    </div>
  );
}

// Add Account Dialog
function AddAccountDialog({ open, onOpenChange, users, onSaved, product = 'bess' }) {
  const [form, setForm] = useState({
    company_name: '', industry: '', city: '', state: '',
    website: '', gstin: '', source: '', owner_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.company_name.trim()) { setError('Company name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await bdApi.createAccount({ ...form, owner_id: form.owner_id || null, product_type: product });
      setForm({ company_name: '', industry: '', city: '', state: '', website: '', gstin: '', source: '', owner_id: '' });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div>
            <Label htmlFor="company_name" className="text-xs font-semibold text-muted-foreground">Company Name *</Label>
            <Input id="company_name" value={form.company_name} onChange={e => set('company_name', e.target.value)}
              className="mt-1 focus-visible:ring-[#F26B4E]" placeholder="e.g. Ornate Solar Pvt Ltd" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">City</Label>
              <Input value={form.city} onChange={e => set('city', e.target.value)} className="mt-1 focus-visible:ring-[#F26B4E]" placeholder="New Delhi" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">State</Label>
              <Input value={form.state} onChange={e => set('state', e.target.value)} className="mt-1 focus-visible:ring-[#F26B4E]" placeholder="Delhi" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Website</Label>
              <Input value={form.website} onChange={e => set('website', e.target.value)} className="mt-1 focus-visible:ring-[#F26B4E]" placeholder="https://..." type="url" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">GSTIN</Label>
              <Input value={form.gstin} onChange={e => set('gstin', e.target.value)} className="mt-1 focus-visible:ring-[#F26B4E]" placeholder="27AAAAA0000A1Z5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Industry</Label>
              <Select value={form.industry} onValueChange={v => set('industry', v)}>
                <SelectTrigger className="mt-1 focus:ring-[#F26B4E]"><SelectValue placeholder="— Select —" /></SelectTrigger>
                <SelectContent>{INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Source</Label>
              <Select value={form.source} onValueChange={v => set('source', v)}>
                <SelectTrigger className="mt-1 focus:ring-[#F26B4E]"><SelectValue placeholder="— Select —" /></SelectTrigger>
                <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Account Owner</Label>
            <Select value={form.owner_id} onValueChange={v => set('owner_id', v)}>
              <SelectTrigger className="mt-1 focus:ring-[#F26B4E]"><SelectValue placeholder="— Unassigned —" /></SelectTrigger>
              <SelectContent>{users.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">{error}</div>
          )}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg">Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-[#F26B4E] hover:bg-[#E04D2E] text-white rounded-lg font-bold px-5">
              {saving ? 'Saving…' : 'Save Account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function BDAccounts({ product = 'bess' }) {
  const [search, setSearch]         = useState('');
  const [showAdd, setShowAdd]       = useState(false);
  const [sortField, setSortField]   = useState('company_name');
  const [sortDir, setSortDir]       = useState('asc');
  const [industryFilter, setIndustryFilter] = useState('');

  const { accounts: accountsRes, users: usersRes, loading, error, refetch } = useApiMulti({
    accounts: () => bdApi.accounts({ product_type: product }),
    users:    bdApi.users,
  }, [product]);

  const accounts = accountsRes?.data ?? [];
  const users    = usersRes?.data    ?? [];

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  const filtered = useMemo(() => {
    let rows = accounts.filter(a =>
      (!search || [a.company_name, a.city, a.industry, a.owner_name].some(v => v?.toLowerCase().includes(search.toLowerCase()))) &&
      (!industryFilter || a.industry === industryFilter)
    );
    rows = [...rows].sort((a, b) => {
      const av = a[sortField] ?? '';
      const bv = b[sortField] ?? '';
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return rows;
  }, [accounts, search, industryFilter, sortField, sortDir]);

  const totalPipeline = accounts.reduce((s, a) => s + (a.pipeline_value || 0), 0);
  const totalOpps     = accounts.reduce((s, a) => s + (a.opp_count || 0), 0);

  const industries = [...new Set(accounts.map(a => a.industry).filter(Boolean))];

  function SortButton({ field, children }) {
    const active = sortField === field;
    return (
      <button onClick={() => toggleSort(field)} className={cn(
        'flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-colors',
        active ? 'text-[#F26B4E]' : 'text-white/70 hover:text-white'
      )}>
        {children}
        <ArrowUpDown size={10} className={active ? 'text-[#F26B4E]' : 'text-white/40'} />
      </button>
    );
  }

  if (loading) return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div className="space-y-2"><Skeleton className="h-7 w-32" /><Skeleton className="h-4 w-56" /></div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="space-y-5">

      <AddAccountDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        users={users}
        onSaved={refetch}
        product={product}
      />

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-[22px] font-black text-foreground tracking-tight">Accounts</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {accounts.length} accounts · {inr(totalPipeline)} pipeline · {totalOpps} opportunities
          </p>
        </div>
        <Button
          onClick={() => setShowAdd(true)}
          className="bg-[#F26B4E] hover:bg-[#E04D2E] text-white font-bold rounded-xl h-10 px-4 gap-2 shadow-sm"
        >
          <Plus size={15} /> Add Account
        </Button>
      </div>

      {/* KPI mini cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Accounts', value: accounts.length, icon: Building2, color: '#F26B4E' },
          { label: 'Pipeline Value', value: inr(totalPipeline), icon: TrendingUp, color: '#3B82F6' },
          { label: 'Open Opportunities', value: totalOpps, icon: Activity, color: '#7C3AED' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{ borderLeft: `3px solid ${color}` }}
            className="bg-white/95 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-border/40">
            <div style={{ background: color + '14' }} className="p-2.5 rounded-xl">
              <Icon size={16} style={{ color }} />
            </div>
            <div>
              <div className="text-[18px] font-black text-foreground leading-none">{value}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter bar */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search company, city, industry, owner…"
            className="pl-9 pr-9 focus-visible:ring-[#F26B4E] bg-white/95 rounded-xl border-border/50"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={13} />
            </button>
          )}
        </div>
        {/* Industry filter chips */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setIndustryFilter('')}
            className={cn(
              'px-3 py-1 rounded-full text-[11px] font-bold border transition-all',
              !industryFilter ? 'bg-[#F26B4E] text-white border-[#F26B4E]' : 'bg-white text-muted-foreground border-border/50 hover:border-[#F26B4E] hover:text-[#F26B4E]'
            )}
          >
            All
          </button>
          {industries.slice(0, 5).map(ind => (
            <button
              key={ind}
              onClick={() => setIndustryFilter(ind === industryFilter ? '' : ind)}
              className={cn(
                'px-3 py-1 rounded-full text-[11px] font-bold border transition-all',
                industryFilter === ind ? 'bg-[#F26B4E] text-white border-[#F26B4E]' : 'bg-white text-muted-foreground border-border/50 hover:border-[#F26B4E] hover:text-[#F26B4E]'
              )}
            >
              {ind}
            </button>
          ))}
        </div>
        <span className="text-[12px] text-muted-foreground ml-auto shrink-0">{filtered.length} of {accounts.length}</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Empty message={search ? `No accounts match "${search}"` : 'No accounts yet — add your first account.'} />
      ) : (
        <div className="bg-white/95 rounded-2xl shadow-sm border border-border/40 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#2D2D2D] hover:bg-[#2D2D2D] border-0">
                <TableHead className="h-10"><SortButton field="company_name">Company</SortButton></TableHead>
                <TableHead className="h-10"><SortButton field="industry">Industry</SortButton></TableHead>
                <TableHead className="text-white/70 text-[10px] font-bold uppercase tracking-widest h-10">Location</TableHead>
                <TableHead className="text-white/70 text-[10px] font-bold uppercase tracking-widest h-10">Owner</TableHead>
                <TableHead className="text-white/70 text-[10px] font-bold uppercase tracking-widest h-10 text-center">Deals</TableHead>
                <TableHead className="h-10"><SortButton field="pipeline_value">Pipeline</SortButton></TableHead>
                <TableHead className="text-white/70 text-[10px] font-bold uppercase tracking-widest h-10">Stage</TableHead>
                <TableHead className="text-white/70 text-[10px] font-bold uppercase tracking-widest h-10">Last Activity</TableHead>
                <TableHead className="text-white/70 text-[10px] font-bold uppercase tracking-widest h-10 w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(a => (
                <TableRow key={a.id} className="hover:bg-orange-50/40 transition-colors border-border/30 group">
                  <TableCell className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#F26B4E]/10 flex items-center justify-center shrink-0">
                        <Building2 size={14} className="text-[#F26B4E]" />
                      </div>
                      <div>
                        <div className="font-bold text-[13px] text-foreground">{a.company_name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{a.account_id}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-[13px] text-muted-foreground">{a.industry || '—'}</TableCell>
                  <TableCell className="py-3 text-[13px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      {(a.city || a.state) && <MapPin size={11} className="text-muted-foreground/50 shrink-0" />}
                      {[a.city, a.state].filter(Boolean).join(', ') || '—'}
                    </div>
                  </TableCell>
                  <TableCell className="py-3"><OwnerAvatar name={a.owner_name} /></TableCell>
                  <TableCell className="py-3 text-center">
                    <span className={cn(
                      'inline-flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-black',
                      a.opp_count > 0 ? 'bg-[#F26B4E]/12 text-[#F26B4E]' : 'bg-muted text-muted-foreground'
                    )}>
                      {a.opp_count}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 font-bold text-[13px]" style={{ color: a.pipeline_value > 0 ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>
                    {a.pipeline_value > 0 ? inr(a.pipeline_value) : '—'}
                  </TableCell>
                  <TableCell className="py-3"><StageBadge stage={a.latest_stage} /></TableCell>
                  <TableCell className="py-3 text-[12px] text-muted-foreground">
                    {a.last_activity_at ? date(a.last_activity_at) : '—'}
                  </TableCell>
                  <TableCell className="py-3 pr-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-orange-50 hover:text-[#F26B4E] rounded-lg">
                          <MoreHorizontal size={14} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="gap-2"><Eye size={13} />View Profile</DropdownMenuItem>
                        <DropdownMenuItem className="gap-2"><Pencil size={13} />Edit Account</DropdownMenuItem>
                        <DropdownMenuItem className="gap-2"><Activity size={13} />Log Activity</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"><Trash2 size={13} />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
