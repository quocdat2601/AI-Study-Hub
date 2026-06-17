const cron = require('node-cron');
const documentService = require('../services/document.service');

// Chạy 02:00 mỗi ngày — quét và xóa cứng các doc đã ở thùng rác quá hạn giữ
const SCHEDULE = '0 2 * * *';

function startTrashCleanupJob() {
  cron.schedule(SCHEDULE, async () => {
    try {
      const result = await documentService.purgeExpiredTrash();
      console.log(
        `[trash-cleanup] purged ${result.purged} expired document(s) (retention ${result.retentionDays}d)`
      );
    } catch (err) {
      console.error('[trash-cleanup] error:', err.message);
    }
  });
  console.log(`[trash-cleanup] scheduled "${SCHEDULE}" (daily 02:00)`);
}

module.exports = startTrashCleanupJob;
