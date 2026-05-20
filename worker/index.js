#!/usr/bin/env node
/**
 * MelonOps Background Worker
 * Runs scheduled jobs: sync, reconciliation, anomaly detection
 */

const { runFullSync, processOutbox, reconcileAR } = require('../src/lib/sync');
const { query } = require('../src/db');

console.log('[Worker] MelonOps Background Worker starting...');
console.log(`[Worker] Environment: ${process.env.NODE_ENV || 'development'}`);

// ============================================================
// JOB RUNNERS
// ============================================================
async function runSyncJob() {
  console.log('[Job] Starting full Airtable sync...');
  const start = Date.now();
  try {
    const results = await runFullSync();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[Job] Sync complete in ${elapsed}s:`, JSON.stringify(results));
  } catch (e) {
    console.error('[Job] Sync failed:', e.message);
  }
}

async function runOutboxJob() {
  try {
    const results = await processOutbox(50);
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
    const result = await reconcileAR();
    console.log(`[Job] Reconciliation: invoiced=${result.pgInvoiced}, paid=${result.pgPaid}, balance=${result.pgBalance}`);

    // Store anomalies
    for (const anomaly of result.anomalies) {
      await query(`
        INSERT INTO anomaly_flags (table_name, flag_type, severity, description)
        VALUES ('vouchers', $1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [anomaly.type, anomaly.severity, anomaly.description]);
    }

    if (result.anomalies.length > 0) {
      console.log(`[Job] ⚠️  ${result.anomalies.length} anomalies detected`);
    }
  } catch (e) {
    console.error('[Job] Reconciliation failed:', e.message);
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

// Initial run on startup
setTimeout(async () => {
  await runSyncJob();
  await runReconcileJob();
}, 5000);

console.log('[Worker] Scheduled jobs:');
console.log('  - Outbox processor: every 30 seconds');
console.log('  - Full sync: every 15 minutes');
console.log('  - AR reconciliation: every 6 hours');

// Keep process alive
process.on('SIGTERM', () => {
  console.log('[Worker] SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('[Worker] Uncaught exception:', err);
});
