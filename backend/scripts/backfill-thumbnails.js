require('dotenv').config();

const documentModel = require('../src/models/document.model');
const documentThumbnailService = require('../src/services/document-thumbnail.service');
const supabaseService = require('../src/services/supabase.service');

function parseArgs(argv) {
  const options = {
    dryRun: false,
    force: false,
    limit: 50,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--force') {
      options.force = true;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      const value = Number(arg.slice('--limit='.length));
      if (Number.isFinite(value) && value > 0) {
        options.limit = Math.min(Math.floor(value), 500);
      }
    }
  }

  return options;
}

function describeDocument(document) {
  const mimeType = document.cloud_files?.mime_type || 'unknown';
  const status = document.thumbnail_status || 'unknown';
  return `#${document.id} "${document.title}" [${mimeType}, thumbnail=${status}]`;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const candidates = await documentModel.findThumbnailBackfillCandidates(options);
  const summary = {
    total: candidates.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  };

  console.log(`Found ${candidates.length} thumbnail backfill candidate(s).`);

  if (options.dryRun) {
    candidates.forEach((document) => {
      console.log(`DRY RUN ${describeDocument(document)}`);
    });
    console.log('Dry run complete. No documents were changed.');
    return;
  }

  for (const document of candidates) {
    const storagePath = document.cloud_files?.storage_path;
    const mimeType = document.cloud_files?.mime_type;

    if (!storagePath) {
      summary.skipped += 1;
      console.log(`SKIP ${describeDocument(document)} missing storage path`);
      continue;
    }

    try {
      const buffer = await supabaseService.downloadFile(storagePath);
      const result = await documentThumbnailService.generateAndSaveThumbnail({
        document,
        buffer,
        mimeType,
      });

      if (result.status === 'ready') {
        summary.succeeded += 1;
        console.log(`READY ${describeDocument(document)} -> ${result.path}`);
      } else if (result.status === 'skipped') {
        summary.skipped += 1;
        console.log(`SKIP ${describeDocument(document)} ${result.error}`);
      } else {
        summary.failed += 1;
        console.log(`FAIL ${describeDocument(document)} ${result.error}`);
      }
    } catch (err) {
      summary.failed += 1;
      const message = err.message || 'Thumbnail backfill failed';
      try {
        await documentModel.updateThumbnail(document.id, {
          path: null,
          status: 'failed',
          error: message,
        });
      } catch (updateErr) {
        console.error(`Could not record failure for document #${document.id}: ${updateErr.message}`);
      }
      console.log(`FAIL ${describeDocument(document)} ${message}`);
    }
  }

  console.log(
    `Thumbnail backfill complete. total=${summary.total} ready=${summary.succeeded} failed=${summary.failed} skipped=${summary.skipped}`
  );
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
