import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useApiMulti } from '../hooks/useApi.js';
import { bdApi } from '../lib/api.js';
import { inr, date, daysSince } from '../lib/fmt.js';
import { ErrorBanner } from '../components/Spinner.jsx';
import { Skeleton } from '../components/ui/skeleton.jsx';
import { Avatar, AvatarFallback } from '../components/ui/avatar.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Label } from '../components/ui/label.jsx';
import { Separator } from '../components/ui/separator.jsx';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select.jsx';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '../components/ui/sheet.jsx';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table.jsx';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '../components/ui/dropdown-menu.jsx';
import {
  Search, Plus, Building2, MapPin, TrendingUp, Activity,
  ArrowUpDown, X, Mail, Phone, Star, AlertTriangle,
  MoreHorizontal, Eye, Pencil, Trash2, ChevronRight,
  Calendar, LayoutGrid, List, Users, Briefcase, Filter,
  ChevronDown, Download, Check, Circle, CheckCircle2,
} from 'lucide-react';
import { cn } from '../lib/utils.js';
import AddToCalendar from '../components/AddToCalendar.jsx';
import { BD_LEADS, BD_TEAM, STATUS_CONFIG } from '../data/bdLeads.js';

// ─────────────────────────────────────────────────────────────────────────────
const INDUSTRIES = ['C&I Solar','Utility Solar','EPC','Manufacturing','Real Estate','Hospitality','Healthcare','Education','Government','Other'];
const SOURCES    = ['referral','cold_call','linkedin','tender','website','exhibition','other'];
const SCOPE_TYPES  = ['supply_only','dc_block_pcs','rms_order','supply_install','tpc'];
const SCOPE_LABELS = { supply_only:'Supply Only', dc_block_pcs:'DC Block + PCS', rms_order:'RMS Order', supply_install:'Supply & Install', tpc:'TPC' };

const STAGES = [
  { key:'first_connect',          label:'First Connect',        color:'#94a3b8', bg:'#f1f5f9' },
  { key:'requirement_captured',   label:'Req. Captured',        color:'#3b82f6', bg:'#eff6ff' },
  { key:'proposal_sent',          label:'Proposal Sent',        color:'#8b5cf6', bg:'#f5f3ff' },
  { key:'technical_closure',      label:'Tech. Closure',        color:'#f59e0b', bg:'#fffbeb' },
  { key:'commercial_negotiation', label:'Commercial Neg.',      color:'#F26B4E', bg:'#fff5f3' },
  { key:'po_received',            label:'PO Received',          color:'#10b981', bg:'#f0fdf4' },
  { key:'lost',                   label:'Lost',                 color:'#ef4444', bg:'#fef2f2' },
];

function stageConfig(key) {
  return STAGES.find(s => s.key === key) ?? { color:'#aaa', bg:'#f5f5f5', label: key ?? '\u2014' };
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function StageBadge({ stage }) {
  if (!stage) return <span className="text-muted-foreground text-xs">—</span>;
  const sc = stageConfig(stage);
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border"
      style={{ background: sc.bg, color: sc.color, borderColor: sc.color + '40' }}>
      {sc.label}
    </span>
  );
}

function InitialAvatar({ name, size = 8, colorSeed }) {
  const letters = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors  = ['#F26B4E','#3B82F6','#8B5CF6','#10B981','#F59E0B','#EC4899'];
  const bg      = colors[(colorSeed ?? name?.charCodeAt(0) ?? 0) % colors.length];
  return (
    <div className={`w-${size} h-${size} rounded-full flex items-center justify-center shrink-0 text-white text-[11px] font-black`}
      style={{ background: bg }}>
      {letters}
    </div>
  );
}

function KpiChip({ label, value, icon: Icon, color }) {
  return (
    <div className="flex items-center gap-2.5 bg-card rounded-xl border border-border/50 px-4 py-3 shadow-sm hover:shadow transition-shadow">
      <div className="p-2 rounded-lg" style={{ background: color + '18' }}>
        <Icon size={14} style={{ color }} />
      </div>
      <div>
        <div className="text-[20px] font-black leading-none text-foreground">{value}</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</div>
      </div>
    </div>
  );
}

// ── LEADS TAB ─────────────────────────────────────────────────────────────────
function isDone(v) {
  if (!v || v === 'not done') return false;
  return true;
}
function isDoneDate(v) {
  if (!v || v === 'not done' || v === 'done') return null;
  const m = v.match(/done on (\d{2}\.\d{2}\.\d{2})/);
  return m ? m[1] : null;
}

function PhaseDot({ value, label }) {
  const done = isDone(value);
  const dateStr = isDoneDate(value);
  return (
    <div className="flex flex-col items-center gap-1 min-w-[60px]">
      <div className={cn(
        'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
        done ? 'bg-[#F26B4E] border-[#F26B4E]' : 'bg-transparent border-border/50'
      )}>
        {done && <Check size={10} color="white" strokeWidth={3}/>}
      </div>
      <span className="text-[9px] text-muted-foreground text-center leading-tight">{label}</span>
      {dateStr && <span className="text-[8px] text-[#F26B4E] font-semibold">{dateStr}</span>}
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? { color: '#94a3b8', bg: '#f8fafc', label: status };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.color + '40' }}>
      {cfg.label}
    </span>
  );
}

function BDAvatar({ bdName, size = 7 }) {
  const member = BD_TEAM.find(b => bdName?.toLowerCase().includes(b.match));
  const color = member?.color ?? '#94a3b8';
  const initials = (bdName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className={`w-${size} h-${size} rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-black`}
      style={{ background: color }}>
      {initials}
    </div>
  );
}


