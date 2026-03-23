import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { bdApi } from '../lib/api.js';
import { inr } from '../lib/fmt.js';
import {
  Upload, Table2, CheckCircle, AlertCircle, XCircle,
  ChevronRight, RefreshCw, FileSpreadsheet, Info,
} from 'lucide-react';

// ── Import type config ────────────────────────────────────────────────────────
const IMPORT_TYPES = {
  accounts: {
    label: 'Accounts',
    description: 'Companies / clients in your pipeline',
    color: '#3b82f6',
    requiredCols: ['company_name'],
    allCols: ['company_name', 'industry', 'city', 'state', 'website', 'gstin', 'source', 'owner_name'],
    colHints: {
      company_name: 'Company name (required, must be unique)',
      industry:     'e.g. Manufacturing, Real Estate, Hospitality',
      city:         'City',
      state:        'State (e.g. Maharashtra, Delhi)',
      website:      'https://...',
      gstin:        '15-char GSTIN',
      source:       'How you found them (e.g. Referral, LinkedIn)',
      owner_name:   'BD owner — must match a user in the system',
    },
    templateRows: [
      ['company_name', 'industry', 'city', 'state', 'website', 'gstin', 'source', 'owner_name'],
      ['Amrita Hospital', 'Healthcare', 'Faridabad', 'Haryana', 'https://amritahospitals.in', '', 'Referral', 'Kedar Bala'],
      ['SunSure Energy', 'Renewable Energy', 'Mumbai', 'Maharashtra', '', '', 'Conference', ''],
    ],
  },
  contacts: {
    label: 'Contacts',
    description: 'People at accounts — accounts must be imported first',
    color: '#8b5cf6',
    requiredCols: ['company_name', 'name'],
    allCols: ['company_name', 'name', 'designation', 'email', 'phone', 'is_primary', 'linkedin'],
    colHints: {
      company_name: 'Must match an existing account (case-insensitive)',
      name:         'Full name (required)',
      designation:  'Job title / role',
      email:        'Work email',
      phone:        'Mobile / work number',
      is_primary:   'true / false — mark as the main contact for this account',
      linkedin:     'LinkedIn profile URL',
    },
    templateRows: [
      ['company_name', 'name', 'designation', 'email', 'phone', 'is_primary', 'linkedin'],
      ['Amrita Hospital', 'Rajesh Kumar', 'VP Operations', 'rajesh@amritahospitals.in', '9876543210', 'true', ''],
      ['SunSure Energy', 'Priya Sharma', 'CFO', 'priya@sunsure.in', '9123456789', 'true', 'https://linkedin.com/in/priya'],
    ],
  },
  opportunities: {
    label: 'Opportunities',
    description: 'Deals — accounts (and optionally contacts) must exist first',
    color: '#F26B4E',
    requiredCols: ['company_name', 'title'],
    allCols: ['company_name', 'title', 'contact_email', 'owner_name', 'scope_type', 'estimated_value', 'stage', 'next_action_date'],
    colHints: {
      company_name:     'Must match an existing account',
      title:            'Opportunity title (required)',
      contact_email:    'Must match an existing contact email',
      owner_name:       'BD owner name — must match a system user',
      scope_type:       'supply_only | dc_block_pcs | rms_order | supply_install | tpc',
      estimated_value:  'Numeric value in ₹ (ex-GST). Commas and ₹ symbol are stripped.',
      stage:            'first_connect | requirement_captured | proposal_sent | technical_closure | commercial_negotiation | po_received | lost',
      next_action_date: 'YYYY-MM-DD',
    },
    templateRows: [
      ['company_name', 'title', 'contact_email', 'owner_name', 'scope_type', 'estimated_value', 'stage', 'next_action_date'],
      ['Amrita Hospital', '500kWh Behind-the-meter BESS', 'rajesh@amritahospitals.in', 'Kedar Bala', 'supply_install', '3500000', 'proposal_sent', '2026-03-25'],
      ['SunSure Energy', '1MWh C&I Storage Project', '', '', 'supply_only', '8000000', 'requirement_captured', ''],
    ],
  },
};

