#!/usr/bin/env node
/**
 * Create a BD portal user.
 * Usage:
 *   node apps/api/scripts/create-user.js \
 *     --name "Kedar Bala" \
 *     --email "kedar@ornatesolar.com" \
 *     --password "your-password" \
 *     --role "admin"
 *
 * Roles: admin | bd_manager | bd_exec | approver | viewer
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const { Pool }  = require('pg');
const bcrypt    = require('bcryptjs');

const args = process.argv.slice(2).reduce((acc, val, i, arr) => {
  if (val.startsWith('--')) acc[val.slice(2)] = arr[i + 1];
  return acc;
}, {});

const { name, email, password, role = 'bd_exec' } = args;

if (!name || !email || !password) {
  console.error('Usage: node create-user.js --name "Full Name" --email "email@domain.com" --password "pass" [--role admin]');
  process.exit(1);
}

const VALID_ROLES = ['admin', 'bd_manager', 'bd_exec', 'approver', 'viewer'];
if (!VALID_ROLES.includes(role)) {
  console.error(`Invalid role "${role}". Must be one of: ${VALID_ROLES.join(', ')}`);
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  // Check if user already exists
  const { rows: [existing] } = await pool.query(
    'SELECT id, email FROM bd.users WHERE email = $1',
    [email.toLowerCase().trim()]
  );

  if (existing) {
    console.error(`❌  User already exists: ${existing.email} (id=${existing.id})`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);

  const { rows: [user] } = await pool.query(
    `INSERT INTO bd.users (name, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, $4, true) RETURNING id, name, email, role`,
    [name.trim(), email.toLowerCase().trim(), hash, role]
  );

  console.log(`✅  User created:`);
  console.log(`    ID:    ${user.id}`);
  console.log(`    Name:  ${user.name}`);
  console.log(`    Email: ${user.email}`);
  console.log(`    Role:  ${user.role}`);
  process.exit(0);
}

main().catch(e => {
  console.error('❌  Error:', e.message);
  process.exit(1);
}).finally(() => pool.end());