function AddLeadButton({ refetch, users }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ company_name: '', industry: '', city: '', state: '', website: '', gstin: '', source: 'Manual', owner_id: '', remarks: '' });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.company_name.trim()) { setErr('Company name required'); return; }
    setSaving(true); setErr('');
    try {
      await bdApi.createAccount({ ...form, owner_id: form.owner_id || null });
      setOpen(false);
      setForm({ company_name: '', industry: '', city: '', state: '', website: '', gstin: '', source: 'Manual', owner_id: '', remarks: '' });
      if (refetch) refetch();
    } catch(ex) {
      setErr(ex.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 bg-[#F26B4E] hover:bg-[#E04D2E] text-white font-bold px-4 py-2 rounded-lg shadow-sm text-[13px] transition-colors">
          <Plus size={14}/> Add Lead
        </button>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[420px] sm:w-[480px]">
          <SheetHeader>
            <SheetTitle>Add New Lead</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Company Name *</label>
              <input value={form.company_name} onChange={e => setForm(f => ({...f, company_name: e.target.value}))} placeholder="e.g. Acme Industries Ltd" className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F26B4E]"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Industry</label>
                <input value={form.industry} onChange={e => setForm(f => ({...f, industry: e.target.value}))} placeholder="e.g. Manufacturing" className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F26B4E]"/>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-1">City</label>
                <input value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))} placeholder="City" className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F26B4E]"/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-1">State</label>
                <input value={form.state} onChange={e => setForm(f => ({...f, state: e.target.value}))} placeholder="State" className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F26B4E]"/>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Website</label>
                <input value={form.website} onChange={e => setForm(f => ({...f, website: e.target.value}))} placeholder="https://" className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F26B4E]"/>
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-1">GSTIN</label>
              <input value={form.gstin} onChange={e => setForm(f => ({...f, gstin: e.target.value}))} placeholder="22AAAAA0000A1Z5" className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F26B4E]"/>
            </div>
            <div>
              <label className="block text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-1">BD Rep</label>
              <select value={form.owner_id} onChange={e => setForm(f => ({...f, owner_id: e.target.value}))} className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F26B4E]">
                <option value="">Assign to...</option>
                {(users||[]).filter(u => u.is_active).map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Remarks</label>
              <textarea value={form.remarks} onChange={e => setForm(f => ({...f, remarks: e.target.value}))} rows={3}
                placeholder="Internal notes, context, next steps..." className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F26B4E] resize-none"/>
            </div>
            {err && <p className="text-sm text-red-500">{err}</p>}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-md bg-[#F26B4E] hover:bg-[#E04D2E] text-white text-sm font-bold disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Lead'}
              </button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

function LeadsTab() {
  const [view, setView] = useState('all');            // 'all' | 'team' | bd-key
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [bdFilter, setBdFilter] = useState('all');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [selectedLead, setSelectedLead] = useState(null);
  const [draft, setDraft] = useState(null);           // editable copy of selectedLead

  // Local leads state — edits persist within the session
  const [leads, setLeads] = useState(() => BD_LEADS);

  function openLead(l) { setSelectedLead(l); setDraft({ ...l }); }
  function closeLead() { setSelectedLead(null); setDraft(null); }

  function setDraftField(k, v) { setDraft(d => ({ ...d, [k]: v })); }

  function togglePhase(key) {
    const cur = draft[key];
    const newVal = isDone(cur) ? 'not done' : 'done';
    setDraftField(key, newVal);
  }

  function saveDraft() {
    setLeads(prev => prev.map(l => l.id === draft.id ? { ...draft } : l));
    setSelectedLead({ ...draft });
  }

  const hasChanges = draft && selectedLead && JSON.stringify(draft) !== JSON.stringify(selectedLead);

  // Stats
  const stats = useMemo(() => ({
    total:        leads.length,
    negotiation:  leads.filter(l => l.status === 'Under Negotiation').length,
    customers:    leads.filter(l => l.status === 'Customer').length,
    prospects:    leads.filter(l => l.status === 'Prospect').length,
    leads:        leads.filter(l => l.status === 'Lead').length,
    hold:         leads.filter(l => l.status === 'Hold').length,
  }), [leads]);

  // BD-specific leads when in BD view
  const activeBD = view !== 'all' && view !== 'team' ? BD_TEAM.find(b => b.key === view) : null;

  const filtered = useMemo(() => {
    let rows = leads;

    // If viewing a specific BD rep's leads
    if (activeBD) {
      rows = rows.filter(l => l.bd?.toLowerCase().includes(activeBD.match));
    }

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(l =>
        l.name?.toLowerCase().includes(q) ||
        l.bd?.toLowerCase().includes(q) ||
        l.location?.toLowerCase().includes(q) ||
        l.type?.toLowerCase().includes(q) ||
        l.remarks?.toLowerCase().includes(q)
      );
    }
    if (statusFilter) rows = rows.filter(l => l.status === statusFilter);
    if (bdFilter && bdFilter !== 'all') rows = rows.filter(l => l.bd?.toLowerCase().includes(bdFilter.toLowerCase()));

    return [...rows].sort((a, b) => {
      const av = (a[sortField] ?? '').toString().toLowerCase();
      const bv = (b[sortField] ?? '').toString().toLowerCase();
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [leads, search, statusFilter, bdFilter, sortField, sortDir, activeBD]);

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  function SortBtn({ field, children }) {
    return (
      <button onClick={() => toggleSort(field)}
        className={cn('flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-colors',
          sortField === field ? 'text-[#F26B4E]' : 'text-white/70 hover:text-white')}>
        {children}<ArrowUpDown size={9}/>
      </button>
    );
  }

  // Export CSV
  function exportCSV() {
    const headers = ['ID','Company','Status','Contact','BD','kWh','Location','Type','Timeline','Qualified','Budgetary','Tech Disc','TC Offer','Final Quote','Followup','Remarks'];
    const rows = filtered.map(l => [
      l.id, l.name, l.status, l.contact, l.bd, l.kwh, l.location, l.type, l.timeline,
      l.qualified, l.budgetary, l.techDisc, l.tcOffer, l.finalQuote, l.followup, l.remarks
    ].map(v => `"${(v||'').toString().replace(/"/g,'""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href=url; a.download='bd_leads.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'Total Leads',     value: stats.total,       color: '#2D2D2D', icon: Users },
          { label: 'Under Negotiation', value: stats.negotiation, color: '#F26B4E', icon: TrendingUp },
          { label: 'Customers',       value: stats.customers,   color: '#10b981', icon: CheckCircle2 },
          { label: 'Prospects',       value: stats.prospects,   color: '#3b82f6', icon: Activity },
          { label: 'Active Leads',    value: stats.leads,       color: '#8b5cf6', icon: Briefcase },
          { label: 'Hold',            value: stats.hold,        color: '#94a3b8', icon: Circle },
        ].map(s => (
          <KpiChip key={s.label} label={s.label} value={s.value} icon={s.icon} color={s.color}/>
        ))}
      </div>

      {/* View switcher */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex border border-border/50 rounded-xl overflow-hidden bg-card shadow-sm">
          <button onClick={() => { setView('all'); setBdFilter('all'); }}
            className={cn('px-4 py-2 text-[12px] font-bold transition-all',
              view === 'all' ? 'bg-[#F26B4E] text-white' : 'text-muted-foreground hover:text-foreground')}>
            All Leads
          </button>
          <button onClick={() => setView('team')}
            className={cn('px-4 py-2 text-[12px] font-bold transition-all',
              view === 'team' ? 'bg-[#F26B4E] text-white' : 'text-muted-foreground hover:text-foreground')}>
            By BD Rep
          </button>
        </div>

        {view === 'all' && (
          <>
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"/>
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search company, BD, location…"
                className="pl-9 pr-8 h-9 text-sm bg-card border-border/50 rounded-xl"/>
              {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={12}/></button>}
            </div>

            {/* Status pills */}
            <div className="flex gap-1.5 flex-wrap">
              {['', 'Under Negotiation', 'Customer', 'Prospect', 'Lead', 'Hold'].map(s => (
                <button key={s||'all'} onClick={() => setStatusFilter(s)}
                  className={cn('px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all whitespace-nowrap',
                    statusFilter === s
                      ? 'bg-[#F26B4E] text-white border-[#F26B4E]'
                      : 'bg-card text-muted-foreground border-border/50 hover:border-[#F26B4E] hover:text-[#F26B4E]')}>
                  {s || 'All'}
                </button>
              ))}
            </div>

            {/* BD filter */}
            <Select value={bdFilter} onValueChange={setBdFilter}>
              <SelectTrigger className="w-36 h-9 text-sm rounded-xl border-border/50 bg-card">
                <SelectValue placeholder="All BDs"/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All BDs</SelectItem>
                {BD_TEAM.map(b => <SelectItem key={b.key} value={b.match}>{b.short}</SelectItem>)}
              </SelectContent>
            </Select>

            <span className="text-[11px] text-muted-foreground">{filtered.length} of {leads.length}</span>
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold border border-border/50 bg-card text-muted-foreground hover:text-[#F26B4E] hover:border-[#F26B4E] transition-all">
              <Download size={12}/> CSV
            </button>
          </>
        )}
      </div>

      {/* BD Team grid */}
      {view === 'team' && (
        <div className="grid grid-cols-3 gap-4">
          {BD_TEAM.map(bd => {
            const bdLeads    = leads.filter(l => l.bd?.toLowerCase().includes(bd.match));
            const negCount   = bdLeads.filter(l => l.status === 'Under Negotiation').length;
            const custCount  = bdLeads.filter(l => l.status === 'Customer').length;
            const initials   = bd.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            return (
              <button key={bd.key}
                onClick={() => { setView(bd.key); setSearch(''); setStatusFilter(''); setBdFilter(''); }}
                className="text-left bg-card rounded-2xl border border-border/50 p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-[15px] font-black shrink-0 shadow-sm"
                    style={{ background: bd.color }}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-[14px] text-foreground">{bd.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">BD Executive</div>
                    <div className="flex gap-3 mt-3">
                      <div className="text-center">
                        <div className="text-[22px] font-black text-foreground leading-none">{bdLeads.length}</div>
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">Total</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[22px] font-black leading-none" style={{ color: '#F26B4E' }}>{negCount}</div>
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">Neg.</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[22px] font-black leading-none" style={{ color: '#10b981' }}>{custCount}</div>
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">Won</div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Status bar */}
                <div className="mt-4 flex gap-1 h-1.5 rounded-full overflow-hidden bg-border/30">
                  {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
                    const count = bdLeads.filter(l => l.status === status).length;
                    if (!count) return null;
                    const pct = (count / bdLeads.length * 100).toFixed(1);
                    return <div key={status} style={{ width: pct + '%', background: cfg.color }} title={`${status}: ${count}`}/>;
                  })}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Individual BD lead list */}
      {activeBD && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('team')}
              className="flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground hover:text-[#F26B4E] transition-colors">
              ← Back to team
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[11px] font-black"
                style={{ background: activeBD.color }}>
                {activeBD.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-black text-[14px] text-foreground">{activeBD.name}</div>
                <div className="text-[11px] text-muted-foreground">{filtered.length} leads</div>
              </div>
            </div>
            {/* Status pills for BD view */}
            <div className="flex gap-1.5 flex-wrap ml-4">
              {['', 'Under Negotiation', 'Customer', 'Prospect', 'Lead', 'Hold'].map(s => (
                <button key={s||'all'} onClick={() => setStatusFilter(s)}
                  className={cn('px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all whitespace-nowrap',
                    statusFilter === s
                      ? 'bg-[#F26B4E] text-white border-[#F26B4E]'
                      : 'bg-card text-muted-foreground border-border/50 hover:border-[#F26B4E] hover:text-[#F26B4E]')}>
                  {s || 'All'}
                </button>
              ))}
            </div>
            <div className="relative ml-2">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"/>
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search leads…"
                className="pl-9 pr-8 h-9 text-sm bg-card border-border/50 rounded-xl w-52"/>
              {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={12}/></button>}
            </div>
            <span className="text-[11px] text-muted-foreground ml-auto">{filtered.length} leads</span>
          </div>
        </div>
      )}

      {/* Leads table — shown in 'all' or individual BD view */}
      {(view === 'all' || activeBD) && (
        filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Users size={32} className="opacity-20"/>
            <p className="text-sm">No leads match your filters.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/50 overflow-hidden shadow-sm bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#2D2D2D] hover:bg-[#2D2D2D] border-0">
                  <TableHead className="h-10 w-8 text-center text-white/50 text-[10px] font-bold">#</TableHead>
                  <TableHead className="h-10"><SortBtn field="name">Company</SortBtn></TableHead>
                  <TableHead className="h-10"><SortBtn field="status">Status</SortBtn></TableHead>
                  {view === 'all' && <TableHead className="h-10"><SortBtn field="bd">BD Rep</SortBtn></TableHead>}
                  <TableHead className="h-10 text-white/70 text-[10px] font-bold uppercase tracking-widest">kWh</TableHead>
                  <TableHead className="h-10 text-white/70 text-[10px] font-bold uppercase tracking-widest">Location</TableHead>
                  <TableHead className="h-10 text-white/70 text-[10px] font-bold uppercase tracking-widest">Type</TableHead>
                  <TableHead className="h-10 text-white/70 text-[10px] font-bold uppercase tracking-widest text-center" colSpan={5}>Phase Tracking</TableHead>
                  <TableHead className="h-10 text-white/70 text-[10px] font-bold uppercase tracking-widest">Follow-up</TableHead>
                </TableRow>
                <TableRow className="bg-[#3a3a3a] hover:bg-[#3a3a3a] border-0">
                  <TableHead className="h-6" colSpan={view === 'all' ? 7 : 6}/>
                  {['Budget','Tech','TC Offer','Final Q.','Follow'].map(h => (
                    <TableHead key={h} className="h-6 text-[9px] text-white/50 font-bold text-center px-1">{h}</TableHead>
                  ))}
                  <TableHead className="h-6"/>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l, idx) => (
                  <TableRow key={l.id}
                    onClick={() => openLead(l)}
                    className="hover:bg-[#F26B4E]/[0.04] transition-colors border-border/30 cursor-pointer group">
                    <TableCell className="py-2.5 text-center text-[11px] text-muted-foreground/50 font-mono">{idx + 1}</TableCell>
                    <TableCell className="py-2.5 px-4">
                      <div className="font-bold text-[13px] text-foreground leading-tight">{l.name}</div>
                      {l.remarks && <div className="text-[10px] text-muted-foreground mt-0.5 max-w-[160px] truncate">{l.remarks}</div>}
                    </TableCell>
                    <TableCell className="py-2.5"><StatusBadge status={l.status}/></TableCell>
                    {view === 'all' && (
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2">
                          <BDAvatar bdName={l.bd} size={6}/>
                          <span className="text-[12px] text-muted-foreground truncate max-w-[80px]">{l.bd || '\u2014'}</span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="py-2.5 text-[12px] font-semibold text-foreground/80 whitespace-nowrap">{l.kwh || '\u2014'}</TableCell>
                    <TableCell className="py-2.5 text-[12px] text-muted-foreground">{l.location || '\u2014'}</TableCell>
                    <TableCell className="py-2.5 text-[12px] text-muted-foreground max-w-[100px] truncate">{l.type || '\u2014'}</TableCell>
                    {/* Phase dots */}
                    {[l.budgetary, l.techDisc, l.tcOffer, l.finalQuote, l.followup].map((v, i) => {
                      const done = isDone(v);
                      return (
                        <TableCell key={i} className="py-2.5 text-center px-1">
                          <div style={{
                            width: 16, height: 16, borderRadius: '50%',
                            border: `1.5px solid ${done ? '#F26B4E' : '#d1d5db'}`,
                            background: done ? '#F26B4E' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto',
                          }}>
                            {done && <Check size={8} color="white" strokeWidth={3}/>}
                          </div>
                        </TableCell>
                      );
                    })}
                    <TableCell className="py-2.5 text-[11px] text-muted-foreground max-w-[80px] truncate">{l.followup || '\u2014'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      )}

      {/* Lead detail drawer */}
      <Sheet open={!!selectedLead} onOpenChange={open => !open && closeLead()}>
        <SheetContent className="w-[480px] sm:max-w-[480px] flex flex-col">
          {selectedLead && draft && (
            <>
              <SheetHeader className="pb-4 border-b border-border/50 shrink-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-3">
                    <Input
                      value={draft.name}
                      onChange={e => setDraftField('name', e.target.value)}
                      className="text-xl font-black border-0 border-b-2 border-transparent focus-visible:border-[#F26B4E] focus-visible:ring-0 px-0 h-auto text-foreground rounded-none bg-transparent"
                    />
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Select value={draft.status} onValueChange={v => setDraftField('status', v)}>
                        <SelectTrigger className="h-6 w-auto text-[11px] font-bold border-0 px-2 py-0 gap-1 rounded-full focus:ring-0"
                          style={{ background: (STATUS_CONFIG[draft.status]?.bg ?? '#f8fafc'), color: (STATUS_CONFIG[draft.status]?.color ?? '#94a3b8') }}>
                          <SelectValue/>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(STATUS_CONFIG).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={draft.qualified ?? '?'} onValueChange={v => setDraftField('qualified', v)}>
                        <SelectTrigger className="h-6 w-auto text-[10px] font-bold border rounded-full px-2 py-0 gap-1 focus:ring-0 bg-card">
                          <SelectValue/>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">✓ Qualified</SelectItem>
                          <SelectItem value="No">✗ Not Qualified</SelectItem>
                          <SelectItem value="?">? Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono shrink-0">#{selectedLead.id}</div>
                </div>
              </SheetHeader>

              <div className="py-5 space-y-5 flex-1 min-h-0 overflow-y-auto">
                {/* BD + Contact */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">BD Executive</Label>
                    <Select value={draft.bd || 'unassigned'} onValueChange={v => setDraftField('bd', v === 'unassigned' ? '' : v)}>
                      <SelectTrigger className="mt-1 h-9 text-sm focus:ring-[#F26B4E] rounded-lg">
                        <div className="flex items-center gap-2">
                          {draft.bd && <BDAvatar bdName={draft.bd} size={5}/>}
                          <SelectValue placeholder="— Unassigned —"/>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">— Unassigned —</SelectItem>
                        {BD_TEAM.map(b => <SelectItem key={b.key} value={b.name}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Contact Person</Label>
                    <Input value={draft.contact} onChange={e => setDraftField('contact', e.target.value)}
                      placeholder="Contact name / number"
                      className="mt-1 h-9 text-sm focus-visible:ring-[#F26B4E] rounded-lg"/>
                  </div>
                </div>

                {/* Specs */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { k: 'kwh',      label: 'Capacity (kWh)', placeholder: 'e.g. 261' },
                    { k: 'location', label: 'Location',       placeholder: 'City / State' },
                    { k: 'type',     label: 'System Type',    placeholder: 'e.g. AC Coupled' },
                    { k: 'timeline', label: 'Timeline',       placeholder: 'e.g. Q2 2026' },
                  ].map(({ k, label, placeholder }) => (
                    <div key={k}>
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</Label>
                      <Input value={draft[k] || ''} onChange={e => setDraftField(k, e.target.value)}
                        placeholder={placeholder}
                        className="mt-1 h-9 text-sm focus-visible:ring-[#F26B4E] rounded-lg"/>
                    </div>
                  ))}
                </div>

                {/* Phase tracking — click to toggle */}
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Phase Tracking <span className="normal-case font-normal text-muted-foreground/60">— click to toggle</span></div>
                  <div className="flex gap-2 justify-between">
                    {[
                      { key: 'budgetary',  label: 'Budgetary' },
                      { key: 'techDisc',   label: 'Tech Disc.' },
                      { key: 'tcOffer',    label: 'TC Offer' },
                      { key: 'finalQuote', label: 'Final Quote' },
                      { key: 'followup',   label: 'Follow-up' },
                    ].map(({ key, label }) => {
                      const done = isDone(draft[key]);
                      const dateStr = isDoneDate(draft[key]);
                      return (
                        <button key={key} onClick={() => togglePhase(key)}
                          style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, flex:1, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            border: `2px solid ${done ? '#F26B4E' : '#d1d5db'}`,
                            background: done ? '#F26B4E' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: done ? '0 1px 4px rgba(242,107,78,0.35)' : 'none',
                            transition: 'all 0.15s',
                          }}>
                            {done && <Check size={14} color="white" strokeWidth={3}/>}
                          </div>
                          <span style={{ fontSize: 10, color: done ? '#F26B4E' : '#6b7280', textAlign: 'center', lineHeight: 1.3, fontWeight: done ? 700 : 400 }}>{label}</span>
                          {dateStr && <span style={{ fontSize: 9, color: '#F26B4E', fontWeight: 700 }}>{dateStr}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Remarks */}
                <div>
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Remarks</Label>
                  <textarea value={draft.remarks || ''} onChange={e => setDraftField('remarks', e.target.value)}
                    rows={3} placeholder="Internal notes, context, next steps…"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-input text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-[#F26B4E]/30 focus:border-[#F26B4E]"/>
                </div>
              </div>

              {/* Footer */}
              <div className="shrink-0 pt-4 border-t border-border/50 flex items-center gap-3">
                {hasChanges && (
                  <span className="text-[11px] text-amber-600 font-semibold flex-1">Unsaved changes</span>
                )}
                <Button variant="outline" onClick={closeLead} className="rounded-lg ml-auto">Cancel</Button>
                <Button onClick={saveDraft} disabled={!hasChanges}
                  className="bg-[#F26B4E] hover:bg-[#E04D2E] text-white font-bold rounded-lg px-5 disabled:opacity-40">
                  Save
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── ACCOUNTS TAB ─────────────────────────────────────────────────────────────
function AccountsTab({ product, accounts, users, refetch }) {
  const { can } = useAuth();
  const [search,    setSearch]    = useState('');
  const [industry,  setIndustry]  = useState('all');
  const [sortField, setSortField] = useState('company_name');
  const [sortDir,   setSortDir]   = useState('asc');
  const [showAdd,   setShowAdd]   = useState(false);
  const [form, setForm] = useState({ company_name:'', industry:'', city:'', state:'', website:'', gstin:'', source:'', owner_id:'' });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleAddAccount(e) {
    e.preventDefault();
    if (!form.company_name.trim()) { setFormErr('Company name required'); return; }
    setSaving(true); setFormErr('');
    try {
      await bdApi.createAccount({ ...form, owner_id: form.owner_id || null, product_type: product });
      setForm({ company_name:'', industry:'', city:'', state:'', website:'', gstin:'', source:'', owner_id:'' });
      setShowAdd(false);
      refetch();
    } catch (err) { setFormErr(err.message); }
    finally { setSaving(false); }
  }

  function toggleSort(f) {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('asc'); }
  }

  const industries = [...new Set(accounts.map(a => a.industry).filter(Boolean))];

  const filtered = useMemo(() => {
    let rows = accounts.filter(a =>
      (!search || [a.company_name, a.city, a.industry, a.owner_name].some(v => v?.toLowerCase().includes(search.toLowerCase()))) &&
      (industry === 'all' || !industry || a.industry === industry)
    );
    return [...rows].sort((a, b) => {
      const av = a[sortField] ?? '', bv = b[sortField] ?? '';
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [accounts, search, industry, sortField, sortDir]);

  const totalPipeline = accounts.reduce((s, a) => s + (a.pipeline_value || 0), 0);

  function SortBtn({ field, children }) {
    return (
      <button onClick={() => toggleSort(field)}
        className={cn('flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-colors',
          sortField === field ? 'text-[#F26B4E]' : 'text-white/70 hover:text-white')}>
        {children}<ArrowUpDown size={9} />
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <KpiChip label="Total Accounts"      value={accounts.length}   icon={Building2}   color="#F26B4E" />
        <KpiChip label="Pipeline Value"      value={inr(totalPipeline)} icon={TrendingUp}  color="#3B82F6" />
        <KpiChip label="Open Opportunities"  value={accounts.reduce((s,a) => s+(a.opp_count||0),0)} icon={Activity} color="#7C3AED" />
      </div>

      {/* Search + filters */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search company, city, owner…"
            className="pl-9 pr-8 h-9 text-sm bg-card border-border/50 rounded-xl" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={12}/></button>}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', ...industries.slice(0,4)].map(ind => (
            <button key={ind} onClick={() => setIndustry(ind)}
              className={cn('px-3 py-1 rounded-full text-[11px] font-bold border transition-all',
                industry === ind ? 'bg-[#F26B4E] text-white border-[#F26B4E]' : 'bg-card text-muted-foreground border-border/50 hover:border-[#F26B4E] hover:text-[#F26B4E]')}>
              {ind === 'all' ? 'All' : ind}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground ml-auto">{filtered.length} of {accounts.length}</span>
        {can('write') && <Button onClick={() => setShowAdd(true)}
          className="bg-[#F26B4E] hover:bg-[#E04D2E] text-white font-bold rounded-xl h-9 px-4 gap-1.5 shadow-sm text-[13px]">
          <Plus size={14}/> Add Account
        </Button>}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Building2 size={32} className="opacity-20" />
          <p className="text-sm">{search ? `No accounts match "${search}"` : 'No accounts yet.'}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/50 overflow-hidden shadow-sm bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#2D2D2D] hover:bg-[#2D2D2D] border-0">
                <TableHead className="h-10"><SortBtn field="company_name">Company</SortBtn></TableHead>
                <TableHead className="h-10 text-white/70 text-[10px] font-bold uppercase tracking-widest">Industry</TableHead>
                <TableHead className="h-10 text-white/70 text-[10px] font-bold uppercase tracking-widest">Location</TableHead>
                <TableHead className="h-10 text-white/70 text-[10px] font-bold uppercase tracking-widest">Owner</TableHead>
                <TableHead className="h-10 text-white/70 text-[10px] font-bold uppercase tracking-widest text-center">Deals</TableHead>
                <TableHead className="h-10"><SortBtn field="pipeline_value">Pipeline</SortBtn></TableHead>
                <TableHead className="h-10 text-white/70 text-[10px] font-bold uppercase tracking-widest">Stage</TableHead>
                <TableHead className="h-10 w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(a => (
                <TableRow key={a.id} className="hover:bg-[#F26B4E]/[0.04] transition-colors border-border/30 group">
                  <TableCell className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <InitialAvatar name={a.company_name} size={8} />
                      <div>
                        <div className="font-bold text-[13px] text-foreground">{a.company_name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{a.account_id}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-[13px] text-muted-foreground">{a.industry || '\u2014'}</TableCell>
                  <TableCell className="py-3 text-[13px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      {(a.city || a.state) && <MapPin size={10} className="text-muted-foreground/50 shrink-0"/>}
                      {[a.city, a.state].filter(Boolean).join(', ') || '\u2014'}
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <InitialAvatar name={a.owner_name || '?'} size={6} />
                      <span className="text-[12px] text-muted-foreground">{a.owner_name || '\u2014'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-center">
                    <span className={cn('inline-flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-black',
                      a.opp_count > 0 ? 'bg-[#F26B4E]/12 text-[#F26B4E]' : 'bg-muted text-muted-foreground')}>
                      {a.opp_count || 0}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 font-bold text-[13px]" style={{ color: a.pipeline_value > 0 ? undefined : '#ccc' }}>
                    {a.pipeline_value > 0 ? inr(a.pipeline_value) : '\u2014'}
                  </TableCell>
                  <TableCell className="py-3"><StageBadge stage={a.latest_stage} /></TableCell>
                  <TableCell className="py-3 pr-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-orange-50 hover:text-[#F26B4E] rounded-lg">
                          <MoreHorizontal size={14}/>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem className="gap-2 text-sm"><Eye size={13}/>View</DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-sm"><Pencil size={13}/>Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="gap-2 text-sm text-red-600 focus:text-red-600 focus:bg-red-50"><Trash2 size={13}/>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Account Sheet */}
      <Sheet open={showAdd} onOpenChange={setShowAdd}>
        <SheetContent className="w-[440px] sm:max-w-[440px] overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-xl font-black">Add Account</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleAddAccount} className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Company Name *</Label>
              <Input value={form.company_name} onChange={e => set('company_name', e.target.value)}
                className="mt-1 focus-visible:ring-[#F26B4E]" placeholder="e.g. Bijlee Solar Pvt Ltd" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[['city','City','New Delhi'],['state','State','Delhi'],['website','Website','https://...'],['gstin','GSTIN','27AAAAA0000A1Z5']].map(([k,l,p]) => (
                <div key={k}>
                  <Label className="text-xs font-semibold text-muted-foreground">{l}</Label>
                  <Input value={form[k]} onChange={e => set(k, e.target.value)} className="mt-1 focus-visible:ring-[#F26B4E]" placeholder={p}
                    type={k === 'website' ? 'url' : 'text'} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Industry</Label>
                <Select value={form.industry} onValueChange={v => set('industry', v)}>
                  <SelectTrigger className="mt-1 focus:ring-[#F26B4E]"><SelectValue placeholder="— Select —"/></SelectTrigger>
                  <SelectContent>{INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Source</Label>
                <Select value={form.source} onValueChange={v => set('source', v)}>
                  <SelectTrigger className="mt-1 focus:ring-[#F26B4E]"><SelectValue placeholder="— Select —"/></SelectTrigger>
                  <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s.replace('_',' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Account Owner</Label>
              <Select value={form.owner_id} onValueChange={v => set('owner_id', v)}>
                <SelectTrigger className="mt-1 focus:ring-[#F26B4E]"><SelectValue placeholder="— Unassigned —"/></SelectTrigger>
                <SelectContent>{users.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {formErr && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">{formErr}</div>}
            <SheetFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)} className="rounded-lg">Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#F26B4E] hover:bg-[#E04D2E] text-white rounded-lg font-bold px-5">
                {saving ? 'Saving\u2026' : 'Save Account'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── CONTACTS TAB ──────────────────────────────────────────────────────────────
function ContactsTab({ accounts, contacts, refetch }) {
  const { can } = useAuth();
  const [search,    setSearch]    = useState('');
  const [filterAcc, setFilterAcc] = useState('all');
  const [showAdd,   setShowAdd]   = useState(false);
  const [form, setForm] = useState({ account_id:'', name:'', designation:'', email:'', phone:'', linkedin:'', notes:'', is_primary: false });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleAddContact(e) {
    e.preventDefault();
    if (!form.name.trim())    { setFormErr('Name is required'); return; }
    if (!form.account_id)     { setFormErr('Account is required'); return; }
    setSaving(true); setFormErr('');
    try {
      await bdApi.createContact({ ...form, account_id: parseInt(form.account_id) });
      setForm({ account_id:'', name:'', designation:'', email:'', phone:'', linkedin:'', notes:'', is_primary: false });
      setShowAdd(false);
      refetch();
    } catch (err) { setFormErr(err.message); }
    finally { setSaving(false); }
  }

  const filtered = useMemo(() => contacts.filter(c => {
    const s = !search || [c.name, c.designation, c.email, c.company_name].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const a = filterAcc === 'all' || !filterAcc || String(c.account_id) === filterAcc;
    return s && a;
  }), [contacts, search, filterAcc]);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <KpiChip label="Total Contacts"   value={contacts.length}                               icon={Users}     color="#F26B4E" />
        <KpiChip label="Accounts Covered" value={new Set(contacts.map(c => c.account_id)).size} icon={Building2} color="#3B82F6" />
        <KpiChip label="Primary Contacts" value={contacts.filter(c => c.is_primary).length}     icon={Star}      color="#F59E0B" />
      </div>

      {/* Search + filters */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"/>
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, designation…"
            className="pl-9 pr-8 h-9 text-sm bg-card border-border/50 rounded-xl"/>
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={12}/></button>}
        </div>
        <Select value={filterAcc} onValueChange={setFilterAcc}>
          <SelectTrigger className="w-48 h-9 text-sm rounded-xl border-border/50 bg-card">
            <SelectValue placeholder="All Accounts"/>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.company_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-[11px] text-muted-foreground ml-auto">{filtered.length} contacts</span>
        <Button onClick={() => setShowAdd(true)}
          className="bg-[#F26B4E] hover:bg-[#E04D2E] text-white font-bold rounded-xl h-9 px-4 gap-1.5 shadow-sm text-[13px]">
          <Plus size={14}/> Add Contact
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Users size={32} className="opacity-20"/>
          <p className="text-sm">{search || filterAcc ? 'No contacts match the filter.' : 'No contacts yet.'}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/50 overflow-hidden shadow-sm bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#2D2D2D] hover:bg-[#2D2D2D] border-0">
                {['Name','Account','Designation','Email','Phone',''].map((h,i) => (
                  <TableHead key={i} className="h-10 text-white/70 text-[10px] font-bold uppercase tracking-widest">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id} className="hover:bg-[#F26B4E]/[0.04] transition-colors border-border/30">
                  <TableCell className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <InitialAvatar name={c.name} size={8}/>
                      <div>
                        <div className="font-bold text-[13px] text-foreground flex items-center gap-1.5">
                          {c.name}
                          {c.is_primary && <Star size={11} fill="#F26B4E" color="#F26B4E"/>}
                        </div>
                        {c.notes && <div className="text-[11px] text-muted-foreground">{c.notes}</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-[13px] font-semibold text-foreground/70">{c.company_name || '\u2014'}</TableCell>
                  <TableCell className="py-3 text-[13px] text-muted-foreground">{c.designation || '\u2014'}</TableCell>
                  <TableCell className="py-3">
                    {c.email
                      ? <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-[13px] text-[#F26B4E] hover:underline"><Mail size={11}/>{c.email}</a>
                      : <span className="text-muted-foreground/40 text-sm">—</span>}
                  </TableCell>
                  <TableCell className="py-3">
                    {c.phone
                      ? <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"><Phone size={11}/>{c.phone}</a>
                      : <span className="text-muted-foreground/40 text-sm">—</span>}
                  </TableCell>
                  <TableCell className="py-3 pr-4 text-right">
                    {c.linkedin && <a href={c.linkedin} target="_blank" rel="noreferrer" className="text-[11px] text-blue-400 hover:underline font-semibold">LinkedIn ↗</a>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Contact Sheet */}
      <Sheet open={showAdd} onOpenChange={setShowAdd}>
        <SheetContent className="w-[440px] sm:max-w-[440px] overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-xl font-black">Add Contact</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleAddContact} className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Account *</Label>
              <Select value={form.account_id} onValueChange={v => set('account_id', v)}>
                <SelectTrigger className="mt-1 focus:ring-[#F26B4E]"><SelectValue placeholder="— Select account —"/></SelectTrigger>
                <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.company_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[['name','Full Name *','text'],['designation','Designation','text'],['email','Email','email'],['phone','Phone','tel'],['linkedin','LinkedIn URL','url']].map(([k,l,t]) => (
                <div key={k}>
                  <Label className="text-xs font-semibold text-muted-foreground">{l}</Label>
                  <Input type={t} value={form[k]} onChange={e => set(k, e.target.value)}
                    className="mt-1 focus-visible:ring-[#F26B4E]"/>
                </div>
              ))}
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Notes</Label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                className="mt-1 w-full px-3 py-2 rounded-md border border-input text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-[#F26B4E]/30 focus:border-[#F26B4E]" />
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer text-sm">
              <input type="checkbox" checked={form.is_primary} onChange={e => set('is_primary', e.target.checked)}
                className="w-4 h-4 accent-[#F26B4E]" />
              <span className="text-muted-foreground font-medium">Mark as primary contact</span>
            </label>
            {formErr && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">{formErr}</div>}
            <SheetFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)} className="rounded-lg">Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#F26B4E] hover:bg-[#E04D2E] text-white rounded-lg font-bold px-5">
                {saving ? 'Saving\u2026' : 'Save Contact'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── OPPORTUNITIES TAB ─────────────────────────────────────────────────────────
function OpportunitiesTab({ product, opps, accounts, contacts, users, refetch }) {
  const { can } = useAuth();
  const [view,        setView]        = useState('kanban');
  const [search,      setSearch]      = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [showAdd,     setShowAdd]     = useState(false);
  const [form, setForm] = useState({ account_id:'', contact_id:'', owner_id:'', title:'', scope_type:'', estimated_value:'' });
  const [saving,    setSaving]    = useState(false);
  const [formErr,   setFormErr]   = useState('');
  const [movingId,  setMovingId]  = useState(null);
  const [stageErr,  setStageErr]  = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  const accountContacts = contacts.filter(c => String(c.account_id) === form.account_id);

  async function handleAddOpp(e) {
    e.preventDefault();
    if (!form.title.trim()) { setFormErr('Title required'); return; }
    if (!form.account_id)   { setFormErr('Account required'); return; }
    setSaving(true); setFormErr('');
    try {
      await bdApi.createOpp({
        ...form,
        account_id:      parseInt(form.account_id),
        contact_id:      form.contact_id ? parseInt(form.contact_id) : null,
        owner_id:        form.owner_id   ? parseInt(form.owner_id)   : null,
        estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
        product_type:    product,
      });
      setForm({ account_id:'', contact_id:'', owner_id:'', title:'', scope_type:'', estimated_value:'' });
      setShowAdd(false);
      refetch();
    } catch (err) { setFormErr(err.message); }
    finally { setSaving(false); }
  }

  const handleStageChange = useCallback(async (oppId, newStage) => {
    if (movingId) return;
    setMovingId(oppId);
    setStageErr('');
    try {
      await bdApi.patchOpp(oppId, { stage: newStage });
      refetch();
    } catch (err) {
      setStageErr(err.message || 'Failed to move — try again');
    } finally {
      setMovingId(null);
    }
  }, [refetch, movingId]);

  const openOpps  = opps.filter(o => !o.closed_at && o.stage !== 'lost');
  const totalVal  = openOpps.reduce((s,o) => s + parseFloat(o.estimated_value||0), 0);
  const staleCount = openOpps.filter(o => o.stale).length;

  const filtered = opps.filter(o => {
    const s = !search || [o.company_name, o.title, o.owner_name].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const st = stageFilter === 'all' || !stageFilter || o.stage === stageFilter;
    return s && st;
  });

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <KpiChip label="Open Deals"   value={openOpps.length}  icon={Briefcase}   color="#F26B4E" />
        <KpiChip label="Pipeline"     value={inr(totalVal)}    icon={TrendingUp}  color="#3B82F6" />
        <KpiChip label="Stale Deals"  value={staleCount}       icon={AlertTriangle} color={staleCount > 0 ? '#ef4444' : '#10b981'} />
      </div>

      {/* Controls */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"/>
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search company, title, owner…"
            className="pl-9 h-9 text-sm bg-card border-border/50 rounded-xl"/>
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-40 h-9 text-sm rounded-xl border-border/50 bg-card">
            <SelectValue placeholder="All Stages"/>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {STAGES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {/* View toggle */}
        <div className="flex border border-border/50 rounded-lg overflow-hidden bg-card">
          {[['kanban', LayoutGrid], ['table', List]].map(([v, Icon]) => (
            <button key={v} onClick={() => setView(v)}
              className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all',
                view === v ? 'bg-[#F26B4E] text-white' : 'text-muted-foreground hover:text-foreground')}>
              <Icon size={13}/>{v.charAt(0).toUpperCase()+v.slice(1)}
            </button>
          ))}
        </div>
        <Button onClick={() => setShowAdd(true)}
          className="bg-[#F26B4E] hover:bg-[#E04D2E] text-white font-bold rounded-xl h-9 px-4 gap-1.5 shadow-sm text-[13px]">
          <Plus size={14}/> Add Opportunity
        </Button>
      </div>

      {stageErr && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-700 font-semibold">
          <AlertTriangle size={13}/> {stageErr}
          <button onClick={() => setStageErr('')} className="ml-auto text-red-400 hover:text-red-600"><X size={12}/></button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Briefcase size={32} className="opacity-20"/>
          <p className="text-sm">{search || stageFilter ? 'No opportunities match.' : 'No opportunities yet.'}</p>
        </div>
      ) : view === 'kanban' ? (
        /* Kanban */
        <div className="flex gap-3 overflow-x-auto pb-2">
          {STAGES.filter(s => s.key !== 'lost').map(s => {
            const cols = filtered.filter(o => o.stage === s.key);
            const colVal = cols.reduce((sum,o) => sum + parseFloat(o.estimated_value||0), 0);
            return (
              <div key={s.key} style={{ minWidth: 210, flex: '0 0 210px' }}>
                <div className="rounded-t-xl px-3 py-2 border-b-2" style={{ background: s.bg, borderColor: s.color }}>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: s.color }}>{s.label}</span>
                    <span className="text-[10px] font-black text-white w-5 h-5 rounded-full flex items-center justify-center" style={{ background: s.color }}>{cols.length}</span>
                  </div>
                  {colVal > 0 && <div className="text-[10px] font-semibold mt-0.5" style={{ color: s.color }}>{inr(colVal)}</div>}
                </div>
                <div className="bg-muted/40 rounded-b-xl p-2 min-h-[80px] border border-t-0" style={{ borderColor: s.color + '20' }}>
                  {cols.length === 0
                    ? <div className="text-[11px] text-muted-foreground text-center py-3">Empty</div>
                    : cols.map(o => {
                        const daysSilent = o.last_activity_at ? daysSince(o.last_activity_at) : null;
                        const nextStage  = STAGES[STAGES.findIndex(st => st.key === o.stage) + 1];
                        return (
                          <div key={o.id} className="bg-card rounded-lg p-3 mb-2 border border-border/40 shadow-sm"
                            style={{ borderLeft: `3px solid ${s.color}` }}>
                            <div className="text-[12px] font-bold text-foreground mb-0.5 flex items-center gap-1">
                              {o.company_name}
                              {o.stale && <AlertTriangle size={10} color="#ef4444"/>}
                            </div>
                            <div className="text-[11px] text-muted-foreground mb-2">{o.title}</div>
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-[12px] font-black text-[#F26B4E]">{o.estimated_value ? inr(o.estimated_value) : '\u2014'}</span>
                              {o.scope_type && <span className="text-[9px] font-bold uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{SCOPE_LABELS[o.scope_type]??o.scope_type}</span>}
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px]" style={{ color: daysSilent > 7 ? '#ef4444' : '#aaa' }}>
                                {daysSilent != null ? `${daysSilent}d silent` : 'No activity'}
                              </span>
                              {o.next_action_date && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-blue-400 flex items-center gap-0.5"><Calendar size={9}/>{date(o.next_action_date)}</span>
                                  <AddToCalendar title={`Follow-up: ${o.company_name}`} dateStr={o.next_action_date}
                                    description={`Stage: ${o.stage}`} size="sm" label="+"/>
                                </div>
                              )}
                            </div>
                            {nextStage && o.stage !== 'lost' && (
                              <button onClick={() => handleStageChange(o.id, nextStage.key)}
                                disabled={movingId === o.id}
                                className="mt-2 w-full py-1 rounded text-[10px] font-bold border border-dashed transition-colors disabled:opacity-50 disabled:cursor-wait"
                                style={{ borderColor: nextStage.color, color: nextStage.color }}>
                                {movingId === o.id ? 'Moving…' : `Move → ${nextStage.label}`}
                              </button>
                            )}
                          </div>
                        );
                      })
                  }
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table view */
        <div className="rounded-2xl border border-border/50 overflow-hidden shadow-sm bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#2D2D2D] hover:bg-[#2D2D2D] border-0">
                {['Opportunity','Account','Scope','Value','Stage','Owner','Silent','Next Action'].map(h => (
                  <TableHead key={h} className="h-10 text-white/70 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(o => {
                const sc = stageConfig(o.stage);
                const daysSilent = o.last_activity_at ? daysSince(o.last_activity_at) : null;
                return (
                  <TableRow key={o.id} className="hover:bg-[#F26B4E]/[0.04] transition-colors border-border/30">
                    <TableCell className="py-3 px-4">
                      <div className="font-bold text-[13px] text-foreground flex items-center gap-1.5">
                        {o.title}{o.stale && <AlertTriangle size={11} color="#ef4444"/>}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">{o.opp_id}</div>
                    </TableCell>
                    <TableCell className="py-3 text-[13px] font-semibold text-foreground/70">{o.company_name}</TableCell>
                    <TableCell className="py-3 text-[12px] text-muted-foreground">{SCOPE_LABELS[o.scope_type]??o.scope_type??'\u2014'}</TableCell>
                    <TableCell className="py-3 font-bold text-[13px]">{o.estimated_value ? inr(o.estimated_value) : <span className="text-muted-foreground/40">—</span>}</TableCell>
                    <TableCell className="py-3"><StageBadge stage={o.stage}/></TableCell>
                    <TableCell className="py-3 text-[13px] text-muted-foreground">{o.owner_name??'\u2014'}</TableCell>
                    <TableCell className="py-3 text-[13px]" style={{ color: daysSilent > 7 ? '#ef4444' : undefined, fontWeight: daysSilent > 7 ? 700 : 400 }}>
                      {daysSilent != null ? `${daysSilent}d` : '\u2014'}
                    </TableCell>
                    <TableCell className="py-3 text-[12px]">
                      {o.next_action_date
                        ? <div className="flex items-center gap-2"><span className="text-blue-400 font-semibold">{date(o.next_action_date)}</span>
                            <AddToCalendar title={`Follow-up: ${o.company_name}`} dateStr={o.next_action_date} description={`Stage: ${o.stage}`} size="sm"/>
                          </div>
                        : <span className="text-muted-foreground/40">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Opportunity Sheet */}
      <Sheet open={showAdd} onOpenChange={setShowAdd}>
        <SheetContent className="w-[440px] sm:max-w-[440px] overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-xl font-black">Add Opportunity</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleAddOpp} className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Opportunity Title *</Label>
              <Input value={form.title} onChange={e => set('title', e.target.value)}
                placeholder="e.g. SunSure 500kWh BESS" className="mt-1 focus-visible:ring-[#F26B4E]"/>
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Account *</Label>
              <Select value={form.account_id} onValueChange={v => { set('account_id', v); set('contact_id',''); }}>
                <SelectTrigger className="mt-1 focus:ring-[#F26B4E]"><SelectValue placeholder="— Select account —"/></SelectTrigger>
                <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.company_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Contact</Label>
                <Select value={form.contact_id} onValueChange={v => set('contact_id', v)} disabled={!form.account_id}>
                  <SelectTrigger className="mt-1 focus:ring-[#F26B4E]"><SelectValue placeholder="— Select —"/></SelectTrigger>
                  <SelectContent>{accountContacts.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">BD Owner</Label>
                <Select value={form.owner_id} onValueChange={v => set('owner_id', v)}>
                  <SelectTrigger className="mt-1 focus:ring-[#F26B4E]"><SelectValue placeholder="— Unassigned —"/></SelectTrigger>
                  <SelectContent>{users.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Scope Type</Label>
                <Select value={form.scope_type} onValueChange={v => set('scope_type', v)}>
                  <SelectTrigger className="mt-1 focus:ring-[#F26B4E]"><SelectValue placeholder="— Select —"/></SelectTrigger>
                  <SelectContent>{SCOPE_TYPES.map(s => <SelectItem key={s} value={s}>{SCOPE_LABELS[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Estimated Value (₹)</Label>
                <Input type="number" value={form.estimated_value} onChange={e => set('estimated_value', e.target.value)}
                  placeholder="e.g. 1500000" className="mt-1 focus-visible:ring-[#F26B4E]"/>
              </div>
            </div>
            {formErr && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">{formErr}</div>}
            <SheetFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)} className="rounded-lg">Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#F26B4E] hover:bg-[#E04D2E] text-white rounded-lg font-bold px-5">
                {saving ? 'Saving\u2026' : 'Create Opportunity'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BDPipeline({ product = 'bess' }) {
  const { opps: oppsRes, accounts: accountsRes, contacts: contactsRes, users: usersRes, loading, error, refetch } = useApiMulti({
    opps:     () => bdApi.opps({ product_type: product }),
    accounts: () => bdApi.accounts({ product_type: product }),
    contacts: bdApi.contacts,
    users:    bdApi.users,
  }, [product]);

  if (loading) return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-40 rounded-xl"/>
        <Skeleton className="h-9 w-32 rounded-xl"/>
      </div>
      <div className="grid grid-cols-3 gap-3">{[...Array(3)].map((_,i) => <Skeleton key={i} className="h-20 rounded-xl"/>)}</div>
      <Skeleton className="h-10 rounded-xl"/>
      <Skeleton className="h-64 rounded-2xl"/>
    </div>
  );
  if (error) return <ErrorBanner message={error}/>;

  const opps     = oppsRes?.data     ?? [];
  const accounts = accountsRes?.data ?? [];
  const contacts = contactsRes?.data ?? [];
  const users    = usersRes?.data    ?? [];

  const openOpps = opps.filter(o => o.stage !== 'lost' && !o.closed_at);
  const label    = product === 'epc' ? 'Solar EPC' : 'BESS';

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-foreground tracking-tight">Pipeline</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {BD_LEADS.length} leads tracked · {accounts.length} accounts · {openOpps.length} open deals
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="leads" className="w-full">
        <TabsList className="h-10 bg-card border border-border/50 rounded-xl p-1 gap-0.5 shadow-sm">
          <TabsTrigger value="leads"
            className="rounded-lg text-[12.5px] font-bold data-[state=active]:bg-[#F26B4E] data-[state=active]:text-white data-[state=active]:shadow-sm transition-all px-4 flex items-center gap-1.5">
            <Users size={13}/> BD Leads
            <span className="ml-1 text-[10px] bg-current/20 px-1.5 py-0.5 rounded-full">{BD_LEADS.length}</span>
          </TabsTrigger>
          <TabsTrigger value="accounts"
            className="rounded-lg text-[12.5px] font-bold data-[state=active]:bg-[#F26B4E] data-[state=active]:text-white data-[state=active]:shadow-sm transition-all px-4 flex items-center gap-1.5">
            <Building2 size={13}/> Accounts
            <span className="ml-1 text-[10px] bg-current/20 px-1.5 py-0.5 rounded-full">{accounts.length}</span>
          </TabsTrigger>
          <TabsTrigger value="contacts"
            className="rounded-lg text-[12.5px] font-bold data-[state=active]:bg-[#F26B4E] data-[state=active]:text-white data-[state=active]:shadow-sm transition-all px-4 flex items-center gap-1.5">
            <Users size={13}/> Contacts
            <span className="ml-1 text-[10px] bg-current/20 px-1.5 py-0.5 rounded-full">{contacts.length}</span>
          </TabsTrigger>
          <TabsTrigger value="opportunities"
            className="rounded-lg text-[12.5px] font-bold data-[state=active]:bg-[#F26B4E] data-[state=active]:text-white data-[state=active]:shadow-sm transition-all px-4 flex items-center gap-1.5">
            <Briefcase size={13}/> Opportunities
            <span className="ml-1 text-[10px] bg-current/20 px-1.5 py-0.5 rounded-full">{openOpps.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-5">
          <AddLeadButton refetch={refetch} users={users}/>
          <LeadsTab/>
        </TabsContent>
        <TabsContent value="accounts" className="mt-5">
          <AccountsTab product={product} accounts={accounts} users={users} refetch={refetch}/>
        </TabsContent>
        <TabsContent value="contacts" className="mt-5">
          <ContactsTab accounts={accounts} contacts={contacts} refetch={refetch}/>
        </TabsContent>
        <TabsContent value="opportunities" className="mt-5">
          <OpportunitiesTab product={product} opps={opps} accounts={accounts} contacts={contacts} users={users} refetch={refetch}/>
        </TabsContent>
      </Tabs>
    </div>
  );
}
