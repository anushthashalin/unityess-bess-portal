const path = require('path');
// In dev: load root .env; in production env vars are injected by the platform
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
}
const express      = require('express');
const cors         = require('cors');
const { Pool }     = require('pg');
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const nodemailer   = require('nodemailer');
const rateLimit    = require('express-rate-limit');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// ── Email transporter (Gmail SMTP) ────────────────────────────────────────────
// Set GMAIL_USER and GMAIL_APP_PASSWORD in .env
// Generate app password at: myaccount.google.com/apppasswords
let emailTransporter = null;
function getTransporter() {
  if (emailTransporter) return emailTransporter;
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  return emailTransporter;
}

// ── Auth middleware ────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalid or expired' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden — requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}

// ── Audit log helper ─────────────────────────────────────────────────────────
async function logAudit(req, action, resource, resource_id, details = {}) {
  try {
    const user_id   = req.user?.id   ?? null;
    const user_name = req.user?.name ?? null;
    await pool.query(
      `INSERT INTO bd.audit_log (user_id, user_name, action, resource, resource_id, details)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [user_id, user_name, action, resource, String(resource_id ?? ''), details]
    );
  } catch (_) { /* non-fatal */ }
}

// ── DB error helper — returns 400 for constraint violations, 500 otherwise ──
function handleDbError(res, e) {
  if (e.code === '23502') {
    return res.status(400).json({ error: `Required field missing: ${e.column || 'unknown'}` });
  }
  if (e.code === '23503') {
    return res.status(400).json({ error: 'Referenced record not found (invalid foreign key)' });
  }
  if (e.code === '23505') {
    return res.status(409).json({ error: 'Duplicate record — this entry already exists' });
  }
  console.error('[API Error]', e.message);
  return res.status(500).json({ error: 'Internal server error' });
}

const app  = express();
const PORT = process.env.PORT || 4000;

// ── DB Pool ────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Verify DB connectivity at startup — release the client immediately
pool.connect()
  .then(client => { client.release(); console.log('✅  Connected to Neon (frosty-sound-57567439)'); })
  .catch(e => console.error('❌  DB connection failed:', e.message));

// Prevent Neon idle-connection drops from crashing the process
pool.on('error', (err) => {
  console.warn('⚠️  Neon pool idle error (safe to ignore):', err.message);
});

// ── Database migrations ─────────────────────────────────────────────────────────
async function runMigrations() {
  const migrations = [
    // Proposals — columns added in P10 that may not exist in the live schema
    `ALTER TABLE bd.proposals ADD COLUMN IF NOT EXISTS prop_number  TEXT`,
    // BESS proposals — project link
    `ALTER TABLE bess.proposals ADD COLUMN IF NOT EXISTS project_id INTEGER`,
    `ALTER TABLE bd.proposals ADD COLUMN IF NOT EXISTS sent_at      TIMESTAMPTZ`,
    `ALTER TABLE bd.proposals ADD COLUMN IF NOT EXISTS closed_at    TIMESTAMPTZ`,
    `ALTER TABLE bd.proposals ADD COLUMN IF NOT EXISTS content      JSONB`,
    `ALTER TABLE bd.proposals ADD COLUMN IF NOT EXISTS created_by   INTEGER REFERENCES bd.users(id)`,
    // bess.clients — extended BD fields
    `ALTER TABLE bess.clients ADD COLUMN IF NOT EXISTS lead_status        TEXT`,
    `ALTER TABLE bess.clients ADD COLUMN IF NOT EXISTS bd_name            TEXT`,
    `ALTER TABLE bess.clients ADD COLUMN IF NOT EXISTS industry_type      TEXT`,
    `ALTER TABLE bess.clients ADD COLUMN IF NOT EXISTS requirement_kwh    NUMERIC`,
    `ALTER TABLE bess.clients ADD COLUMN IF NOT EXISTS project_type       TEXT`,
    `ALTER TABLE bess.clients ADD COLUMN IF NOT EXISTS meeting_date       DATE`,
    `ALTER TABLE bess.clients ADD COLUMN IF NOT EXISTS timeline           TEXT`,
    `ALTER TABLE bess.clients ADD COLUMN IF NOT EXISTS qualified          BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE bess.clients ADD COLUMN IF NOT EXISTS budgetary_quote    BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE bess.clients ADD COLUMN IF NOT EXISTS tech_discussion    BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE bess.clients ADD COLUMN IF NOT EXISTS tc_offer           BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE bess.clients ADD COLUMN IF NOT EXISTS final_quote        BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE bess.clients ADD COLUMN IF NOT EXISTS remarks            TEXT`,
    `ALTER TABLE bess.clients ADD COLUMN IF NOT EXISTS alternate_contact  TEXT`,
    `ALTER TABLE bess.clients ADD COLUMN IF NOT EXISTS alternate_phone    TEXT`,
    `ALTER TABLE bess.clients ADD COLUMN IF NOT EXISTS website            TEXT`,
    // product_type — tag records as 'bess' or 'epc' for dual-product portal
    `ALTER TABLE bd.accounts      ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'bess'`,
    `ALTER TABLE bd.opportunities ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'bess'`,
    `ALTER TABLE bd.follow_ups    ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'bess'`,
    `ALTER TABLE bd.approvals     ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'bess'`,
    `ALTER TABLE bd.proposals     ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'bess'`,
    // Unique indexes for import upserts (CREATE INDEX IF NOT EXISTS is safe to repeat)
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_company_name
       ON bd.accounts (LOWER(company_name))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_account_email
       ON bd.contacts (account_id, LOWER(email)) WHERE email IS NOT NULL`,
    // Audit log
    `CREATE TABLE IF NOT EXISTS bd.audit_log (
       id          SERIAL PRIMARY KEY,
       user_id     INTEGER,
       user_name   TEXT,
       action      TEXT NOT NULL,
       resource    TEXT NOT NULL,
       resource_id TEXT,
       details     JSONB DEFAULT '{}',
       created_at  TIMESTAMPTZ DEFAULT NOW()
     )`,
  ];
  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch (e) {
      console.warn(`⚠️  Migration skipped (${e.message.slice(0, 80)})`);
    }
  }
  console.log('✅  Migrations complete');
}

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:4173',
    /\.vercel\.app$/,
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// ── Rate limiting ────────────────────────────────────────────────────────────
// General: 100 requests / 1 min per IP
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please wait a moment and try again.' },
});

// Auth: 10 login attempts / 15 min per IP (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts — try again in 15 minutes.' },
});

// Bulk import: 5 import jobs / 10 min per IP
const importLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many import requests — wait 10 minutes before retrying.' },
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/bd/import', importLimiter);

// ── Root & DevTools probes ──────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    name:    'UnityESS BD Portal API',
    version: '1.0.0',
    status:  'ok',
    docs:    '/health',
  });
});

// Chrome DevTools probes this on every page load — return empty JSON so the
// browser doesn't log a CSP violation or a 404 in the network panel.
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.json({});
});

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT schemaname, count(*)::int AS tables
       FROM pg_tables WHERE schemaname IN ('bd','bess')
       GROUP BY schemaname ORDER BY schemaname`
    );
    res.json({ status: 'ok', version: '1.0.0', schemas: rows });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ── Auth ────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const { rows } = await pool.query(
      'SELECT * FROM bd.users WHERE email = $1 AND is_active = true',
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    handleDbError(res, e);
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, role FROM bd.users WHERE id = $1',
    [req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json({ user: rows[0] });
});

// ════════════════════════════════════════════════════════════════════════════
// BD PORTAL — Business Development
// ════════════════════════════════════════════════════════════════════════════

// Users
app.get('/api/bd/users', requireAuth, requireRole('admin'), async (req, res) => {
  const { rows } = await pool.query('SELECT id, name, email, role, is_active, created_at FROM bd.users WHERE is_active = true ORDER BY name');
  res.json({ data: rows });
});

// Accounts
app.get('/api/bd/accounts', async (req, res) => {
  try {
    const { product_type } = req.query;
    const params = [];
    const wc = product_type ? `WHERE a.product_type=$${params.push(product_type)}` : '';
    const { rows } = await pool.query(
      `SELECT a.*, u.name AS owner_name,
         COUNT(DISTINCT o.id)::int                              AS opp_count,
         COUNT(DISTINCT c.id)::int                             AS contact_count,
         COALESCE(SUM(o.estimated_value) FILTER (WHERE o.closed_at IS NULL), 0)::float AS pipeline_value,
         MAX(o.stage) FILTER (WHERE o.closed_at IS NULL)       AS latest_stage,
         MAX(o.last_activity_at)                               AS last_activity_at
       FROM bd.accounts a
       LEFT JOIN bd.users u    ON u.id = a.owner_id
       LEFT JOIN bd.opportunities o ON o.account_id = a.id
       LEFT JOIN bd.contacts c ON c.account_id = a.id
       ${wc}
       GROUP BY a.id, u.name
       ORDER BY MAX(COALESCE(o.last_activity_at, a.updated_at)) DESC NULLS LAST`, params
    );
    res.json({ data: rows });
  } catch (e) { handleDbError(res, e); }
});

app.post('/api/bd/accounts', requireAuth, requireRole('admin','bd_exec'), async (req, res) => {
  try {
    const { company_name, industry, city, state, website, gstin, source, owner_id, product_type } = req.body;
    if (!company_name) return res.status(400).json({ error: 'company_name is required' });
    const { rows: [c] } = await pool.query(
      "SELECT COUNT(*) FROM bd.accounts WHERE account_id LIKE $1",
      [`ACC-${new Date().getFullYear()}%`]
    );
    const account_id = `ACC-${new Date().getFullYear()}-${String(parseInt(c.count) + 1).padStart(3,'0')}`;
    const { rows } = await pool.query(
      `INSERT INTO bd.accounts (account_id,company_name,industry,city,state,website,gstin,source,owner_id,product_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [account_id, company_name, industry, city, state, website, gstin, source, owner_id, product_type ?? 'bess']
    );
    await logAudit(req, 'create', 'accounts', rows[0].id, { company_name });
    res.status(201).json({ data: rows[0] });
  } catch (e) { handleDbError(res, e); }
});

// Contacts
app.get('/api/bd/contacts', async (req, res) => {
  const { account_id } = req.query;
  const { rows } = account_id
    ? await pool.query('SELECT * FROM bd.contacts WHERE account_id=$1 ORDER BY is_primary DESC,name', [account_id])
    : await pool.query('SELECT c.*,a.company_name FROM bd.contacts c JOIN bd.accounts a ON a.id=c.account_id ORDER BY c.name');
  res.json({ data: rows });
});

