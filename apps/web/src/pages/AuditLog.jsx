import { useState, useMemo } from 'react';
import { useApi } from '../hooks/useApi.js';
import { bdApi } from '../lib/api.js';
import { date } from '../lib/fmt.js';
import { ErrorBanner, Empty } from '../components/Spinner.jsx';
import { Skeleton } from '../components/ui/skeleton.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Input } from '../components/ui/input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select.jsx';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table.jsx';
import { ClipboardList, Search, RefreshCw, User, Package, Activity } from 'lucide-react';
import { Button } from '../components/ui/button.jsx';
import { cn } from '../lib/utils.js';

const ACTION_COLORS = {
  create: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  update: { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'    },
  delete: { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200'     },
};

const RESOURCE_ICONS = {
  accounts:      <Package className="h-3.5 w-3.5" />,
  contacts:      <User    className="h-3.5 w-3.5" />,
  opportunities: <Activity className="h-3.5 w-3.5" />,
  approvals:     <ClipboardList className="h-3.5 w-3.5" />,
  proposals:     <ClipboardList className="h-3.5 w-3.5" />,
};

function ActionBadge({ action }) {
  const c = ACTION_COLORS[action] ?? { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wide', c.bg, c.text, c.border)}>
      {action}
    </span>
  );
}

function ResourceChip({ resource }) {
  const icon = RESOURCE_ICONS[resource] ?? <Package className="h-3.5 w-3.5" />;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      {icon}
      <span className="capitalize">{resource?.replace(/_/g, ' ')}</span>
    </span>
  );
}

function DetailCell({ details }) {
  if (!details || Object.keys(details).length === 0) return <span className="text-muted-foreground text-xs">—</span>;
  const entries = Object.entries(details);
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-1 bg-slate-100 rounded px-1.5 py-0.5 text-[11px] text-slate-600">
          <span className="font-medium">{k}:</span>
          <span className="truncate max-w-[120px]">{String(v)}</span>
        </span>
      ))}
    </div>
  );
}

function formatDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export default function AuditLog() {
  const [search,   setSearch]   = useState('');
  const [resource, setResource] = useState('all');
  const [action,   setAction]   = useState('all');

  const { data: logs, loading, error, refetch } = useApi(
    () => bdApi.auditLog(),
    []
  );

  const filtered = useMemo(() => {
    if (!logs) return [];
    return logs.filter(row => {
      if (resource !== 'all' && row.resource !== resource) return false;
      if (action   !== 'all' && row.action   !== action)   return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          row.user_name?.toLowerCase().includes(q) ||
          row.resource?.toLowerCase().includes(q)  ||
          row.action?.toLowerCase().includes(q)    ||
          String(row.resource_id ?? '').includes(q)
        );
      }
      return true;
    });
  }, [logs, resource, action, search]);

  const resources = useMemo(() => {
    if (!logs) return [];
    return [...new Set(logs.map(r => r.resource).filter(Boolean))].sort();
  }, [logs]);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <ClipboardList className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Audit Log</h1>
            <p className="text-sm text-muted-foreground">All create and update actions across BD</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refetch} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9"
            placeholder="Search user, resource..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={resource} onValueChange={setResource}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Resource" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All resources</SelectItem>
            {resources.map(r => (
              <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">
          {loading ? '' : `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Error */}
      {error && <ErrorBanner message={error} />}

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-44">Timestamp</TableHead>
              <TableHead className="w-32">User</TableHead>
              <TableHead className="w-24">Action</TableHead>
              <TableHead className="w-36">Resource</TableHead>
              <TableHead className="w-24">ID</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <Empty message="No audit log entries found" />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(row => (
                <TableRow key={row.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(row.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center text-[10px] font-bold text-orange-700">
                        {(row.user_name ?? 'S').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium truncate max-w-[80px]">{row.user_name ?? 'system'}</span>
                    </div>
                  </TableCell>
                  <TableCell><ActionBadge action={row.action} /></TableCell>
                  <TableCell><ResourceChip resource={row.resource} /></TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{row.resource_id ?? '—'}</TableCell>
                  <TableCell><DetailCell details={row.details} /></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
