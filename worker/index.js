#!/usr/bin/env node
/**
 * MelonBook Background Worker
 * Runs scheduled jobs: sync, reconciliation, anomaly detection
 */

console.log('[Worker] MelonBook Background Worker starting...');
console.log(`[Worker] Environment: ${process.env.NODE_ENV || 'development'}`);

const APP_URL = process.env.INTERNAL_API_BASE_URL || process.env.NEXTAUTH_URL;
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN;

if (!APP_URL) {
  console.error('[Worker] Missing INTERNAL_API_BASE_URL or NEXTAUTH_URL');
  process.exit(1);
}

if (!INTERNAL_API_TOKEN) {
  console.error('[Worker] Missing INTERNAL_API_TOKEN');
  process.exit(1);
}

async function callSyncEndpoint(type) {
  return callInternalEndpoint(`/api/sync/${type}`, type);
}

async function callInternalEndpoint(path, label) {
  const response = await fetch(`${APP_URL.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-token': INTERNAL_API_TOKEN,
    },
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}: ${JSON.stringify(payload)}`);
  }

  return payload.result ?? payload;
}

// ============================================================
// JOB RUNNERS
// ============================================================
async function runSyncJob() {
  console.log('[Job] Starting full Airtable sync...');
  const start = Date.now();
  try {
    const results = await callSyncEndpoint('full');
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[Job] Sync complete in ${elapsed}s:`, JSON.stringify(results));
  } catch (e) {
    console.error('[Job] Sync failed:', e.message);
  }
}

async function runOutboxJob() {
  try {
    const results = await callSyncEndpoint('outbox');
    if (results.processed > 0 || results.failed > 0) {
      console.log(`[Job] Outbox: processed ${results.processed}, failed ${results.failed}`);
    }
  } catch (e) {
    console.error('[Job] Outbox processing failed:', e.message);
  }
}

async function runReconcileJob() {
  console.log('[Job] Running AR reconciliation...');
  try {
    const result = await callSyncEndpoint('reconcile');
    console.log(`[Job] Reconciliation: invoiced=${result.pgInvoiced}, paid=${result.pgPaid}, balance=${result.pgBalance}`);

    if (result.anomalies.length > 0) {
      console.log(`[Job] ⚠️  ${result.anomalies.length} anomalies detected`);
    }
  } catch (e) {
    console.error('[Job] Reconciliation failed:', e.message);
  }
}

async function runAirtableMirrorJob() {
  console.log('[Job] Starting full Airtable mirror sync...');
  const start = Date.now();
  try {
    const results = await callInternalEndpoint('/api/airtable/sync/full', 'airtable mirror');
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const tableCount = Array.isArray(results.tables) ? results.tables.length : 0;
    console.log(`[Job] Airtable mirror complete in ${elapsed}s across ${tableCount} tables`);
  } catch (e) {
    console.error('[Job] Airtable mirror failed:', e.message);
  }
}

// ============================================================
// SCHEDULE
// ============================================================
// Outbox: every 30 seconds
setInterval(runOutboxJob, 30 * 1000);

// Sync: every 15 minutes
setInterval(runSyncJob, 15 * 60 * 1000);

// Nightly reconciliation: every 6 hours
setInterval(runReconcileJob, 6 * 60 * 60 * 1000);

// Raw Airtable mirror: every 4 hours
setInterval(runAirtableMirrorJob, 4 * 60 * 60 * 1000);

// Initial run on startup
setTimeout(async () => {
  await runAirtableMirrorJob();
  await runSyncJob();
  await runReconcileJob();
}, 5000);

console.log('[Worker] Scheduled jobs:');
console.log('  - Outbox processor: every 30 seconds');
console.log('  - Full sync: every 15 minutes');
console.log('  - Full Airtable mirror: every 4 hours');
console.log('  - AR reconciliation: every 6 hours');

// Keep process alive
process.on('SIGTERM', () => {
  console.log('[Worker] SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('[Worker] Uncaught exception:', err);
});