app.post('/api/bd/contacts', requireAuth, requireRole('admin','bd_exec'), async (req, res) => {
  try {
    const { account_id, name, designation, email, phone, is_primary, linkedin, notes } = req.body;
    if (!account_id || !name) return res.status(400).json({ error: 'account_id and name are required' });
    const { rows } = await pool.query(
      `INSERT INTO bd.contacts (account_id,name,designation,email,phone,is_primary,linkedin,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [account_id, name, designation, email, phone, is_primary ?? false, linkedin, notes]
    );
    await logAudit(req, 'create', 'contacts', rows[0].id, { name, account_id });
    res.status(201).json({ data: rows[0] });
  } catch (e) { handleDbError(res, e); }
});

// Opportunities
app.get('/api/bd/opportunities', async (req, res) => {
  const { stage, stale, product_type } = req.query;
  const where = [];
  const params = [];
  if (stage)        { params.push(stage);        where.push(`o.stage=$${params.length}`); }
  if (stale === 'true') where.push('o.stale=true');
  if (product_type) { params.push(product_type); where.push(`o.product_type=$${params.length}`); }
  const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const { rows } = await pool.query(
    `SELECT o.*, a.company_name, a.city, c.name AS contact_name, c.phone AS contact_phone,
       u.name AS owner_name,
       (SELECT COUNT(*)::int FROM bd.activities act WHERE act.opp_id=o.id) AS activity_count,
       (SELECT COUNT(*)::int FROM bd.follow_ups f WHERE f.opp_id=o.id AND f.status='pending') AS pending_followups
     FROM bd.opportunities o
     LEFT JOIN bd.accounts a ON a.id=o.account_id
     LEFT JOIN bd.contacts c ON c.id=o.contact_id
     LEFT JOIN bd.users u ON u.id=o.owner_id
     ${wc} ORDER BY o.stage_updated_at DESC`, params
  );
  res.json({ data: rows });
});

app.post('/api/bd/opportunities', requireAuth, requireRole('admin','bd_exec'), async (req, res) => {
  try {
    const { account_id, contact_id, owner_id, title, scope_type, estimated_value, product_type } = req.body;
    if (!account_id || !title) return res.status(400).json({ error: 'account_id and title are required' });
    const { rows: [c] } = await pool.query(
      "SELECT COUNT(*) FROM bd.opportunities WHERE opp_id LIKE $1",
      [`OPP-${new Date().getFullYear()}%`]
    );
    const opp_id = `OPP-${new Date().getFullYear()}-${String(parseInt(c.count)+1).padStart(3,'0')}`;
    const next_d = new Date(); next_d.setDate(next_d.getDate()+3);
    const { rows } = await pool.query(
      `INSERT INTO bd.opportunities (opp_id,account_id,contact_id,owner_id,title,scope_type,estimated_value,next_action_date,product_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [opp_id, account_id, contact_id, owner_id, title, scope_type, estimated_value, next_d, product_type ?? 'bess']
    );
    await logAudit(req, 'create', 'opportunities', rows[0].id, { opp_id, title, account_id });
    res.status(201).json({ data: rows[0] });
  } catch (e) { handleDbError(res, e); }
});

app.patch('/api/bd/opportunities/:id', requireAuth, requireRole('admin','bd_exec'), async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['title','stage','scope_type','estimated_value','contact_id','owner_id',
                     'next_action','next_action_date','stale','stale_reason','lost_reason',
                     'po_number','po_value','closed_at'];
    const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
    if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });
    const keys = updates.map(([k]) => k);
    const vals = updates.map(([,v]) => v);
    const stageChanging = keys.includes('stage');
    const extras = stageChanging ? ', stage_updated_at=NOW(), last_activity_at=NOW()' : ', last_activity_at=NOW()';
    const set = keys.map((k,i) => `${k}=$${i+2}`).join(', ');
    const { rows } = await pool.query(
      `UPDATE bd.opportunities SET ${set}${extras} WHERE id=$1 RETURNING *`,
      [id, ...vals]
    );
    res.json({ data: rows[0] });
  } catch (e) { handleDbError(res, e); }
});

// Activities
app.get('/api/bd/activities', async (req, res) => {
  try {
    const { opp_id } = req.query;
    const { rows } = opp_id
      ? await pool.query(
          `SELECT a.*, u.name AS logged_by_name,
             o.title AS opp_title, ac.company_name
           FROM bd.activities a
           LEFT JOIN bd.users u       ON u.id  = a.logged_by
           LEFT JOIN bd.opportunities o ON o.id = a.opp_id
           LEFT JOIN bd.accounts ac   ON ac.id = o.account_id
           WHERE a.opp_id=$1 ORDER BY a.logged_at DESC`, [opp_id])
      : await pool.query(
          `SELECT a.*, u.name AS logged_by_name,
             o.title AS opp_title, ac.company_name
           FROM bd.activities a
           LEFT JOIN bd.users u       ON u.id  = a.logged_by
           LEFT JOIN bd.opportunities o ON o.id = a.opp_id
           LEFT JOIN bd.accounts ac   ON ac.id = o.account_id
           ORDER BY a.logged_at DESC LIMIT 200`);
    res.json({ data: rows });
  } catch (e) { handleDbError(res, e); }
});

app.post('/api/bd/activities', requireAuth, requireRole('admin','bd_exec'), async (req, res) => {
  try {
    const { opp_id, type, direction, summary, outcome, next_action, next_action_date, logged_by, duration_min } = req.body;
    if (!opp_id || !type) return res.status(400).json({ error: 'opp_id and type are required' });
    const { rows } = await pool.query(
      `INSERT INTO bd.activities (opp_id,type,direction,summary,outcome,next_action,next_action_date,logged_by,duration_min)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [opp_id, type, direction ?? 'outbound', summary, outcome, next_action, next_action_date, logged_by, duration_min ?? null]
    );
    // Update opportunity last_activity_at + next_action_date if provided
    if (next_action_date) {
      await pool.query(
        'UPDATE bd.opportunities SET last_activity_at=NOW(), next_action=$1, next_action_date=$2 WHERE id=$3',
        [next_action, next_action_date, opp_id]
      );
      // Create T+3 follow-up from the explicit next_action_date
      await autoCreateFollowUp(opp_id, logged_by, new Date(next_action_date).getTime());
    } else {
      await pool.query('UPDATE bd.opportunities SET last_activity_at=NOW() WHERE id=$1', [opp_id]);
      // Auto-create T+3 follow-up from today
      await autoCreateFollowUp(opp_id, logged_by, Date.now());
    }
    res.status(201).json({ data: rows[0] });
  } catch (e) { handleDbError(res, e); }
});

// Follow-ups
app.get('/api/bd/follow-ups', async (req, res) => {
  try {
    const { status, opp_id, product_type } = req.query;
    const where = [];
    const params = [];

    if (opp_id)       { params.push(opp_id);       where.push(`f.opp_id=$${params.length}`); }
    if (product_type) { params.push(product_type); where.push(`o.product_type=$${params.length}`); }

    if (status === 'all') {
      // no status filter
    } else if (status === 'done') {
      where.push(`f.status='done'`);
    } else {
      // default: pending, respecting snooze
      where.push(`f.status='pending'`);
      where.push(`(f.snooze_until IS NULL OR f.snooze_until<=CURRENT_DATE)`);
    }

    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT f.*, o.opp_id AS opp_ref, o.title AS opp_title, o.stage,
         a.company_name, u.name AS assigned_to_name,
         (CURRENT_DATE - f.due_date)::int AS days_overdue
       FROM bd.follow_ups f
       JOIN bd.opportunities o ON o.id=f.opp_id
       JOIN bd.accounts a ON a.id=o.account_id
       LEFT JOIN bd.users u ON u.id=f.assigned_to
       ${wc}
       ORDER BY f.due_date ASC`, params
    );
    res.json({ data: rows });
  } catch (e) { handleDbError(res, e); }
});

app.post('/api/bd/follow-ups', requireAuth, requireRole('admin','bd_exec'), async (req, res) => {
  try {
    const { opp_id, due_date, type, assigned_to } = req.body;
    if (!opp_id || !due_date) return res.status(400).json({ error: 'opp_id and due_date required' });
    const { rows: [cnt] } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM bd.follow_ups WHERE opp_id=$1', [opp_id]
    );
    const { rows } = await pool.query(
      `INSERT INTO bd.follow_ups (opp_id, due_date, type, assigned_to, status, follow_up_number)
       VALUES ($1,$2,$3,$4,'pending',$5) RETURNING *`,
      [opp_id, due_date, type ?? 'call', assigned_to ?? null, cnt.n + 1]
    );
    res.status(201).json({ data: rows[0] });
  } catch (e) { handleDbError(res, e); }
});

app.patch('/api/bd/follow-ups/:id', requireAuth, requireRole('admin','bd_exec'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, snooze_until } = req.body;
    const { rows } = await pool.query(
      `UPDATE bd.follow_ups SET status=COALESCE($2,status), snooze_until=$3 WHERE id=$1 RETURNING *`,
      [id, status ?? null, snooze_until ?? null]
    );
    res.json({ data: rows[0] });
  } catch (e) { handleDbError(res, e); }
});

// Approvals
const APPROVAL_WITH_JOINS = `
  SELECT ap.*,
    o.opp_id AS opp_ref, o.title AS opp_title, o.stage, o.estimated_value,
    a.company_name,
    req.name  AS requested_by_name,
    appr.name AS approver_name
  FROM bd.approvals ap
  JOIN  bd.opportunities o ON o.id  = ap.opp_id
  JOIN  bd.accounts a      ON a.id  = o.account_id
  LEFT JOIN bd.users req   ON req.id  = ap.requested_by
  LEFT JOIN bd.users appr  ON appr.id = ap.approver_id
`;

