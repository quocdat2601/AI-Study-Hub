require('dotenv').config();
const lifecycleService = require('../src/services/session-document-lifecycle.service');

function parseArgs(argv) {
  const options = { dryRun: false };
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('--batch-size=')) options.batchSize = Number(arg.split('=')[1]);
    else if (arg.startsWith('--max-batches=')) options.maxBatches = Number(arg.split('=')[1]);
    else if (arg.startsWith('--lease-seconds=')) options.leaseSeconds = Number(arg.split('=')[1]);
  }
  return options;
}

lifecycleService.runLifecycleCleanup(parseArgs(process.argv.slice(2)))
  .then((summary) => {
    console.log('[session-lifecycle] summary', JSON.stringify(summary));
  })
  .catch((error) => {
    console.error('[session-lifecycle] fatal:', error);
    process.exitCode = 1;
  });
