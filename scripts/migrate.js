#!/usr/bin/env node
/**
 * Database migration runner
 * Run: node scripts/migrate.js
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway')
    ? { rejectUnauthorized: false }
    : false,
});

async function migrate() {
  const client = await pool.connect();
  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT id FROM _migrations WHERE filename = $1', [file]
      );
      if (rows.length > 0) {
        console.log(`✓ ${file} (already applied)`);
        continue;
      }

      console.log(`→ Applying ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✓ ${file} applied`);
      } catch (e) {
        await client.query('ROLLBACK');
        console.error(`✗ ${file} failed:`, e.message);
        throw e;
      }
    }

    console.log('\n✓ All migrations complete');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
