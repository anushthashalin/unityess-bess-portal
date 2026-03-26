// Empty string = same-origin relative URLs (works on Vercel where web + API share one domain)
// Override with VITE_API_URL env var for local dev pointing to a separate API server
const BASE = import.meta.env.VITE_API_URL ?? '';

async function request(path, options = {}) {
  const token = localStorage.getItem('bess_portal_token');
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  get:    (path)         => request(path),
  post:   (path, body)   => request(path, { method: 'POST',  body: JSON.stringify(body) }),
  patch:  (path, body)   => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path)         => request(path, { method: 'DELETE' }),
};

// ── BESS endpoints ─────────────────────────────────────────────────────────
export const bessApi = {
  // GET
  clients:            () => api.get('/api/bess/clients'),
  sites:              () => api.get('/api/bess/sites'),
  units:              () => api.get('/api/bess/units'),
  proposals:          () => api.get('/api/bess/proposals'),
  projects:           () => api.get('/api/bess/projects'),
  configs:            () => api.get('/api/bess/bess-configurations'),
  tariffs:            () => api.get('/api/bess/tariff-structures'),
  loadProfiles:       (site_id) => api.get(`/api/bess/load-profiles?site_id=${site_id}`),

  // Sizing / recommendation / finance persistence
  coverageTable:          (params) => { const q = new URLSearchParams(params).toString(); return api.get(`/api/bess/coverage-table?${q}`); },
  cycleDatasetsInfo:      () => api.get('/api/bess/cycle-datasets'),
  sizingAnalyses:         (params = {}) => { const q = new URLSearchParams(params).toString(); return api.get(`/api/bess/sizing-analyses${q ? '?' + q : ''}`); },
  createSizingAnalysis:   (body) => api.post('/api/bess/sizing-analyses', body),
  recommendationRecords:  (params = {}) => { const q = new URLSearchParams(params).toString(); return api.get(`/api/bess/recommendation-records${q ? '?' + q : ''}`); },
  createRecommendation:   (body) => api.post('/api/bess/recommendation-records', body),
  patchRecommendation:    (id, body) => api.patch(`/api/bess/recommendation-records/${id}`, body),
  financeRecords:         (params = {}) => { const q = new URLSearchParams(params).toString(); return api.get(`/api/bess/finance-records${q ? '?' + q : ''}`); },
  createFinanceRecord:    (body) => api.post('/api/bess/finance-records', body),

  // POST
  createClient:       (body) => api.post('/api/bess/clients', body),
  patchClient:        (id, body) => api.patch(`/api/bess/clients/${id}`, body),
  createSite:         (body) => api.post('/api/bess/sites', body),
  patchSite:          (id, body) => api.patch(`/api/bess/sites/${id}`, body),
  createProposal:     (body) => api.post('/api/bess/proposals', body),
  patchProposal:      (id, body) => api.patch(`/api/bess/proposals/${id}`, body),
  createProject:      (body) => api.post('/api/bess/projects', body),
  patchProject:       (id, body) => api.patch(`/api/bess/projects/${id}`, body),
  createLoadProfile:  (body) => api.post('/api/bess/load-profiles', body),
  createTariff:       (body) => api.post('/api/bess/tariff-structures', body),
  createConfig:       (body) => api.post('/api/bess/bess-configurations', body),
  recommendBess:      (body) => api.post('/api/bess/recommend', body),
  parseBill:          (body) => api.post('/api/bess/parse-bill', body),

  // Returns a Blob (binary .docx) — use separately from the JSON api helper
  downloadProposalDocx: async (body) => {
    const token = localStorage.getItem('bess_portal_token');
    const res = await fetch(`${BASE}/api/bess/generate-proposal-docx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message ?? err.error ?? `HTTP ${res.status}`);
    }
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : 'BESS_Proposal.docx';
    const blob = await res.blob();
    return { blob, filename };
  },
};

// ── BD endpoints ───────────────────────────────────────────────────────────
export const bdApi = {
  dashboard:      () => api.get('/api/bd/dashboard'),
  users:          () => api.get('/api/bd/users'),
  accounts:       (params = {}) => { const q = new URLSearchParams(params).toString(); return api.get(`/api/bd/accounts${q ? '?' + q : ''}`); },
  createAccount:  (body) => api.post('/api/bd/accounts', body),
  contacts:       (account_id) => api.get(account_id ? `/api/bd/contacts?account_id=${account_id}` : '/api/bd/contacts'),
  createContact:  (body) => api.post('/api/bd/contacts', body),
  opps:           (filters = {}) => {
    const q = new URLSearchParams(filters).toString();
    return api.get(`/api/bd/opportunities${q ? '?' + q : ''}`);
  },
  createOpp:      (body) => api.post('/api/bd/opportunities', body),
  patchOpp:       (id, body) => api.patch(`/api/bd/opportunities/${id}`, body),
  activities:       (opp_id) => api.get(opp_id ? `/api/bd/activities?opp_id=${opp_id}` : '/api/bd/activities'),
  createActivity:   (body) => api.post('/api/bd/activities', body),
  followUps:        (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/api/bd/follow-ups${q ? '?' + q : ''}`);
  },
  createFollowUp:   (body) => api.post('/api/bd/follow-ups', body),
  patchFollowUp:    (id, body) => api.patch(`/api/bd/follow-ups/${id}`, body),
  approvals:        (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/api/bd/approvals${q ? '?' + q : ''}`);
  },
  createApproval:   (body) => api.post('/api/bd/approvals', body),
  patchApproval:    (id, body) => api.patch(`/api/bd/approvals/${id}`, body),
  proposals:        (opp_id) => api.get(opp_id ? `/api/bd/proposals?opp_id=${opp_id}` : '/api/bd/proposals'),
  createProposal:   (body) => api.post('/api/bd/proposals', body),
  patchProposal:    (id, body) => api.patch(`/api/bd/proposals/${id}`, body),
  automationStatus: () => api.get('/api/bd/automation/status'),
  runAutomation:    () => api.post('/api/bd/automation/run', {}),
  emailStatus:      () => api.get('/api/bd/email/status'),
  sendEmail:        (body) => api.post('/api/bd/email/send', body),
  importAccounts:      (rows) => api.post('/api/bd/import/accounts',      { rows }),
  importContacts:      (rows) => api.post('/api/bd/import/contacts',      { rows }),
  importOpportunities: (rows) => api.post('/api/bd/import/opportunities', { rows }),
  auditLog: (params = {}) => { const q = new URLSearchParams(params).toString(); return api.get(`/api/bd/audit-log${q ? '?' + q : ''}`); },
};