app.get('/api/bd/approvals', async (req, res) => {
  try {
    const { status, product_type } = req.query;
    const where = [];
    const params = [];
    if (product_type) { params.push(product_type); where.push(`o.product_type=$${params.length}`); }
    if (status === 'all') { /* no filter */ }
    else if (status)    { params.push(status); where.push(`ap.status=$${params.length}`); }
    else                { where.push(`ap.status='pending'`); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { rows } = await pool.query(
      `${APPROVAL_WITH_JOINS} ${wc} ORDER BY ap.requested_at DESC`, params
    );
    res.json({ data: rows });
  } catch (e) { handleDbError(res, e); }
});

app.post('/api/bd/approvals', requireAuth, requireRole('admin','bd_exec'), async (req, res) => {
  try {
    const { opp_id, type, deviation_value, justification, requested_by, proposal_id } = req.body;
    if (!opp_id || !type) return res.status(400).json({ error: 'opp_id and type required' });
    const { rows } = await pool.query(
      `INSERT INTO bd.approvals (opp_id, proposal_id, type, deviation_value, justification, requested_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING *`,
      [opp_id, proposal_id ?? null, type, deviation_value ?? null, justification ?? null, requested_by ?? null]
    );
    await logAudit(req, 'create', 'approvals', rows[0].id, { opp_id });
    res.status(201).json({ data: rows[0] });
  } catch (e) { handleDbError(res, e); }
});

app.patch('/api/bd/approvals/:id', requireAuth, requireRole('admin','bd_exec'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approver_notes, approver_id } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be approved or rejected' });
    }
    await pool.query(
      `UPDATE bd.approvals SET status=$2, approver_notes=$3, approver_id=$4, approved_at=NOW() WHERE id=$1`,
      [id, status, approver_notes ?? null, approver_id ?? null]
    );
    const { rows } = await pool.query(`${APPROVAL_WITH_JOINS} WHERE ap.id=$1`, [id]);
    res.json({ data: rows[0] });
  } catch (e) { handleDbError(res, e); }
});

// Proposals (BD)
const PROPOSAL_WITH_JOINS = `
  SELECT p.*,
    o.opp_id AS opp_ref, o.title AS opp_title, o.stage, o.scope_type,
    o.estimated_value AS opp_value,
    a.company_name, a.city, a.state, a.gstin,
    c.name AS contact_name, c.designation AS contact_designation,
    c.email AS contact_email, c.phone AS contact_phone,
    u.name AS created_by_name
  FROM bd.proposals p
  JOIN  bd.opportunities o ON o.id = p.opp_id
  JOIN  bd.accounts a      ON a.id = o.account_id
  LEFT JOIN bd.contacts c  ON c.id = o.contact_id
  LEFT JOIN bd.users u     ON u.id = p.created_by
`;

app.get('/api/bd/proposals', async (req, res) => {
  try {
    const { opp_id } = req.query;
    const where  = opp_id ? 'WHERE p.opp_id=$1' : '';
    const params = opp_id ? [opp_id] : [];
    const { rows } = await pool.query(
      `${PROPOSAL_WITH_JOINS} ${where} ORDER BY p.created_at DESC`, params
    );
    res.json({ data: rows });
  } catch (e) { handleDbError(res, e); }
});

app.post('/api/bd/proposals', requireAuth, requireRole('admin','bd_exec'), async (req, res) => {
  try {
    const { opp_id, content, created_by } = req.body;
    if (!opp_id) return res.status(400).json({ error: 'opp_id required' });

    // Auto-increment version per opportunity
    const { rows: [cnt] } = await pool.query(
      'SELECT COALESCE(MAX(version),0)::int AS max_ver FROM bd.proposals WHERE opp_id=$1',
      [opp_id]
    );
    const version = cnt.max_ver + 1;

    // Generate proposal number: PROP-{YEAR}-{OPP_ID}-V{version}
    const { rows: [opp] } = await pool.query('SELECT opp_id AS opp_ref FROM bd.opportunities WHERE id=$1', [opp_id]);
    const prop_number = `PROP-${new Date().getFullYear()}-${(opp?.opp_ref || opp_id).replace('OPP-','')}-V${version}`;

    const { rows } = await pool.query(
      `INSERT INTO bd.proposals (opp_id, version, status, content, created_by, prop_number)
       VALUES ($1,$2,'draft',$3,$4,$5) RETURNING *`,
      [opp_id, version, JSON.stringify(content ?? {}), created_by ?? null, prop_number]
    );
    const { rows: full } = await pool.query(`${PROPOSAL_WITH_JOINS} WHERE p.id=$1`, [rows[0].id]);
    res.status(201).json({ data: full[0] });
  } catch (e) { handleDbError(res, e); }
});

app.patch('/api/bd/proposals/:id', requireAuth, requireRole('admin','bd_exec'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, content } = req.body;
    const updates = [];
    const vals = [id];

    if (status) {
      vals.push(status);
      updates.push(`status=$${vals.length}`);
      if (status === 'sent') {
        updates.push('sent_at=NOW()');
        // Also update opportunity's last_activity_at
        const { rows: [p] } = await pool.query('SELECT opp_id FROM bd.proposals WHERE id=$1', [id]);
        if (p) await pool.query('UPDATE bd.opportunities SET last_activity_at=NOW() WHERE id=$1', [p.opp_id]);
      }
      if (['accepted','rejected','expired'].includes(status)) {
        updates.push('closed_at=NOW()');
      }
    }
    if (content !== undefined) {
      vals.push(JSON.stringify(content));
      updates.push(`content=$${vals.length}`);
    }

    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    await pool.query(`UPDATE bd.proposals SET ${updates.join(',')} WHERE id=$1`, vals);
    const { rows } = await pool.query(`${PROPOSAL_WITH_JOINS} WHERE p.id=$1`, [id]);
    await logAudit(req, 'update', 'proposals', id, { ...(status !== undefined ? { status } : { content_updated: true }) });
    res.json({ data: rows[0] });
  } catch (e) { handleDbError(res, e); }
});

// ════════════════════════════════════════════════════════════════════════════
// EMAIL — Gmail SMTP send
// ════════════════════════════════════════════════════════════════════════════

// GET /api/bd/email/status — tells the frontend if email is configured
app.get('/api/bd/email/status', (req, res) => {
  const configured = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
  res.json({ configured, from: process.env.GMAIL_USER ?? null });
});

