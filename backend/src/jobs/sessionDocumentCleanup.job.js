const cron = require('node-cron');
const lifecycleService = require('../services/session-document-lifecycle.service');

const SCHEDULE = process.env.SESSION_LIFECYCLE_CRON || '17 * * * *';
let cleanupInProgress = false;

async function runSessionDocumentCleanup() {
  if (cleanupInProgress) {
    console.log('[session-lifecycle] cleanup already in progress, skipping duplicate run');
    return;
  }

  cleanupInProgress = true;
  try {
    const result = await lifecycleService.runLifecycleCleanup();
    console.log('[session-lifecycle] summary', JSON.stringify(result));
  } catch (error) {
    console.error('[session-lifecycle] fatal:', error.message);
  } finally {
    cleanupInProgress = false;
  }
}

function startSessionDocumentCleanupJob() {
  if (String(process.env.IN_PROCESS_CLEANUP_ENABLED || '').toLowerCase() === 'false') {
    console.log('[session-lifecycle] in-process scheduler disabled');
    return null;
  }

  const task = cron.schedule(SCHEDULE, runSessionDocumentCleanup);
  console.log(`[session-lifecycle] scheduled "${SCHEDULE}"`);

  setTimeout(() => {
    console.log('[session-lifecycle] running initial cleanup pass');
    runSessionDocumentCleanup();
  }, 1000);

  return task;
}

module.exports = startSessionDocumentCleanupJob;
