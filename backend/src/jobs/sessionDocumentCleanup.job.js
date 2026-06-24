const cron = require('node-cron');
const lifecycleService = require('../services/session-document-lifecycle.service');

const SCHEDULE = process.env.SESSION_LIFECYCLE_CRON || '17 * * * *';

function startSessionDocumentCleanupJob() {
  if (String(process.env.IN_PROCESS_CLEANUP_ENABLED || '').toLowerCase() === 'false') {
    console.log('[session-lifecycle] in-process scheduler disabled');
    return null;
  }
  const task = cron.schedule(SCHEDULE, async () => {
    try {
      const result = await lifecycleService.runLifecycleCleanup();
      console.log('[session-lifecycle] summary', JSON.stringify(result));
    } catch (error) {
      console.error('[session-lifecycle] fatal:', error.message);
    }
  });
  console.log(`[session-lifecycle] scheduled "${SCHEDULE}"`);
  return task;
}

module.exports = startSessionDocumentCleanupJob;
