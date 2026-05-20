#!/usr/bin/env node
/**
 * Seed script - sets up initial users
 * Run: node scripts/seed.js
 */
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway')
    ? { rejectUnauthorized: false }
    : false,
});

const isProduction = process.env.NODE_ENV === 'production';

function requirePassword(envName) {
  const value = process.env[envName];
  if (value) return value;
  throw new Error(`${envName} is required`);
}

const USERS = [
  {
    email: process.env.INITIAL_ADMIN_EMAIL || 'admin@raymonjland.com',
    name: process.env.INITIAL_ADMIN_NAME || 'System Admin',
    role: 'admin',
    password: requirePassword('INITIAL_ADMIN_PASSWORD'),
  },
];

if (process.env.INITIAL_ACCOUNTING_PASSWORD) {
  USERS.push({
    email: process.env.INITIAL_ACCOUNTING_EMAIL || 'accounting@raymonjland.com',
    name: 'Accounting',
    role: 'accounting',
    password: requirePassword('INITIAL_ACCOUNTING_PASSWORD'),
  });
}

if (process.env.INITIAL_SALES_PASSWORD) {
  USERS.push({
    email: process.env.INITIAL_SALES_EMAIL || 'sales@raymonjland.com',
    name: 'Sales & Logistics',
    role: 'sales_logistics',
    password: requirePassword('INITIAL_SALES_PASSWORD'),
  });
}

if (process.env.INITIAL_READONLY_PASSWORD) {
  USERS.push({
    email: process.env.INITIAL_READONLY_EMAIL || 'readonly@raymonjland.com',
    name: 'Read Only User',
    role: 'readonly',
    password: requirePassword('INITIAL_READONLY_PASSWORD'),
  });
}

async function seed() {
  const client = await pool.connect();
  try {
    for (const user of USERS) {
      const hash = await bcrypt.hash(user.password, 12);
      const { rows } = await client.query(
        'SELECT id FROM app_users WHERE email = $1', [user.email]
      );
      if (rows.length > 0) {
        await client.query(
          'UPDATE app_users SET hashed_password = $1, name = $2, role = $3 WHERE email = $4',
          [hash, user.name, user.role, user.email]
        );
        console.log(`✓ Updated: ${user.email} (${user.role})`);
      } else {
        await client.query(
          'INSERT INTO app_users (email, name, role, hashed_password) VALUES ($1, $2, $3, $4)',
          [user.email, user.name, user.role, hash]
        );
        console.log(`✓ Created: ${user.email} (${user.role})`);
      }
    }

    // Insert demo customer codes (from Excel hidden sheet)
    const customers = [
      ['ATLPRO', 'Atlantic Produce Exchange, LLC'],
      ['AUBDAL', 'Auburndale Fruit'],
      ['BILPRO', 'Billingsley Produce'],
      ['BIPMKT', 'Bills Produce Market'],
      ['BROSON', 'Browning & Sons'],
      ['CANFRU', 'Canadian Fruit & Produce Co. Inc.'],
      ['BAIFAR', 'Bailey Farms, Inc.'],
      ['DEKMAR', 'Dekalb Market, Inc.'],
      ['DNOINC', 'DNO, Inc.'],
      ['FARALL', 'Farmers Alliance, LLC'],
    ];

    for (const [code, name] of customers) {
      await client.query(`
        INSERT INTO contacts (code, name, is_customer, sync_origin)
        VALUES ($1, $2, true, 'seed')
        ON CONFLICT DO NOTHING
      `, [code, name]);
    }
    console.log(`\n✓ Seeded ${customers.length} demo customers`);
    console.log('\n✓ Seed complete');
    if (!isProduction) {
      console.log('\nDevelopment seed users created. Production never prints passwords.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(e => {
  console.error('Seed failed:', e);
  process.exit(1);
});
