/* eslint-disable no-console */
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { supabaseAdmin, q } from '../services/supabaseAdmin.js';
import { SCHEMA_SQL, EXPECTED_TABLES } from './schema.js';
import { seed } from './seed.js';

const projectRef = () => {
  try {
    return new URL(env.supabaseUrl).hostname.split('.')[0];
  } catch {
    return '';
  }
};

/* ---------------- DDL transport 1: Supabase Management API ---------------- */
async function runSql(sql) {
  const ref = projectRef();
  if (!ref || !env.supabaseAccessToken) return false;
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.supabaseAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`Management API ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return true;
}

async function runViaManagementApi() {
  const ok = await runSql(SCHEMA_SQL);
  if (!ok) return false;
  console.log('✔ Schema applied via Supabase Management API');
  // Ask PostgREST to drop its schema cache, otherwise new tables 404 for a few seconds.
  await runSql(`NOTIFY pgrst, 'reload schema';`).catch(() => {});
  return true;
}

/* ---------------- DDL transport 2: direct Postgres connection --------------- */
async function runViaPostgres() {
  if (!env.supabaseDbUrl) return false;
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: env.supabaseDbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(SCHEMA_SQL);
  } finally {
    await client.end();
  }
  console.log('✔ Schema applied via direct Postgres connection');
  return true;
}

/* ---------------- verification through the normal API --------------------- */
async function verify() {
  const report = {};
  for (const table of EXPECTED_TABLES) {
    const { count, error } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
    report[table] = error ? `ERROR: ${error.message}` : `${count} rows`;
  }
  return report;
}

async function main() {
  console.log('\n▸ Smart College Bus Tracker — database setup\n');
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    console.error('✖ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in server/.env');
    process.exit(1);
  }

  let applied = false;
  try {
    applied = await runViaManagementApi();
  } catch (e) {
    console.error('✖ Management API path failed:', e.message);
  }
  if (!applied) {
    try {
      applied = await runViaPostgres();
    } catch (e) {
      console.error('✖ Postgres path failed:', e.message);
    }
  }
  if (!applied) {
    console.error(
      '\n✖ No way to run DDL.\n' +
        '  Add ONE of these to server/.env and re-run `npm run init-db`:\n' +
        '   • SUPABASE_ACCESS_TOKEN  — a personal access token (sbp_...) from supabase.com/account/tokens\n' +
        '   • SUPABASE_DB_URL        — postgresql://postgres:<db-password>@db.<ref>.supabase.co:5432/postgres\n' +
        '  (Both live in Project Settings → Database on your Supabase dashboard.)\n'
    );
    process.exit(1);
  }

  await seedWithRetry();

  console.log('\n▸ Table check');
  const report = await verify();
  for (const [t, v] of Object.entries(report)) console.log(`   ${t.padEnd(16)} ${v}`);

  const failed = Object.values(report).filter((v) => String(v).startsWith('ERROR'));
  if (failed.length) {
    console.error('\n✖ Some tables could not be read. Check the service role key.\n');
    process.exit(1);
  }
  console.log('\n✔ Database ready.\n');
}

/** PostgREST caches the schema — give it a moment, then seed. */
async function seedWithRetry(attempts = 8) {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await seed();
      return;
    } catch (e) {
      const cacheIssue = /schema cache|does not exist|not found in the schema/i.test(e.message);
      if (!cacheIssue || i === attempts) throw e;
      console.log(`   … waiting for the schema cache (attempt ${i}/${attempts})`);
      await new Promise((r) => setTimeout(r, 2500));
    }
  }
}

main().catch((e) => {
  console.error('\n✖ init-db failed:', e.message);
  process.exit(1);
});