// POST /api/bd/email/send
// body: { proposal_id, to, cc, subject, body, sent_by }
app.post('/api/bd/email/send', requireAuth, requireRole('admin','bd_exec'), async (req, res) => {
  try {
    const { proposal_id, to, cc, subject, body: emailBody, sent_by } = req.body;
    if (!to || !subject || !emailBody) {
      return res.status(400).json({ error: 'to, subject, and body are required' });
    }

    const transporter = getTransporter();
    if (!transporter) {
      return res.status(503).json({
        error: 'Email not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to .env',
      });
    }

    // Send the email
    const info = await transporter.sendMail({
      from: `"Ornate Solar — UnityESS" <${process.env.GMAIL_USER}>`,
      to,
      cc: cc || undefined,
      subject,
      html: emailBody,
      text: emailBody.replace(/<[^>]+>/g, ''),   // plain-text fallback
    });

    // If a proposal_id is provided, mark it sent + log an activity
    if (proposal_id) {
      // Mark proposal sent
      await pool.query(
        `UPDATE bd.proposals SET status='sent', sent_at=NOW() WHERE id=$1 AND status='draft'`,
        [proposal_id]
      );

      // Fetch proposal for context
      const { rows: [prop] } = await pool.query(
        `SELECT p.opp_id, o.title AS opp_title FROM bd.proposals p
         JOIN bd.opportunities o ON o.id=p.opp_id WHERE p.id=$1`,
        [proposal_id]
      );

      if (prop) {
        // Log activity
        await pool.query(
          `INSERT INTO bd.activities (opp_id, type, direction, summary, logged_by)
           VALUES ($1,'email','outbound',$2,$3)`,
          [prop.opp_id, `Proposal emailed to ${to}. Subject: ${subject}`, sent_by ?? null]
        );
        // Update opp last_activity_at
        await pool.query(
          'UPDATE bd.opportunities SET last_activity_at=NOW() WHERE id=$1',
          [prop.opp_id]
        );
      }
    }

    res.json({ sent: true, message_id: info.messageId });
  } catch (e) {
    console.error('❌  Email send error:', e.message);
    handleDbError(res, e);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// BULK IMPORT — Google Sheets CSV → Neon
// Accepts arrays of plain objects; resolves FKs by name; returns summary.
// ════════════════════════════════════════════════════════════════════════════

// POST /api/bd/import/accounts
// body: { rows: [{ company_name, industry, city, state, website, gstin, source, owner_email }] }
app.post('/api/bd/import/accounts', requireAuth, requireRole('admin'), async (req, res) => {
  const { rows = [] } = req.body;
  if (!rows.length) return res.status(400).json({ error: 'No rows provided' });

  const results = { imported: 0, skipped: 0, errors: [] };
  const year = new Date().getFullYear();

  for (const [i, row] of rows.entries()) {
    try {
      if (!row.company_name?.trim()) {
        results.errors.push({ row: i + 1, message: 'company_name is required' });
        results.skipped++;
        continue;
      }

      // Resolve owner by email or name
      let owner_id = null;
      if (row.owner_email || row.owner_name) {
        const { rows: [u] } = await pool.query(
          'SELECT id FROM bd.users WHERE email=$1 OR name ILIKE $2 LIMIT 1',
          [row.owner_email ?? '', `%${row.owner_name ?? ''}%`]
        );
        owner_id = u?.id ?? null;
      }

      // Check if account exists (case-insensitive)
      const { rows: [existing] } = await pool.query(
        'SELECT id FROM bd.accounts WHERE LOWER(company_name)=LOWER($1) LIMIT 1',
        [row.company_name.trim()]
      );
      if (existing) {
        // Update existing
        await pool.query(
          `UPDATE bd.accounts SET
             industry = COALESCE($2, industry),
             city     = COALESCE($3, city),
             state    = COALESCE($4, state),
             website  = COALESCE($5, website),
             gstin    = COALESCE($6, gstin),
             source   = COALESCE($7, source),
             owner_id = COALESCE($8, owner_id)
           WHERE id=$1`,
          [existing.id, row.industry||null, row.city||null, row.state||null,
           row.website||null, row.gstin||null, row.source||null, owner_id]
        );
      } else {
        // Insert new
        const { rows: [cnt] } = await pool.query(
          "SELECT COUNT(*) FROM bd.accounts WHERE account_id LIKE $1",
          [`ACC-${year}%`]
        );
        const account_id = `ACC-${year}-${String(parseInt(cnt.count) + 1).padStart(3, '0')}`;
        await pool.query(
          `INSERT INTO bd.accounts (account_id,company_name,industry,city,state,website,gstin,source,owner_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [account_id, row.company_name.trim(), row.industry||null,
           row.city||null, row.state||null, row.website||null,
           row.gstin||null, row.source||null, owner_id]
        );
      }
      results.imported++;
    } catch (e) {
      results.errors.push({ row: i + 1, message: e.message });
      results.skipped++;
    }
  }
  res.json(results);
});

// POST /api/bd/import/contacts
// body: { rows: [{ company_name, name, designation, email, phone, is_primary, linkedin }] }
app.post('/api/bd/import/contacts', requireAuth, requireRole('admin'), async (req, res) => {
  const { rows = [] } = req.body;
  if (!rows.length) return res.status(400).json({ error: 'No rows provided' });

  const results = { imported: 0, skipped: 0, errors: [] };

  for (const [i, row] of rows.entries()) {
    try {
      if (!row.name?.trim())         { results.errors.push({ row: i+1, message: 'name is required' });         results.skipped++; continue; }
      if (!row.company_name?.trim()) { results.errors.push({ row: i+1, message: 'company_name is required' }); results.skipped++; continue; }

      // Resolve account by company_name
      const { rows: [acc] } = await pool.query(
        'SELECT id FROM bd.accounts WHERE company_name ILIKE $1 LIMIT 1',
        [row.company_name.trim()]
      );
      if (!acc) {
        results.errors.push({ row: i+1, message: `Account not found: "${row.company_name}" — import accounts first` });
        results.skipped++;
        continue;
      }

      // Check if contact already exists for this account (by email if present, else by name)
      let existing = null;
      if (row.email?.trim()) {
        const { rows: [e] } = await pool.query(
          'SELECT id FROM bd.contacts WHERE account_id=$1 AND LOWER(email)=LOWER($2) LIMIT 1',
          [acc.id, row.email.trim()]
        );
        existing = e ?? null;
      }
      if (!existing) {
        const { rows: [e] } = await pool.query(
          'SELECT id FROM bd.contacts WHERE account_id=$1 AND LOWER(name)=LOWER($2) LIMIT 1',
          [acc.id, row.name.trim()]
        );
        existing = e ?? null;
      }

      if (existing) {
        await pool.query(
          `UPDATE bd.contacts SET
             designation = COALESCE($2, designation),
             email       = COALESCE($3, email),
             phone       = COALESCE($4, phone),
             is_primary  = $5,
             linkedin    = COALESCE($6, linkedin)
           WHERE id=$1`,
          [existing.id, row.designation||null, row.email?.trim()||null,
           row.phone?.trim()||null,
           row.is_primary==='true'||row.is_primary===true||row.is_primary==='1',
           row.linkedin||null]
        );
      } else {
        await pool.query(
          `INSERT INTO bd.contacts (account_id,name,designation,email,phone,is_primary,linkedin)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [acc.id, row.name.trim(), row.designation||null, row.email?.trim()||null,
           row.phone?.trim()||null,
           row.is_primary==='true'||row.is_primary===true||row.is_primary==='1',
           row.linkedin||null]
        );
      }
      results.imported++;
    } catch (e) {
      results.errors.push({ row: i+1, message: e.message });
      results.skipped++;
    }
  }
  res.json(results);
});

// POST /api/bd/import/opportunities
// body: { rows: [{ company_name, contact_email, owner_name, title, scope_type, estimated_value, stage, next_action_date }] }
app.post('/api/bd/import/opportunities', requireAuth, requireRole('admin'), async (req, res) => {
  const { rows = [] } = req.body;
  if (!rows.length) return res.status(400).json({ error: 'No rows provided' });

  const VALID_STAGES = ['first_connect','requirement_captured','proposal_sent','technical_closure','commercial_negotiation','po_received','lost'];
  const results = { imported: 0, skipped: 0, errors: [] };
  const year = new Date().getFullYear();

  for (const [i, row] of rows.entries()) {
    try {
      if (!row.title?.trim())        { results.errors.push({ row: i+1, message: 'title is required' });        results.skipped++; continue; }
      if (!row.company_name?.trim()) { results.errors.push({ row: i+1, message: 'company_name is required' }); results.skipped++; continue; }

      // Resolve account
      const { rows: [acc] } = await pool.query(
        'SELECT id FROM bd.accounts WHERE company_name ILIKE $1 LIMIT 1',
        [row.company_name.trim()]
      );
      if (!acc) {
        results.errors.push({ row: i+1, message: `Account not found: "${row.company_name}"` });
        results.skipped++;
        continue;
      }

      // Resolve contact (optional)
      let contact_id = null;
      if (row.contact_email) {
        const { rows: [c] } = await pool.query(
          'SELECT id FROM bd.contacts WHERE email ILIKE $1 LIMIT 1', [row.contact_email.trim()]
        );
        contact_id = c?.id ?? null;
      }

      // Resolve owner (optional)
      let owner_id = null;
      if (row.owner_name) {
        const { rows: [u] } = await pool.query(
          'SELECT id FROM bd.users WHERE name ILIKE $1 LIMIT 1', [`%${row.owner_name.trim()}%`]
        );
        owner_id = u?.id ?? null;
      }

      // Validate stage
      const stage = VALID_STAGES.includes(row.stage) ? row.stage : 'first_connect';

      // Auto-generate opp_id
      const { rows: [cnt] } = await pool.query(
        "SELECT COUNT(*) FROM bd.opportunities WHERE opp_id LIKE $1", [`OPP-${year}%`]
      );
      const opp_id = `OPP-${year}-${String(parseInt(cnt.count) + 1).padStart(3,'0')}`;

      const value = row.estimated_value
        ? parseFloat(String(row.estimated_value).replace(/[₹,\s]/g, ''))
        : null;

      await pool.query(
        `INSERT INTO bd.opportunities
           (opp_id, account_id, contact_id, owner_id, title, scope_type, estimated_value, stage, next_action_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (opp_id) DO NOTHING`,
        [opp_id, acc.id, contact_id, owner_id, row.title.trim(),
         row.scope_type ?? null, value, stage,
         row.next_action_date || null]
      );
      results.imported++;
    } catch (e) {
      results.errors.push({ row: i+1, message: e.message });
      results.skipped++;
    }
  }
  res.json(results);
});

// Dashboard
// ── Audit Log ────────────────────────────────────────────────────────────────
app.get('/api/bd/audit-log', requireAuth, requireRole('admin','bd_exec'), async (req, res) => {
  try {
    const { resource, user_id: uid } = req.query;
    let sql = 'SELECT * FROM bd.audit_log';
    const params = [];
    const conds  = [];
    if (resource) { params.push(resource); conds.push(`resource=$${params.length}`); }
    if (uid)      { params.push(uid);      conds.push(`user_id=$${params.length}`); }
    if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
    sql += ' ORDER BY created_at DESC LIMIT 500';
    const { rows } = await pool.query(sql, params);
    res.json({ data: rows });
  } catch (e) { handleDbError(res, e); }
});

app.get('/api/bd/dashboard', async (req, res) => {
  try {
    const [pipeline, followUpCount, approvalCount, staleCount, hotDeals, dueFollowUps, pendingApprovals, recentActivities] = await Promise.all([
      // Pipeline by stage — count + value
      pool.query(`
        SELECT stage, COUNT(*)::int AS count, COALESCE(SUM(estimated_value),0)::float AS value
        FROM bd.opportunities WHERE closed_at IS NULL GROUP BY stage`),

      // Overdue / due-today follow-up count
      pool.query(`SELECT COUNT(*)::int AS count FROM bd.follow_ups WHERE status='pending' AND due_date<=CURRENT_DATE`),

      // Pending approval count
      pool.query(`SELECT COUNT(*)::int AS count FROM bd.approvals WHERE status='pending'`),

      // Stale deal count
      pool.query(`SELECT COUNT(*)::int AS count FROM bd.opportunities WHERE stale=true AND closed_at IS NULL`),

      // Hot deals — technical_closure + commercial_negotiation, sorted by longest silence
      pool.query(`
        SELECT o.id, o.title, o.stage, o.estimated_value, o.stale,
               a.company_name, c.name AS contact_name,
               (CURRENT_DATE - o.last_activity_at::date)::int AS days_silent
        FROM bd.opportunities o
        JOIN bd.accounts a ON a.id=o.account_id
        LEFT JOIN bd.contacts c ON c.id=o.contact_id
        WHERE o.stage IN ('commercial_negotiation','technical_closure') AND o.closed_at IS NULL
        ORDER BY o.last_activity_at ASC NULLS LAST
        LIMIT 10`),

      // Follow-ups due today or overdue — with context
      pool.query(`
        SELECT f.id, f.due_date, f.type AS follow_up_type, NULL::text AS notes, f.status,
               o.id AS opp_id, o.title AS opp_title,
               a.company_name, u.name AS assigned_to_name
        FROM bd.follow_ups f
        JOIN bd.opportunities o ON o.id=f.opp_id
        JOIN bd.accounts a ON a.id=o.account_id
        LEFT JOIN bd.users u ON u.id=f.assigned_to
        WHERE f.status='pending' AND f.due_date<=CURRENT_DATE
          AND (f.snooze_until IS NULL OR f.snooze_until<=CURRENT_DATE)
        ORDER BY f.due_date ASC
        LIMIT 15`),

      // Pending approvals — with context
      pool.query(`
        SELECT ap.id, ap.type AS approval_type, ap.status,
               ap.justification AS notes, ap.requested_at AS created_at,
               o.id AS opp_id, o.title AS opp_title,
               a.company_name, u.name AS requested_by_name
        FROM bd.approvals ap
        JOIN bd.opportunities o ON o.id=ap.opp_id
        JOIN bd.accounts a ON a.id=o.account_id
        LEFT JOIN bd.users u ON u.id=ap.requested_by
        WHERE ap.status='pending'
        ORDER BY ap.requested_at ASC
        LIMIT 10`),

      // Recent activities — last 10
      pool.query(`
        SELECT ac.id, ac.type, ac.summary, ac.logged_at,
               o.id AS opp_id, o.title AS opp_title,
               a.company_name, u.name AS logged_by_name
        FROM bd.activities ac
        JOIN bd.opportunities o ON o.id=ac.opp_id
        JOIN bd.accounts a ON a.id=o.account_id
        LEFT JOIN bd.users u ON u.id=ac.logged_by
        ORDER BY ac.logged_at DESC, ac.id DESC
        LIMIT 10`),
    ]);

    res.json({
      pipeline:          pipeline.rows,
      overdue_followups: followUpCount.rows[0].count,
      pending_approvals: approvalCount.rows[0].count,
      stale_deals:       staleCount.rows[0].count,
      hot_deals:         hotDeals.rows,
      due_follow_ups:    dueFollowUps.rows,
      pending_approval_list: pendingApprovals.rows,
      recent_activities: recentActivities.rows,
    });
  } catch (e) {
    handleDbError(res, e);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// BESS PORTAL
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/bess/clients',            async (req, res) => { const { rows } = await pool.query('SELECT * FROM bess.clients ORDER BY created_at DESC'); res.json({ data: rows }); });
app.get('/api/bess/sites',              async (req, res) => { const { rows } = await pool.query('SELECT s.*,c.company_name FROM bess.sites s JOIN bess.clients c ON c.id=s.client_id ORDER BY s.created_at DESC'); res.json({ data: rows }); });
app.get('/api/bess/units',              async (req, res) => { const { rows } = await pool.query('SELECT * FROM bess.units WHERE is_active=true ORDER BY power_kw'); res.json({ data: rows }); });
app.get('/api/bess/proposals',          async (req, res) => { const { rows } = await pool.query('SELECT p.*,c.company_name FROM bess.proposals p JOIN bess.clients c ON c.id=p.client_id ORDER BY p.created_at DESC'); res.json({ data: rows }); });
app.get('/api/bess/projects',           async (req, res) => { const { rows } = await pool.query('SELECT p.*,c.company_name FROM bess.projects p JOIN bess.clients c ON c.id=p.client_id ORDER BY p.created_at DESC'); res.json({ data: rows }); });
app.get('/api/bess/bess-configurations', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT b.*,s.site_name FROM bess.bess_configurations b JOIN bess.sites s ON s.id=b.site_id ORDER BY b.created_at DESC');
    res.json({ data: rows });
  } catch (e) { handleDbError(res, e); }
});
app.post('/api/bess/bess-configurations', requireAuth, requireRole('admin','bd_exec'), async (req, res) => {
  try {
    const { site_id, config_name, num_units, total_power_kw, total_energy_kwh, coupling_type, application, soc_min, soc_max, charge_hours, discharge_hours } = req.body;
    if (!site_id || !config_name || !num_units) return res.status(400).json({ error: 'site_id, config_name and num_units are required' });
    const { rows } = await pool.query(
      `INSERT INTO bess.bess_configurations (site_id, config_name, num_units, total_power_kw, total_energy_kwh, coupling_type, application, soc_min, soc_max, charge_hours, discharge_hours)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [site_id, config_name, num_units, total_power_kw ?? null, total_energy_kwh ?? null, coupling_type ?? 'AC', application ?? null, soc_min ?? 20, soc_max ?? 90, JSON.stringify(charge_hours ?? []), JSON.stringify(discharge_hours ?? [])]
    );
    res.status(201).json({ data: rows[0] });
  } catch (e) { handleDbError(res, e); }
});
app.get('/api/bess/tariff-structures',  async (req, res) => { const { rows } = await pool.query('SELECT * FROM bess.tariff_structures ORDER BY state'); res.json({ data: rows }); });
app.get('/api/bess/load-profiles',      async (req, res) => { const { site_id } = req.query; const { rows } = await pool.query('SELECT * FROM bess.load_profiles WHERE site_id=$1 ORDER BY year,month', [site_id||1]); res.json({ data: rows }); });

// ════════════════════════════════════════════════════════════════════════════
// AUTOMATION ENGINE
// ════════════════════════════════════════════════════════════════════════════

let lastAutomationRun  = null;
let lastAutomationLog  = [];

async function runAutomation() {
  const log = [];
  const ts  = new Date().toISOString();

  try {
    // ── Rule 1: Mark stale — no activity for 60+ days ─────────────────────
    const r1 = await pool.query(`
      UPDATE bd.opportunities
      SET    stale = true,
             stale_reason = 'no_activity_60d'
      WHERE  closed_at IS NULL
        AND  stage NOT IN ('po_received','lost')
        AND  stale = false
        AND  (last_activity_at IS NULL OR last_activity_at < NOW() - INTERVAL '60 days')
    `);
    if (r1.rowCount > 0) log.push(`Marked ${r1.rowCount} deal(s) stale (60d no activity)`);

    // ── Rule 2: Mark stale — 5+ pending follow-ups with no progression ────
    const r2 = await pool.query(`
      UPDATE bd.opportunities o
      SET    stale = true,
             stale_reason = 'followup_overload'
      WHERE  o.closed_at IS NULL
        AND  o.stage NOT IN ('po_received','lost')
        AND  o.stale = false
        AND  (
          SELECT COUNT(*) FROM bd.follow_ups f
          WHERE  f.opp_id = o.id AND f.status = 'pending'
        ) >= 5
    `);
    if (r2.rowCount > 0) log.push(`Marked ${r2.rowCount} deal(s) stale (5+ pending follow-ups)`);

    // ── Rule 3: Clear stale flag — activity logged within last 14 days ────
    const r3 = await pool.query(`
      UPDATE bd.opportunities
      SET    stale = false,
             stale_reason = NULL
      WHERE  stale = true
        AND  closed_at IS NULL
        AND  last_activity_at > NOW() - INTERVAL '14 days'
    `);
    if (r3.rowCount > 0) log.push(`Cleared stale flag on ${r3.rowCount} deal(s) (recent activity)`);

    // ── Rule 4: Close overdue won deals with PO ────────────────────────────
    // (no-op for now — PO closure is manual)

    lastAutomationRun = ts;
    lastAutomationLog = log.length ? log : ['No changes — pipeline healthy'];
    if (log.length) console.log(`🤖  Automation [${ts}]:`, log.join(' | '));

  } catch (e) {
    lastAutomationLog = [`Error: ${e.message}`];
    console.error('❌  Automation error:', e.message);
  }
}

// ── Auto follow-up helper (called from POST /api/bd/activities) ───────────
async function autoCreateFollowUp(opp_id, assigned_to, baseDateMs) {
  try {
    // Count existing pending follow-ups for this opp
    const { rows: [cnt] } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM bd.follow_ups WHERE opp_id=$1', [opp_id]
    );
    const followUpNumber = cnt.n + 1;

    // T+3 follow-up
    const t3 = new Date(baseDateMs + 3 * 86400000).toISOString().slice(0, 10);
    await pool.query(
      `INSERT INTO bd.follow_ups (opp_id, due_date, type, assigned_to, status, follow_up_number)
       VALUES ($1,$2,'call',$3,'pending',$4)
       ON CONFLICT DO NOTHING`,
      [opp_id, t3, assigned_to ?? null, followUpNumber]
    );
  } catch (e) {
    console.warn('⚠️  Auto follow-up creation failed:', e.message);
  }
}

// ── Manual trigger endpoint ───────────────────────────────────────────────
app.post('/api/bd/automation/run', requireAuth, requireRole('admin'), async (req, res) => {
  await runAutomation();
  res.json({ ran_at: lastAutomationRun, log: lastAutomationLog });
});

app.get('/api/bd/automation/status', (req, res) => {
  res.json({ last_run: lastAutomationRun, log: lastAutomationLog });
});

// ═══════════════════════════════════════════════════════════════════════════
// BESS WRITE ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// ── Clients ──────────────────────────────────────────────────────────────
app.post('/api/bess/clients', requireAuth, requireRole('admin','bd_exec'), async (req, res) => {
  try {
    const {
      company_name, contact_person, email, phone, city, state, gstin,
      alternate_contact, alternate_phone, website, industry_type,
      lead_status, bd_name, requirement_kwh, project_type, meeting_date,
      timeline, qualified, budgetary_quote, tech_discussion, tc_offer,
      final_quote, remarks
    } = req.body;
    if (!company_name) return res.status(400).json({ error: 'company_name required' });
    const { rows: [c] } = await pool.query(
      `INSERT INTO bess.clients
         (company_name, contact_person, email, phone, city, state, gstin,
          alternate_contact, alternate_phone, website, industry_type,
          lead_status, bd_name, requirement_kwh, project_type, meeting_date,
          timeline, qualified, budgetary_quote, tech_discussion, tc_offer, final_quote, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
       RETURNING *`,
      [company_name, contact_person||null, email||null, phone||null, city||null, state||null, gstin||null,
       alternate_contact||null, alternate_phone||null, website||null, industry_type||null,
       lead_status||'new', bd_name||null, requirement_kwh||null, project_type||null,
       meeting_date||null, timeline||null, qualified||false, budgetary_quote||false,
       tech_discussion||false, tc_offer||false, final_quote||false, remarks||null]
    );
    res.json({ data: c });
  } catch (e) { handleDbError(res, e); }
});

// ── PATCH client ──────────────────────────────────────────────────────────
app.patch('/api/bess/clients/:id', requireAuth, requireRole('admin','bd_exec'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      company_name, contact_person, email, phone, city, state, gstin,
      alternate_contact, alternate_phone, website, industry_type,
      lead_status, bd_name, requirement_kwh, project_type, meeting_date,
      timeline, qualified, budgetary_quote, tech_discussion, tc_offer,
      final_quote, remarks
    } = req.body;

    if (!company_name) return res.status(400).json({ error: 'company_name required' });

    const { rows: [c] } = await pool.query(
      `UPDATE bess.clients
       SET company_name=$1, contact_person=$2, email=$3, phone=$4,
           city=$5, state=$6, gstin=$7,
           alternate_contact=$8, alternate_phone=$9, website=$10, industry_type=$11,
           lead_status=$12, bd_name=$13, requirement_kwh=$14, project_type=$15,
           meeting_date=$16, timeline=$17, qualified=$18, budgetary_quote=$19,
           tech_discussion=$20, tc_offer=$21, final_quote=$22, remarks=$23,
           updated_at=NOW()
       WHERE id=$24 RETURNING *`,
      [company_name, contact_person||null, email||null, phone||null,
       city||null, state||null, gstin||null,
       alternate_contact||null, alternate_phone||null, website||null, industry_type||null,
       lead_status||'new', bd_name||null, requirement_kwh||null, project_type||null,
       meeting_date||null, timeline||null, qualified||false, budgetary_quote||false,
       tech_discussion||false, tc_offer||false, final_quote||false, remarks||null,
       id]
    );
    if (!c) return res.status(404).json({ error: 'Client not found' });

    // Async sync to Google Sheet — fire and forget
    const webhookUrl = process.env.SHEETS_WEBHOOK_URL;
    if (webhookUrl) {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c),
      }).catch(err => console.warn('Sheet sync failed:', err.message));
    }

    res.json({ data: c });
  } catch (e) { handleDbError(res, e); }
});

// ── Geocode helper (Nominatim, no key required) ───────────────────────────
async function geocode(address, state) {
  try {
    const q = encodeURIComponent([address, state, 'India'].filter(Boolean).join(', '));
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=in`,
      { headers: { 'User-Agent': 'UnityESS-BESSPortal/1.0 (kedar@ornatesolar.com)' } }
    );
    const data = await resp.json();
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

// ── Sites ─────────────────────────────────────────────────────────────────
app.post('/api/bess/sites', requireAuth, requireRole('admin','bd_exec'), async (req, res) => {
  try {
    const { client_id, site_name, address, state, discom, tariff_category,
            sanctioned_load_kva, contract_demand_kva, connection_voltage_kv, meter_number,
            lat, lng } = req.body;
    if (!client_id || !site_name) return res.status(400).json({ error: 'client_id and site_name required' });

    // Auto-geocode if no coords provided and address/state available
    let coords = (lat && lng) ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null;
    if (!coords && (address || state)) {
      coords = await geocode(address, state);
    }

    const { rows: [s] } = await pool.query(
      `INSERT INTO bess.sites (client_id, site_name, address, state, discom, tariff_category,
         sanctioned_load_kva, contract_demand_kva, connection_voltage_kv, meter_number, lat, lng)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [client_id, site_name, address||null, state||null, discom||null, tariff_category||null,
       sanctioned_load_kva||null, contract_demand_kva||null, connection_voltage_kv||null,
       meter_number||null, coords?.lat||null, coords?.lng||null]
    );
    res.json({ data: s });
  } catch (e) { handleDbError(res, e); }
});

// ── PATCH site (update coords or details) ────────────────────────────────
app.patch('/api/bess/sites/:id', requireAuth, requireRole('admin','bd_exec'), async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;
    const { rows: [s] } = await pool.query(
      `UPDATE bess.sites SET lat=$1, lng=$2 WHERE id=$3 RETURNING *`,
      [lat||null, lng||null, id]
    );
    if (!s) return res.status(404).json({ error: 'Site not found' });
    res.json({ data: s });
  } catch (e) { handleDbError(res, e); }
});

// ── Cycle Datasets (from IEC-certified LFP test data) ────────────────────
const CYCLE_DATASETS = {
  q25c_365: {
    label: '0.25C / 365 cycles/yr',
    description: 'Standard C&I ToD arbitrage — once-daily discharge at 0.25C rate',
    cycles_per_year: 365,
    years: [
      { year:1,  soh:0.9609, rte:0.9390 }, { year:2,  soh:0.9303, rte:0.9385 },
      { year:3,  soh:0.9013, rte:0.9360 }, { year:4,  soh:0.8814, rte:0.9343 },
      { year:5,  soh:0.8658, rte:0.9330 }, { year:6,  soh:0.8559, rte:0.9321 },
      { year:7,  soh:0.8422, rte:0.9309 }, { year:8,  soh:0.8244, rte:0.9294 },
      { year:9,  soh:0.8103, rte:0.9282 }, { year:10, soh:0.7971, rte:0.9270 },
      { year:11, soh:0.7846, rte:0.9260 }, { year:12, soh:0.7747, rte:0.9251 },
      { year:13, soh:0.7649, rte:0.9243 }, { year:14, soh:0.7556, rte:0.9235 },
      { year:15, soh:0.7466, rte:0.9227 }, { year:16, soh:0.7375, rte:0.9219 },
      { year:17, soh:0.7292, rte:0.9212 }, { year:18, soh:0.7209, rte:0.9205 },
      { year:19, soh:0.7124, rte:0.9197 }, { year:20, soh:0.7046, rte:0.9191 },
    ],
  },
  h5c_365: {
    label: '0.5C / 365 cycles/yr',
    description: 'Heavy C&I / industrial — once-daily at 0.5C (faster discharge, higher stress)',
    cycles_per_year: 365,
    years: [
      { year:1,  soh:0.9531, rte:0.9280 }, { year:2,  soh:0.9263, rte:0.9263 },
      { year:3,  soh:0.8973, rte:0.9241 }, { year:4,  soh:0.8769, rte:0.9225 },
      { year:5,  soh:0.8629, rte:0.9214 }, { year:6,  soh:0.8529, rte:0.9207 },
      { year:7,  soh:0.8396, rte:0.9197 }, { year:8,  soh:0.8210, rte:0.9183 },
      { year:9,  soh:0.8065, rte:0.9171 }, { year:10, soh:0.7919, rte:0.9160 },
      { year:11, soh:0.7773, rte:0.9149 }, { year:12, soh:0.7629, rte:0.9138 },
      { year:13, soh:0.7483, rte:0.9127 }, { year:14, soh:0.7339, rte:0.9116 },
      { year:15, soh:0.7194, rte:0.9105 }, { year:16, soh:0.7049, rte:0.9094 },
      { year:17, soh:0.6905, rte:0.9083 }, { year:18, soh:0.6761, rte:0.9072 },
      { year:19, soh:0.6617, rte:0.9061 }, { year:20, soh:0.6472, rte:0.9050 },
    ],
  },
  h5c_730: {
    label: '0.5C / 730 cycles/yr',
    description: 'Utility / dual-shift — twice-daily discharge, high throughput applications',
    cycles_per_year: 730,
    years: [
      { year:1,  soh:0.9323, rte:0.9280 }, { year:2,  soh:0.8877, rte:0.9233 },
      { year:3,  soh:0.8526, rte:0.9207 }, { year:4,  soh:0.8163, rte:0.9179 },
      { year:5,  soh:0.7907, rte:0.9159 }, { year:6,  soh:0.7716, rte:0.9145 },
      { year:7,  soh:0.7491, rte:0.9128 }, { year:8,  soh:0.7293, rte:0.9113 },
      { year:9,  soh:0.7104, rte:0.9098 }, { year:10, soh:0.6920, rte:0.9084 },
      { year:11, soh:0.6743, rte:0.9071 }, { year:12, soh:0.6574, rte:0.9058 },
      { year:13, soh:0.6410, rte:0.9045 }, { year:14, soh:0.6255, rte:0.9034 },
      { year:15, soh:0.6107, rte:0.9022 }, { year:16, soh:0.6000, rte:0.9014 },
    ],
  },
};

app.get('/api/bess/cycle-datasets', (req, res) => {
  res.json({ data: CYCLE_DATASETS });
});

// ── Gemini Bill Parser ────────────────────────────────────────────────────
app.post('/api/bess/parse-bill', requireAuth, requireRole('admin','bd_exec'), async (req, res) => {
  try {
    const { fileData, mimeType } = req.body;
    if (!fileData || !mimeType) return res.status(400).json({ error: 'fileData and mimeType required' });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY not configured on server' });

    const prompt = `You are analyzing an Indian electricity bill or load data document. Extract these fields and return ONLY a valid JSON object, no explanation:\n{"total_units_kwh":number|null,"max_demand_kw":number|null,"peak_demand_kw":number|null,"tod_peak_kwh":number|null,"tod_offpeak_kwh":number|null,"tod_night_kwh":number|null,"month":number|null,"year":number|null,"sanctioned_load_kva":number|null,"contract_demand_kva":number|null,"tariff_category":string|null,"discom":string|null,"total_amount_inr":number|null,"consumer_name":string|null,"meter_number":string|null}\nUse null for missing fields. Numbers as plain decimals only.`;

    const ctrl1 = new AbortController();
    const t1 = setTimeout(() => ctrl1.abort(), 8000);
    let gr;
    try {
      gr = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl1.signal,
          body: JSON.stringify({
            contents: [{ parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: fileData } },
            ]}],
            generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
          }),
        }
      );
    } catch (e) {
      clearTimeout(t1);
      if (e.name === 'AbortError') return res.status(503).json({ error: 'AI service timed out — please try again or use manual entry.' });
      throw e;
    }
    clearTimeout(t1);
    const gd = await gr.json();
    if (gd.error) return res.status(502).json({ error: gd.error.message });
    const text = gd?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return res.status(422).json({ error: 'Could not parse document — try a clearer scan or manual input.' });
    res.json({ data: JSON.parse(match[0]) });
  } catch (e) { handleDbError(res, e); }
});

// ── Gemini BESS Recommendation ────────────────────────────────────────────
app.post('/api/bess/recommend', requireAuth, requireRole('admin','bd_exec'), async (req, res) => {
  try {
    const { load_data, available_units } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });
    if (!load_data) return res.status(400).json({ error: 'load_data required' });

    const unitsSummary = (available_units || [])
      .filter(u => u.price_ex_gst > 0)
      .map(u => `${u.model}: ${u.power_kw}kW / ${u.energy_kwh}kWh @ ₹${(u.price_ex_gst/1e5).toFixed(1)}L ex-GST`)
      .join('\n');

    const prompt = `You are a senior BESS application engineer for Indian C&I projects (LFP chemistry, AC-coupled, CERC/CEA context). The sizing engine has already computed the configuration mathematically. Your role is ONLY to provide expert narrative and trade-off commentary — do NOT recalculate or override numbers.

Available UnityESS models:
${unitsSummary || 'UESS-A-125-261: 125kW / 261kWh @ ₹90.0L, UESS-A2-215-418: 215kW / 418kWh @ ₹145.0L'}

Sizing inputs and context:
${JSON.stringify(load_data, null, 2)}

Your task:
- Identify the key sizing driver (e.g. "peak demand window", "DG runtime", "ToD spread")
- Explain why the recommended unit count is appropriate for the application
- Compare economical vs recommended — what the extra capacity buys (dispatchable headroom, degradation buffer, future load growth)
- Note any Indian regulatory or operational context relevant to the configuration (CERC BESS 2022, IS 16270, CEA Grid Connectivity 2023)
- Provide a realistic tariff_diff_assumed_rs_kwh based on the use case (ToD: 3–5, DG: 20–28 net of grid charge)

Return ONLY valid JSON (no markdown, no code fences). Keep all string values under 200 characters. Schema:
{"primary":{"unit_model":string,"unit_count":number,"total_kwh":number,"total_kw":number,"application":string,"reasoning":string},"alternatives":[{"unit_model":string,"unit_count":number,"total_kwh":number,"label":string,"note":string},{"unit_model":string,"unit_count":number,"total_kwh":number,"label":string,"note":string}],"sizing_logic":{"key_driver":string,"recommended_capacity_kwh":number,"recommended_power_kw":number,"rationale":string},"financial_estimate":{"annual_savings_inr":number,"simple_payback_years":number,"tariff_diff_assumed_rs_kwh":number,"assumptions":string}}`;

    const ctrl2 = new AbortController();
    const t2 = setTimeout(() => ctrl2.abort(), 8000);
    let gr;
    try {
      gr = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl2.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.15, maxOutputTokens: 8192 },
          }),
        }
      );
    } catch (e) {
      clearTimeout(t2);
      if (e.name === 'AbortError') return res.status(503).json({ error: 'AI recommendation timed out — the sizing result is still valid, AI commentary unavailable.' });
      throw e;
    }
    clearTimeout(t2);
    const gd = await gr.json();
    if (gd.error) return res.status(502).json({ error: gd.error.message });
    const text = gd?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return res.status(422).json({ error: 'Gemini did not return a valid recommendation. Try again.' });
    let parsed;
    try { parsed = JSON.parse(match[0]); }
    catch (pe) { return res.status(422).json({ error: 'Gemini response could not be parsed. Try again.' }); }
    res.json({ data: parsed });
  } catch (e) { handleDbError(res, e); }
});

// ── EPC Configurator — AI narrative ────────────────────────────────────────
app.post('/api/epc/size-narrative', requireAuth, requireRole('admin','bd_exec'), async (req, res) => {
  try {
    const {
      systemKwpDC, annualGenKwh, capexTotal, year1Savings,
      paybackYrs, irr, npv, gridTariff, systemType,
      sizingRationale, selfConsumedKwh, exportedKwh,
    } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });

    const prompt = `You are a senior Solar EPC engineer for Indian C&I projects (MNRE, CERC, CEA context). A sizing engine has already computed the following solar PV configuration mathematically. Your role is ONLY to provide a concise expert narrative — do NOT recalculate numbers.

Solar EPC Configuration:
- System type: ${systemType}
- DC capacity: ${Number(systemKwpDC).toFixed(1)} kWp
- Annual generation: ${(Number(annualGenKwh)/1000).toFixed(1)} MWh/year
- Self-consumed: ${(Number(selfConsumedKwh)/1000).toFixed(1)} MWh/year | Exported: ${(Number(exportedKwh)/1000).toFixed(1)} MWh/year
- CAPEX: ₹${(Number(capexTotal)/1e5).toFixed(2)}L ex-GST
- Grid tariff: ₹${Number(gridTariff).toFixed(2)}/kWh
- Year 1 savings: ₹${(Number(year1Savings)/1e5).toFixed(2)}L
- Simple payback: ${Number(paybackYrs).toFixed(1)} years
- IRR (25yr): ${Number(irr).toFixed(1)}%
- NPV (10%, 25yr): ₹${(Number(npv)/1e5).toFixed(2)}L
- Sizing basis: ${sizingRationale}

Write a 4–6 sentence plain-language narrative that:
1. Validates the sizing logic and highlights key assumptions
2. Comments on the financial viability for an Indian C&I buyer (payback, IRR context)
3. Notes any relevant Indian regulatory context (net metering, PM Surya Ghar, MNRE norms, DISCOM guidelines)
4. Flags any risks or considerations (shading, module degradation, net metering caps, DISCOM approval timeline)

Return plain text only — no JSON, no markdown, no headers. Just the narrative paragraph.`;

    const gr = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
        }),
      }
    );
    const gd = await gr.json();
    if (gd.error) return res.status(502).json({ error: gd.error.message });
    const narrative = gd?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Narrative unavailable.';
    res.json({ data: { narrative } });
  } catch (e) { handleDbError(res, e); }
});

// ── Proposals ─────────────────────────────────────────────────────────────
app.post('/api/bess/proposals', requireAuth, requireRole('admin','bd_exec'), async (req, res) => {
  try {
    const { client_id, site_id, bess_config_id, project_id, proposal_date, status,
            capex_ex_gst, annual_savings, payback_years, irr_percent, validity_days, notes } = req.body;
    if (!client_id)    return res.status(400).json({ error: 'client_id required' });
    if (!capex_ex_gst) return res.status(400).json({ error: 'capex_ex_gst required' });
    const { rows: [{ count }] } = await pool.query('SELECT COUNT(*) FROM bess.proposals');
    const propNum = `PROP-${new Date().getFullYear()}-${String(parseInt(count)+1).padStart(4,'0')}`;
    const { rows: [p] } = await pool.query(
      `INSERT INTO bess.proposals (client_id, site_id, bess_config_id, project_id, proposal_number, proposal_date,
         status, capex_ex_gst, annual_savings, payback_years, irr_percent, validity_days, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [client_id, site_id||null, bess_config_id||null, project_id||null, propNum,
       proposal_date||new Date().toISOString().split('T')[0],
       status||'draft', capex_ex_gst||null, annual_savings||null,
       payback_years||null, irr_percent||null, validity_days||30, notes||null]
    );
    res.json({ data: p });
  } catch (e) { handleDbError(res, e); }
});

app.patch('/api/bess/proposals/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, capex_ex_gst, annual_savings, payback_years, irr_percent, validity_days } = req.body;
    const VALID_STATUSES = ['draft','sent','negotiation','won','lost'];
    if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const updates = []; const vals = []; let i = 1;
    if (status        !== undefined) { updates.push(`status=$${i++}`);        vals.push(status); }
    if (notes         !== undefined) { updates.push(`notes=$${i++}`);         vals.push(notes); }
    if (capex_ex_gst  !== undefined) { updates.push(`capex_ex_gst=$${i++}`);  vals.push(capex_ex_gst); }
    if (annual_savings !== undefined){ updates.push(`annual_savings=$${i++}`); vals.push(annual_savings); }
    if (payback_years !== undefined) { updates.push(`payback_years=$${i++}`); vals.push(payback_years); }
    if (irr_percent   !== undefined) { updates.push(`irr_percent=$${i++}`);   vals.push(irr_percent); }
    if (validity_days !== undefined) { updates.push(`validity_days=$${i++}`); vals.push(validity_days); }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(id);
    await pool.query(`UPDATE bess.proposals SET ${updates.join(',')} WHERE id=$${i}`, vals);
    res.json({ ok: true });
  } catch (e) { handleDbError(res, e); }
});

// ── Projects ──────────────────────────────────────────────────────────────
app.post('/api/bess/projects', requireAuth, async (req, res) => {
  try {
    const { client_id, site_id, proposal_id, status, po_number, po_value_inr,
            installation_date, commissioning_date, warranty_expiry } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });
    const { rows: [{ count }] } = await pool.query('SELECT COUNT(*) FROM bess.projects');
    const code = `PROJ-${new Date().getFullYear()}-${String(parseInt(count)+1).padStart(4,'0')}`;
    const { rows: [pj] } = await pool.query(
      `INSERT INTO bess.projects (client_id, site_id, proposal_id, project_code, status,
         po_number, po_value_inr, installation_date, commissioning_date, warranty_expiry)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [client_id, site_id||null, proposal_id||null, code, status||'lead',
       po_number||null, po_value_inr||null,
       installation_date||null, commissioning_date||null, warranty_expiry||null]
    );
    res.json({ data: pj });
  } catch (e) { handleDbError(res, e); }
});

app.patch('/api/bess/projects/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, po_number, po_value_inr, installation_date, commissioning_date, warranty_expiry } = req.body;
    const fields = [], vals = [];
    if (status             !== undefined) { fields.push(`status=$${fields.length+1}`);              vals.push(status); }
    if (po_number          !== undefined) { fields.push(`po_number=$${fields.length+1}`);           vals.push(po_number || null); }
    if (po_value_inr       !== undefined) { fields.push(`po_value_inr=$${fields.length+1}`);        vals.push(po_value_inr || null); }
    if (installation_date  !== undefined) { fields.push(`installation_date=$${fields.length+1}`);   vals.push(installation_date || null); }
    if (commissioning_date !== undefined) { fields.push(`commissioning_date=$${fields.length+1}`);  vals.push(commissioning_date || null); }
    if (warranty_expiry    !== undefined) { fields.push(`warranty_expiry=$${fields.length+1}`);     vals.push(warranty_expiry || null); }
    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
    vals.push(id);
    const { rows: [pj] } = await pool.query(
      `UPDATE bess.projects SET ${fields.join(', ')} WHERE id=$${vals.length} RETURNING *`, vals
    );
    if (!pj) return res.status(404).json({ error: 'Project not found' });
    res.json({ data: pj });
  } catch (e) { handleDbError(res, e); }
});

// ── Load Profiles ─────────────────────────────────────────────────────────
app.post('/api/bess/load-profiles', requireAuth, async (req, res) => {
  try {
    const { site_id, month, year, total_units_kwh, max_demand_kw,
            peak_demand_kw, tod_peak_kwh, tod_offpeak_kwh, tod_night_kwh } = req.body;
    if (!site_id || !month || !year) return res.status(400).json({ error: 'site_id, month, year required' });
    const { rows: [lp] } = await pool.query(
      `INSERT INTO bess.load_profiles
         (site_id, month, year, total_units_kwh, max_demand_kw, peak_demand_kw,
          tod_peak_kwh, tod_offpeak_kwh, tod_night_kwh)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (site_id, month, year)
       DO UPDATE SET total_units_kwh=EXCLUDED.total_units_kwh, max_demand_kw=EXCLUDED.max_demand_kw,
         peak_demand_kw=EXCLUDED.peak_demand_kw, tod_peak_kwh=EXCLUDED.tod_peak_kwh,
         tod_offpeak_kwh=EXCLUDED.tod_offpeak_kwh, tod_night_kwh=EXCLUDED.tod_night_kwh
       RETURNING *`,
      [site_id, month, year, total_units_kwh||0, max_demand_kw||0, peak_demand_kw||0,
       tod_peak_kwh||0, tod_offpeak_kwh||0, tod_night_kwh||0]
    );
    res.json({ data: lp });
  } catch (e) { handleDbError(res, e); }
});

// ── Tariff Structures ─────────────────────────────────────────────────────
app.post('/api/bess/tariff-structures', requireAuth, async (req, res) => {
  try {
    const { state, discom, tariff_category, effective_date,
            energy_charge_peak, energy_charge_offpeak, demand_charge, fixed_charge } = req.body;
    if (!state || !discom) return res.status(400).json({ error: 'state and discom required' });
    const { rows: [t] } = await pool.query(
      `INSERT INTO bess.tariff_structures
         (state, discom, tariff_category, effective_date,
          energy_charge_peak, energy_charge_offpeak, demand_charge, fixed_charge)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [state, discom, tariff_category||null, effective_date||null,
       energy_charge_peak||null, energy_charge_offpeak||null, demand_charge||null, fixed_charge||null]
    );
    res.json({ data: t });
  } catch (e) { handleDbError(res, e); }
});

// ── Coverage Table (all active SKUs in a category vs a requirement) ───────
app.get('/api/bess/coverage-table', async (req, res) => {
  try {
    const { category, validated_kwh, recommended_uplift_pct = 15,
            soc_window = 0.90, soh_yr1 = 0.9609, rte_yr1 = 0.9390 } = req.query;
    if (!category || !validated_kwh) return res.status(400).json({ error: 'category and validated_kwh required' });

    const req_kwh = parseFloat(validated_kwh);
    const uplift  = parseFloat(recommended_uplift_pct) / 100;
    const soc     = parseFloat(soc_window);
    const soh     = parseFloat(soh_yr1);
    const rte     = parseFloat(rte_yr1);
    const dispatch_factor = soh * rte * soc;   // yr-1 at-meter factor

    const { rows: skus } = await pool.query(
      `SELECT id, model, power_kw, energy_kwh, price_ex_gst
       FROM bess.units
       WHERE is_active = true AND category = $1
       ORDER BY energy_kwh`,
      [category]
    );

    const table = skus.map(u => {
      const econ_units  = Math.max(1, Math.ceil(req_kwh / parseFloat(u.energy_kwh)));
      const recom_units = Math.max(1, Math.ceil((req_kwh * (1 + uplift)) / (parseFloat(u.energy_kwh) * dispatch_factor)));
      const price       = parseFloat(u.price_ex_gst);
      return {
        sku_id:            u.id,
        sku_model:         u.model,
        sku_energy_kwh:    parseFloat(u.energy_kwh),
        sku_power_kw:      parseFloat(u.power_kw),
        sku_price_ex_gst:  price,
        econ_units,
        econ_total_kwh:    econ_units  * parseFloat(u.energy_kwh),
        econ_total_kw:     econ_units  * parseFloat(u.power_kw),
        econ_capex:        econ_units  * price,
        recom_units,
        recom_total_kwh:   recom_units * parseFloat(u.energy_kwh),
        recom_total_kw:    recom_units * parseFloat(u.power_kw),
        recom_capex:       recom_units * price,
        recom_dispatchable_yr1: recom_units * parseFloat(u.energy_kwh) * dispatch_factor,
        priced:            price > 0,
      };
    });

    res.json({ data: table });
  } catch (e) { handleDbError(res, e); }
});

// ── Save Sizing Analysis ───────────────────────────────────────────────────
app.post('/api/bess/sizing-analyses', requireAuth, async (req, res) => {
  try {
    const {
      client_id, site_id, use_case, site_state, sku_category,
      load_kwh_per_day, peak_demand_kw, dg_runtime_hours, backup_hours, diesel_price_rs_l,
      raw_energy_kwh, derate_factor, validated_energy_kwh, required_power_kw,
      sizing_basis, soc_window, ac_dc_loss_pct, recommended_uplift_pct, created_by
    } = req.body;
    if (!use_case || !sku_category || !validated_energy_kwh)
      return res.status(400).json({ error: 'use_case, sku_category, validated_energy_kwh required' });

    const { rows: [row] } = await pool.query(
      `INSERT INTO bess.sizing_analyses
         (client_id, site_id, use_case, site_state, sku_category,
          load_kwh_per_day, peak_demand_kw, dg_runtime_hours, backup_hours, diesel_price_rs_l,
          raw_energy_kwh, derate_factor, validated_energy_kwh, required_power_kw,
          sizing_basis, soc_window, ac_dc_loss_pct, recommended_uplift_pct, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING *`,
      [client_id||null, site_id||null, use_case, site_state||null, sku_category,
       load_kwh_per_day||null, peak_demand_kw||null, dg_runtime_hours||null,
       backup_hours||null, diesel_price_rs_l||null,
       raw_energy_kwh, derate_factor, validated_energy_kwh, required_power_kw,
       sizing_basis||null, soc_window||0.90, ac_dc_loss_pct||0.05,
       recommended_uplift_pct||15, created_by||null]
    );
    res.json({ data: row });
  } catch (e) { handleDbError(res, e); }
});

app.get('/api/bess/sizing-analyses', async (req, res) => {
  try {
    const { client_id } = req.query;
    const where = client_id ? 'WHERE sa.client_id = $1' : '';
    const params = client_id ? [client_id] : [];
    const { rows } = await pool.query(
      `SELECT sa.*, c.company_name
       FROM bess.sizing_analyses sa
       LEFT JOIN bess.clients c ON c.id = sa.client_id
       ${where}
       ORDER BY sa.created_at DESC`,
      params
    );
    res.json({ data: rows });
  } catch (e) { handleDbError(res, e); }
});

// ── Save Recommendation Record ─────────────────────────────────────────────
app.post('/api/bess/recommendation-records', requireAuth, async (req, res) => {
  try {
    const {
      sizing_analysis_id, client_id,
      sku_id, sku_model, sku_energy_kwh, sku_power_kw, sku_price_ex_gst,
      econ_units, econ_total_kwh, econ_total_kw, econ_capex,
      recom_units, recom_total_kwh, recom_total_kw, recom_capex, recom_dispatchable_yr1,
      selected_config, cycle_dataset_key, coverage_table, gemini_commentary
    } = req.body;
    if (!sku_model || econ_units == null || recom_units == null)
      return res.status(400).json({ error: 'sku_model, econ_units, recom_units required' });

    const { rows: [row] } = await pool.query(
      `INSERT INTO bess.recommendation_records
         (sizing_analysis_id, client_id,
          sku_id, sku_model, sku_energy_kwh, sku_power_kw, sku_price_ex_gst,
          econ_units, econ_total_kwh, econ_total_kw, econ_capex,
          recom_units, recom_total_kwh, recom_total_kw, recom_capex, recom_dispatchable_yr1,
          selected_config, cycle_dataset_key, coverage_table, gemini_commentary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING *`,
      [sizing_analysis_id||null, client_id||null,
       sku_id||null, sku_model, sku_energy_kwh, sku_power_kw, sku_price_ex_gst,
       econ_units, econ_total_kwh, econ_total_kw, econ_capex,
       recom_units, recom_total_kwh, recom_total_kw, recom_capex, recom_dispatchable_yr1||null,
       selected_config||null, cycle_dataset_key||null,
       coverage_table ? JSON.stringify(coverage_table) : null,
       gemini_commentary ? JSON.stringify(gemini_commentary) : null]
    );
    res.json({ data: row });
  } catch (e) { handleDbError(res, e); }
});

app.patch('/api/bess/recommendation-records/:id', requireAuth, async (req, res) => {
  try {
    const { selected_config, gemini_commentary } = req.body;
    const { rows: [row] } = await pool.query(
      `UPDATE bess.recommendation_records
       SET selected_config = COALESCE($1, selected_config),
           gemini_commentary = COALESCE($2, gemini_commentary)
       WHERE id = $3 RETURNING *`,
      [selected_config||null,
       gemini_commentary ? JSON.stringify(gemini_commentary) : null,
       req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ data: row });
  } catch (e) { handleDbError(res, e); }
});

app.get('/api/bess/recommendation-records', async (req, res) => {
  try {
    const { client_id, sizing_analysis_id } = req.query;
    const conditions = [];
    const params = [];
    if (client_id)           { params.push(client_id);           conditions.push(`client_id = $${params.length}`); }
    if (sizing_analysis_id)  { params.push(sizing_analysis_id);  conditions.push(`sizing_analysis_id = $${params.length}`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT * FROM bess.recommendation_records ${where} ORDER BY created_at DESC`,
      params
    );
    res.json({ data: rows });
  } catch (e) { handleDbError(res, e); }
});

// ── Save Finance Record ────────────────────────────────────────────────────
app.post('/api/bess/finance-records', requireAuth, async (req, res) => {
  try {
    const {
      recommendation_id, client_id, selected_config, capex_ex_gst,
      use_case, benefit_rs_kwh, cycles_per_year, cycle_dataset_key,
      om_rate_pct, om_escalation_pct, analysis_horizon_years,
      tariff_structure_id, tariff_snapshot,
      annual_savings_yr1, simple_payback_years, break_even_year,
      irr_10yr_pct, npv_10yr_rs, roi_10yr_pct, cashflow_rows
    } = req.body;
    if (!selected_config || !capex_ex_gst || !use_case)
      return res.status(400).json({ error: 'selected_config, capex_ex_gst, use_case required' });

    const { rows: [row] } = await pool.query(
      `INSERT INTO bess.finance_records
         (recommendation_id, client_id, selected_config, capex_ex_gst,
          use_case, benefit_rs_kwh, cycles_per_year, cycle_dataset_key,
          om_rate_pct, om_escalation_pct, analysis_horizon_years,
          tariff_structure_id, tariff_snapshot,
          annual_savings_yr1, simple_payback_years, break_even_year,
          irr_10yr_pct, npv_10yr_rs, roi_10yr_pct, cashflow_rows)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING *`,
      [recommendation_id||null, client_id||null, selected_config, capex_ex_gst,
       use_case, benefit_rs_kwh||null, cycles_per_year||null, cycle_dataset_key||null,
       om_rate_pct||1.5, om_escalation_pct||3.0, analysis_horizon_years||10,
       tariff_structure_id||null,
       tariff_snapshot ? JSON.stringify(tariff_snapshot) : null,
       annual_savings_yr1||null, simple_payback_years||null, break_even_year||null,
       irr_10yr_pct||null, npv_10yr_rs||null, roi_10yr_pct||null,
       cashflow_rows ? JSON.stringify(cashflow_rows) : null]
    );
    res.json({ data: row });
  } catch (e) { handleDbError(res, e); }
});

app.get('/api/bess/finance-records', async (req, res) => {
  try {
    const { recommendation_id, client_id } = req.query;
    const conditions = [];
    const params = [];
    if (recommendation_id)  { params.push(recommendation_id); conditions.push(`recommendation_id = $${params.length}`); }
    if (client_id)          { params.push(client_id);         conditions.push(`client_id = $${params.length}`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT * FROM bess.finance_records ${where} ORDER BY computed_at DESC`,
      params
    );
    res.json({ data: rows });
  } catch (e) { handleDbError(res, e); }
});

// ── Global JSON error handler (prevents HTML 500 responses) ──────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
});

// ── Run migrations on cold start ─────────────────────────────────────────
runMigrations().catch(e => console.error('Migration error:', e.message));

// ── Export for Vercel serverless; listen only in dev ──────────────────────
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, async () => {
    console.log(`\n🚀  API → http://localhost:${PORT}`);
    console.log(`🔍  Health → http://localhost:${PORT}/health\n`);
    // Short delay to let DB pool stabilise before first automation run
    setTimeout(() => {
      runAutomation().then(() => {
        setInterval(runAutomation, 60 * 60 * 1000); // hourly
      });
    }, 3000);
  });
}