// ── Parse pasted text (TSV from Google Sheets or CSV) ─────────────────────────
function parsePaste(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  // Detect delimiter: tab (Sheets copy) or comma
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  const parseRow = line => {
    if (delimiter === '\t') return line.split('\t').map(v => v.trim());
    // Simple CSV parse (handles quoted fields)
    const result = [];
    let inQuote = false;
    let cur = '';
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const rows = lines.slice(1).map(line => {
    const vals = parseRow(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  }).filter(r => Object.values(r).some(v => v));  // skip fully empty rows

  return { headers, rows };
}

// ── Download template as TSV ──────────────────────────────────────────────────
function downloadTemplate(type) {
  const { templateRows } = IMPORT_TYPES[type];
  const tsv = templateRows.map(r => r.join('\t')).join('\n');
  const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `import_${type}_template.tsv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Column mapping row ────────────────────────────────────────────────────────
function ColMapper({ parsedHeaders, mapping, onMapping, importType }) {
  const { allCols, requiredCols, colHints } = IMPORT_TYPES[importType];

  return (
    <div style={{
      background: '#fafafa', border: '1px solid hsl(var(--border))', borderRadius: 10,
      padding: '16px 20px', marginBottom: 20,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase',
        letterSpacing: '0.5px', marginBottom: 12 }}>
        Column Mapping
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
        {allCols.map(col => {
          const required = requiredCols.includes(col);
          const mapped   = mapping[col];
          return (
            <div key={col} style={{ background: 'hsl(var(--card))', border: `1px solid ${required && !mapped ? '#fecaca' : '#e5e7eb'}`, borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--foreground))' }}>{col}</span>
                {required && <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', background: '#fef2f2', padding: '1px 5px', borderRadius: 4 }}>REQUIRED</span>}
              </div>
              <select
                value={mapped ?? ''}
                onChange={e => onMapping(col, e.target.value || null)}
                style={{
                  width: '100%', padding: '5px 8px', borderRadius: 6,
                  border: '1px solid hsl(var(--border))', fontSize: 12,
                  fontFamily: "'Chivo', sans-serif", background: 'hsl(var(--card))',
                }}
              >
                <option value="">— Not mapped —</option>
                {parsedHeaders.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 4, lineHeight: 1.4 }}>
                {colHints[col]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Preview table ─────────────────────────────────────────────────────────────
function PreviewTable({ rows, mapping, importType, maxRows = 50 }) {
  const { allCols, requiredCols } = IMPORT_TYPES[importType];
  const activeCols = allCols.filter(col => mapping[col]);
  const preview    = rows.slice(0, maxRows);

  const getCellValue = (row, col) => {
    const srcCol = mapping[col];
    if (!srcCol) return '';
    return row[srcCol] ?? '';
  };

  const isRowValid = (row) =>
    requiredCols.every(col => {
      const val = getCellValue(row, col);
      return val && val.trim();
    });

  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid hsl(var(--border))', marginBottom: 20 }}>
      <div style={{ padding: '10px 16px', background: '#fafafa', borderBottom: '1px solid #e5e7eb',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--muted-foreground))' }}>
          Preview — {rows.length} rows {rows.length > maxRows && `(showing first ${maxRows})`}
        </span>
        <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
          <span style={{ color: '#16a34a', fontWeight: 700 }}>
            ✓ {preview.filter(isRowValid).length} valid
          </span>
          <span style={{ color: '#ef4444', fontWeight: 700 }}>
            ✗ {preview.filter(r => !isRowValid(r)).length} invalid
          </span>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#2D2D2D' }}>
            <th style={{ padding: '8px 12px', color: 'hsl(var(--muted-foreground))', fontWeight: 700, fontSize: 10, textAlign: 'left', width: 32 }}>#</th>
            <th style={{ padding: '8px 12px', color: 'hsl(var(--muted-foreground))', fontWeight: 700, fontSize: 10, textAlign: 'left', width: 40 }}>OK</th>
            {activeCols.map(col => (
              <th key={col} style={{ padding: '8px 12px', color: '#ccc', fontWeight: 700, fontSize: 10,
                textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.map((row, i) => {
            const valid = isRowValid(row);
            return (
              <tr key={i} style={{ borderBottom: '1px solid #f0f0f0', background: valid ? '#fff' : '#fef2f2' }}>
                <td style={{ padding: '7px 12px', color: '#aaa', fontSize: 11 }}>{i + 1}</td>
                <td style={{ padding: '7px 12px' }}>
                  {valid
                    ? <CheckCircle size={13} color="#16a34a" />
                    : <XCircle    size={13} color="#ef4444" />
                  }
                </td>
                {activeCols.map(col => {
                  const val = getCellValue(row, col);
                  const missing = requiredCols.includes(col) && !val?.trim();
                  return (
                    <td key={col} style={{
                      padding: '7px 12px',
                      color: missing ? '#ef4444' : 'hsl(var(--foreground))',
                      fontWeight: missing ? 700 : 400,
                      maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {val || <span style={{ color: '#ddd' }}>—</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Result banner ─────────────────────────────────────────────────────────────
function ResultBanner({ result, onReset }) {
  const hasErrors = result.errors?.length > 0;
  return (
    <div style={{
      borderRadius: 10, border: `1px solid ${hasErrors ? '#fde68a' : '#bbf7d0'}`,
      background: hasErrors ? '#fffbeb' : '#f0fdf4',
      padding: '20px 24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: hasErrors ? 16 : 0 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: hasErrors ? '#fef3c7' : '#dcfce7',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {hasErrors
            ? <AlertCircle size={22} color="#d97706" />
            : <CheckCircle size={22} color="#16a34a" />
          }
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'hsl(var(--foreground))' }}>
            Import complete — {result.imported} imported, {result.skipped} skipped
          </div>
          <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
            {hasErrors ? `${result.errors.length} row(s) had errors — see below` : 'All rows processed successfully'}
          </div>
        </div>
        <button
          onClick={onReset}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', border: '1px solid hsl(var(--border))', borderRadius: 8,
            background: 'hsl(var(--card))', cursor: 'pointer', fontSize: 12, fontWeight: 700,
            fontFamily: "'Chivo', sans-serif", flexShrink: 0,
          }}
        >
          <RefreshCw size={12} /> Import More
        </button>
      </div>

      {hasErrors && (
        <div style={{ marginTop: 12, background: 'hsl(var(--card))', borderRadius: 8, border: '1px solid #fde68a', overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px', background: '#fef3c7', fontSize: 11, fontWeight: 700, color: '#92400e',
            textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Row Errors
          </div>
          {result.errors.map((e, i) => (
            <div key={i} style={{
              padding: '8px 14px', fontSize: 12, borderBottom: i < result.errors.length - 1 ? '1px solid #fef3c7' : 'none',
              display: 'flex', gap: 12,
            }}>
              <span style={{ fontWeight: 700, color: '#d97706', flexShrink: 0 }}>Row {e.row}</span>
              <span style={{ color: 'hsl(var(--muted-foreground))' }}>{e.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BDImport() {
  const { can } = useAuth();

  if (!can('import')) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-32 text-center gap-3">
        <div className="text-4xl">🔒</div>
        <p className="text-lg font-bold text-foreground">Access Restricted</p>
        <p className="text-sm text-muted-foreground">Sheets Import is only available to admins.</p>
      </div>
    );
  }

  const [importType, setImportType] = useState('accounts');
  const [pasteText,  setPasteText]  = useState('');
  const [parsed,     setParsed]     = useState(null);   // { headers, rows }
  const [mapping,    setMapping]    = useState({});
  const [importing,  setImporting]  = useState(false);
  const [result,     setResult]     = useState(null);
  const [step,       setStep]       = useState('paste'); // 'paste' | 'map' | 'preview' | 'done'

  const cfg = IMPORT_TYPES[importType];

  // Auto-map columns when parsing
  function handleParse() {
    const p = parsePaste(pasteText);
    if (p.rows.length === 0) return;
    setParsed(p);

    // Try to auto-map: exact match or close match
    const autoMap = {};
    cfg.allCols.forEach(col => {
      const exact = p.headers.find(h => h === col);
      const fuzzy = p.headers.find(h => h.includes(col) || col.includes(h));
      autoMap[col] = exact ?? fuzzy ?? null;
    });
    setMapping(autoMap);
    setStep('map');
  }

  function handleTypeChange(t) {
    setImportType(t);
    setPasteText('');
    setParsed(null);
    setMapping({});
    setResult(null);
    setStep('paste');
  }

  function handleReset() {
    setPasteText('');
    setParsed(null);
    setMapping({});
    setResult(null);
    setStep('paste');
  }

  const mappedRows = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.map(row => {
      const out = {};
      cfg.allCols.forEach(col => {
        const src = mapping[col];
        if (src) out[col] = row[src] ?? '';
      });
      return out;
    });
  }, [parsed, mapping, cfg]);

  async function handleImport() {
    setImporting(true);
    try {
      const endpoint = {
        accounts:     bdApi.importAccounts,
        contacts:     bdApi.importContacts,
        opportunities: bdApi.importOpportunities,
      }[importType];

      const res = await endpoint(mappedRows);
      setResult(res);
      setStep('done');
    } catch (e) {
      setResult({ imported: 0, skipped: mappedRows.length, errors: [{ row: 0, message: e.message }] });
      setStep('done');
    } finally {
      setImporting(false);
    }
  }

  const validRowCount = useMemo(() => {
    if (!parsed) return 0;
    return mappedRows.filter(row =>
      cfg.requiredCols.every(col => row[col]?.trim())
    ).length;
  }, [mappedRows, cfg]);

  return (
    <div style={{ fontFamily: "'Chivo', sans-serif", color: 'hsl(var(--foreground))', maxWidth: 980, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Sheets Import</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>
          Copy data directly from Google Sheets and paste it here — no file upload needed
        </p>
      </div>

      {/* Type selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
        {Object.entries(IMPORT_TYPES).map(([key, c]) => (
          <button
            key={key}
            onClick={() => handleTypeChange(key)}
            style={{
              padding: '16px 20px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
              border: `2px solid ${importType === key ? c.color : '#e5e7eb'}`,
              background: importType === key ? c.color + '0c' : '#fff',
              transition: 'all 0.15s',
              fontFamily: "'Chivo', sans-serif",
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <FileSpreadsheet size={16} color={importType === key ? c.color : '#aaa'} />
              <span style={{ fontSize: 14, fontWeight: 800, color: importType === key ? c.color : 'hsl(var(--foreground))' }}>
                {c.label}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', lineHeight: 1.4 }}>{c.description}</div>
          </button>
        ))}
      </div>

      {/* Breadcrumb */}
      {step !== 'paste' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
          color: '#aaa', marginBottom: 20,
        }}>
          {['paste','map','preview','done'].map((s, i, arr) => (
            <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                color: step === s ? 'hsl(var(--foreground))' : arr.indexOf(step) > i ? '#16a34a' : 'hsl(var(--muted-foreground))',
                fontWeight: step === s ? 700 : 400, textTransform: 'capitalize',
              }}>
                {s === 'paste' ? '1. Paste' : s === 'map' ? '2. Map Columns' : s === 'preview' ? '3. Preview' : '4. Done'}
              </span>
              {i < arr.length - 1 && <ChevronRight size={12} />}
            </span>
          ))}
        </div>
      )}

      {/* ── Step 1: Paste ── */}
      {step === 'paste' && (
        <div style={{ background: 'hsl(var(--card))', borderRadius: 12, padding: '24px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Paste your data</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                In Google Sheets: select all cells including the header row → Copy (Ctrl+C) → paste below.
                The first row must be the header.
              </div>
            </div>
            <button
              onClick={() => downloadTemplate(importType)}
              style={{
                flexShrink: 0, marginLeft: 16, display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', border: '1px solid hsl(var(--border))', borderRadius: 8,
                background: 'hsl(var(--card))', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                fontFamily: "'Chivo', sans-serif", color: '#555',
              }}
            >
              <Upload size={12} />
              Download Template
            </button>
          </div>

          {/* Info: expected columns */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8,
            padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#0369a1',
          }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Expected columns</strong> ({cfg.requiredCols.join(', ')} required):
              {' '}{cfg.allCols.join(' · ')}
            </div>
          </div>

          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder={`Paste Google Sheets data here (Tab-separated or CSV)...\n\nExample:\n${IMPORT_TYPES[importType].templateRows[0].join('\t')}\n${IMPORT_TYPES[importType].templateRows[1].join('\t')}`}
            rows={12}
            style={{
              width: '100%', border: '1px solid hsl(var(--border))', borderRadius: 8,
              padding: '12px 14px', fontSize: 12, fontFamily: 'monospace',
              resize: 'vertical', outline: 'none', boxSizing: 'border-box',
              lineHeight: 1.6, color: 'hsl(var(--foreground))',
            }}
            onFocus={e => e.target.style.borderColor = cfg.color}
            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button
              onClick={handleParse}
              disabled={!pasteText.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 22px', border: 'none', borderRadius: 9,
                background: !pasteText.trim() ? '#e5e7eb' : cfg.color,
                color: '#fff', cursor: !pasteText.trim() ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 700, fontFamily: "'Chivo', sans-serif",
              }}
            >
              Parse Data <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Map columns ── */}
      {step === 'map' && parsed && (
        <div>
          <div style={{ background: 'hsl(var(--card))', borderRadius: 12, padding: '24px 28px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
              Map your columns
            </div>
            <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginBottom: 16 }}>
              Detected {parsed.headers.length} columns, {parsed.rows.length} data rows.
              Columns were auto-mapped where possible — adjust if needed.
            </div>
            <ColMapper
              parsedHeaders={parsed.headers}
              mapping={mapping}
              onMapping={(col, val) => setMapping(m => ({ ...m, [col]: val }))}
              importType={importType}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            <button onClick={handleReset} style={{
              padding: '9px 18px', border: '1px solid hsl(var(--border))', borderRadius: 8,
              background: 'hsl(var(--card))', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              fontFamily: "'Chivo', sans-serif",
            }}>
              ← Back
            </button>
            <button
              onClick={() => setStep('preview')}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 22px', border: 'none', borderRadius: 9,
                background: cfg.color, color: '#fff', cursor: 'pointer',
                fontSize: 13, fontWeight: 700, fontFamily: "'Chivo', sans-serif",
              }}
            >
              Preview <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Preview ── */}
      {step === 'preview' && parsed && (
        <div>
          <div style={{ background: 'hsl(var(--card))', borderRadius: 12, padding: '24px 28px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
              Review before importing
            </div>
            <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginBottom: 16 }}>
              {validRowCount} of {parsed.rows.length} rows are valid and will be imported.
              Invalid rows will be skipped.
            </div>
            <PreviewTable
              rows={parsed.rows}
              mapping={mapping}
              importType={importType}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            <button onClick={() => setStep('map')} style={{
              padding: '9px 18px', border: '1px solid hsl(var(--border))', borderRadius: 8,
              background: 'hsl(var(--card))', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              fontFamily: "'Chivo', sans-serif",
            }}>
              ← Adjust Mapping
            </button>
            <button
              onClick={handleImport}
              disabled={importing || validRowCount === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 24px', border: 'none', borderRadius: 9,
                background: importing || validRowCount === 0 ? '#ccc' : cfg.color,
                color: '#fff', cursor: importing || validRowCount === 0 ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 700, fontFamily: "'Chivo', sans-serif",
              }}
            >
              {importing
                ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Importing…</>
                : <><Upload size={13} /> Import {validRowCount} rows</>
              }
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Done ── */}
      {step === 'done' && result && (
        <ResultBanner result={result} onReset={handleReset} />
      )}

      {/* Order guide */}
      {step === 'paste' && (
        <div style={{
          marginTop: 24, background: 'hsl(var(--card))', borderRadius: 12, padding: '20px 24px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Import order matters</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#555' }}>
            {[
              { label: '1. Accounts', color: '#3b82f6', note: 'Import first' },
              { label: '→', color: '#aaa', note: '' },
              { label: '2. Contacts', color: '#8b5cf6', note: 'Needs accounts' },
              { label: '→', color: '#aaa', note: '' },
              { label: '3. Opportunities', color: '#F26B4E', note: 'Needs accounts + contacts' },
            ].map((item, i) => (
              <span key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span style={{
                  fontWeight: item.note ? 700 : 400,
                  color: item.color,
                  fontSize: item.note ? 13 : 16,
                }}>
                  {item.label}
                </span>
                {item.note && <span style={{ fontSize: 10, color: '#aaa' }}>{item.note}</span>}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 12, lineHeight: 1.6 }}>
            Contacts and Opportunities are matched to Accounts by company name (case-insensitive).
            Duplicate accounts are updated; duplicate contacts (same account + email) are updated.
            Duplicate opportunities are skipped.
          </div>
        </div>
      )}
    </div>
  );
}
