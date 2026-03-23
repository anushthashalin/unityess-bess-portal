import { useState, useMemo, useCallback } from 'react';
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
  Calendar, LayoutGrid, List, Users, Briefcase,
} from 'lucide-react';
import { cn } from '../lib/utils.js';
import AddToCalendar from '../components/AddToCalendar.jsx';

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
  return STAGES.find(s => s.key === key) ?? { color:'#aaa', bg:'#f5f5f5', label: key ?? '—' };
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

// ── ACCOUNTS TAB ─────────────────────────────────────────────────────────────
function AccountsTab({ product, accounts, users, refetch }) {
  const [search,    setSearch]    = useState('');
  const [industry,  setIndustry]  = useState('');
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
      (!industry || a.industry === industry)
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
          {['', ...industries.slice(0,4)].map(ind => (
            <button key={ind||'all'} onClick={() => setIndustry(ind)}
              className={cn('px-3 py-1 rounded-full text-[11px] font-bold border transition-all',
                industry === ind ? 'bg-[#F26B4E] text-white border-[#F26B4E]' : 'bg-card text-muted-foreground border-border/50 hover:border-[#F26B4E] hover:text-[#F26B4E]')}>
              {ind || 'All'}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground ml-auto">{filtered.length} of {accounts.length}</span>
        <Button onClick={() => setShowAdd(true)}
          className="bg-[#F26B4E] hover:bg-[#E04D2E] text-white font-bold rounded-xl h-9 px-4 gap-1.5 shadow-sm text-[13px]">
          <Plus size={14}/> Add Account
        </Button>
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
                  <TableCell className="py-3 text-[13px] text-muted-foreground">{a.industry || '—'}</TableCell>
                  <TableCell className="py-3 text-[13px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      {(a.city || a.state) && <MapPin size={10} className="text-muted-foreground/50 shrink-0"/>}
                      {[a.city, a.state].filter(Boolean).join(', ') || '—'}
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <InitialAvatar name={a.owner_name || '?'} size={6} />
                      <span className="text-[12px] text-muted-foreground">{a.owner_name || '—'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-center">
                    <span className={cn('inline-flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-black',
                      a.opp_count > 0 ? 'bg-[#F26B4E]/12 text-[#F26B4E]' : 'bg-muted text-muted-foreground')}>
                      {a.opp_count || 0}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 font-bold text-[13px]" style={{ color: a.pipeline_value > 0 ? undefined : '#ccc' }}>
                    {a.pipeline_value > 0 ? inr(a.pipeline_value) : '—'}
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
                {saving ? 'Saving…' : 'Save Account'}
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
  const [search,    setSearch]    = useState('');
  const [filterAcc, setFilterAcc] = useState('');
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
    const a = !filterAcc || String(c.account_id) === filterAcc;
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
        <Select value={filterAcc || '__all__'} onValueChange={v => setFilterAcc(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-48 h-9 text-sm rounded-xl border-border/50 bg-card">
            <SelectValue placeholder="All Accounts"/>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Accounts</SelectItem>
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
                  <TableCell className="py-3 text-[13px] font-semibold text-foreground/70">{c.company_name || '—'}</TableCell>
                  <TableCell className="py-3 text-[13px] text-muted-foreground">{c.designation || '—'}</TableCell>
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
                {saving ? 'Saving…' : 'Save Contact'}
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
  const [view,        setView]        = useState('kanban');
  const [search,      setSearch]      = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [showAdd,     setShowAdd]     = useState(false);
  const [form, setForm] = useState({ account_id:'', contact_id:'', owner_id:'', title:'', scope_type:'', estimated_value:'' });
  const [saving,  setSaving]  = useState(false);
  const [formErr, setFormErr] = useState('');

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
    try { await bdApi.patchOpp(oppId, { stage: newStage }); refetch(); } catch (_) {}
  }, [refetch]);

  const openOpps  = opps.filter(o => !o.closed_at && o.stage !== 'lost');
  const totalVal  = openOpps.reduce((s,o) => s + parseFloat(o.estimated_value||0), 0);
  const staleCount = openOpps.filter(o => o.stale).length;

  const filtered = opps.filter(o => {
    const s = !search || [o.company_name, o.title, o.owner_name].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const st = !stageFilter || o.stage === stageFilter;
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
        <Select value={stageFilter || '__all__'} onValueChange={v => setStageFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-40 h-9 text-sm rounded-xl border-border/50 bg-card">
            <SelectValue placeholder="All Stages"/>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Stages</SelectItem>
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
                              <span className="text-[12px] font-black text-[#F26B4E]">{o.estimated_value ? inr(o.estimated_value) : '—'}</span>
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
                                className="mt-2 w-full py-1 rounded text-[10px] font-bold border border-dashed transition-colors"
                                style={{ borderColor: nextStage.color, color: nextStage.color }}>
                                Move → {nextStage.label}
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
                    <TableCell className="py-3 text-[12px] text-muted-foreground">{SCOPE_LABELS[o.scope_type]??o.scope_type??'—'}</TableCell>
                    <TableCell className="py-3 font-bold text-[13px]">{o.estimated_value ? inr(o.estimated_value) : <span className="text-muted-foreground/40">—</span>}</TableCell>
                    <TableCell className="py-3"><StageBadge stage={o.stage}/></TableCell>
                    <TableCell className="py-3 text-[13px] text-muted-foreground">{o.owner_name??'—'}</TableCell>
                    <TableCell className="py-3 text-[13px]" style={{ color: daysSilent > 7 ? '#ef4444' : undefined, fontWeight: daysSilent > 7 ? 700 : 400 }}>
                      {daysSilent != null ? `${daysSilent}d` : '—'}
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
                {saving ? 'Saving…' : 'Create Opportunity'}
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
            {accounts.length} accounts · {contacts.length} contacts · {openOpps.length} open deals
            {product === 'bess' ? ' · BESS Sizing' : ' · Solar EPC'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="accounts" className="w-full">
        <TabsList className="h-10 bg-card border border-border/50 rounded-xl p-1 gap-0.5 shadow-sm">
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
