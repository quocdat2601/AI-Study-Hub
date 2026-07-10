require('dotenv').config();

const supabase = require('../src/config/supabase');

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'documents';
const PAGE_SIZE = 1000;

function parseArgs(argv) {
  const options = {
    markFailed: false,
    privateAffected: false,
    softDeleteAffected: false,
    json: false,
  };

  for (const arg of argv) {
    if (arg === '--mark-failed') options.markFailed = true;
    else if (arg === '--private-affected') options.privateAffected = true;
    else if (arg === '--soft-delete-affected') options.softDeleteAffected = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
  }

  return options;
}

function printHelp() {
  console.log(`
Supabase Storage integrity audit

Dry run:
  npm run storage:audit

Optional explicit mutation flags:
  npm run storage:audit -- --mark-failed
  npm run storage:audit -- --private-affected
  npm run storage:audit -- --soft-delete-affected

Other:
  npm run storage:audit -- --json

Default mode only reports missing Storage objects. It does not delete files or modify rows.
`);
}

async function fetchAll(table, select, buildQuery = (query) => query) {
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const query = buildQuery(
      supabase
        .from(table)
        .select(select)
        .range(from, to)
    );
    const { data, error } = await query;
    if (error) throw error;

    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

function splitStoragePath(storagePath) {
  const normalizedPath = String(storagePath || '').replace(/^\/+/, '');
  const separator = normalizedPath.lastIndexOf('/');
  return {
    normalizedPath,
    folder: separator === -1 ? '' : normalizedPath.slice(0, separator),
    fileName: separator === -1 ? normalizedPath : normalizedPath.slice(separator + 1),
  };
}

async function storageObjectExists(storagePath) {
  const { normalizedPath, folder, fileName } = splitStoragePath(storagePath);
  if (!normalizedPath || !fileName) return false;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(folder, { limit: 1000, search: fileName });

  if (error) {
    throw new Error(`Storage list failed for "${normalizedPath}": ${error.message}`);
  }

  return (data || []).some((item) => item.name === fileName);
}

function isActiveDocument(doc) {
  return !doc.deleted_at && (doc.lifecycle_status || 'active') === 'active';
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let index = 0;
  let size = value;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function buildReportRow(file, documents) {
  const activeDocuments = documents.filter(isActiveDocument);
  const scopes = [...new Set(activeDocuments.map((doc) => doc.document_scope || 'library'))];
  const visibility = [...new Set(activeDocuments.map((doc) => (doc.is_public ? 'public' : 'private')))];
  const thumbnails = activeDocuments
    .filter((doc) => doc.thumbnail_path || doc.thumbnail_status)
    .map((doc) => ({
      documentId: doc.id,
      thumbnailPath: doc.thumbnail_path || null,
      thumbnailStatus: doc.thumbnail_status || null,
    }));

  return {
    cloudFileId: file.id,
    storagePath: file.storage_path,
    mimeType: file.mime_type,
    sizeBytes: Number(file.size_bytes || 0),
    size: formatBytes(file.size_bytes),
    affectedActiveDocumentCount: activeDocuments.length,
    publicPrivateStatus: visibility.length ? visibility.join(', ') : 'none',
    documentScope: scopes.length ? scopes.join(', ') : 'none',
    affectedDocumentIds: activeDocuments.map((doc) => doc.id),
    affectedDocumentTitles: activeDocuments.map((doc) => doc.title),
    thumbnailPathStatus: thumbnails,
  };
}

async function updateAffectedDocuments(missingRows, options) {
  const documentIds = missingRows.flatMap((row) => row.affectedDocumentIds);
  const uniqueIds = [...new Set(documentIds.map(Number).filter(Number.isInteger))];
  if (!uniqueIds.length) return;

  const updates = {};
  if (options.markFailed) {
    updates.extraction_status = 'failed';
    updates.extraction_error = 'Storage object is missing for the linked cloud file';
  }
  if (options.privateAffected) {
    updates.is_public = false;
  }
  if (options.softDeleteAffected) {
    updates.deleted_at = new Date().toISOString();
  }

  if (!Object.keys(updates).length) return;
  updates.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('documents')
    .update(updates)
    .in('id', uniqueIds);

  if (error) throw error;
  console.log(`Updated ${uniqueIds.length} affected active document(s): ${Object.keys(updates).join(', ')}`);
}

function printSummary({ files, missingRows, checked }) {
  console.log(`Storage bucket: ${BUCKET}`);
  console.log(`Checked cloud_files: ${checked}/${files.length}`);
  console.log(`Missing storage objects: ${missingRows.length}`);
}

function printHumanReport(missingRows) {
  if (!missingRows.length) {
    console.log('No missing Storage objects were found.');
    return;
  }

  console.table(missingRows.map((row) => ({
    cloud_file_id: row.cloudFileId,
    storage_path: row.storagePath,
    size: row.size,
    active_docs: row.affectedActiveDocumentCount,
    visibility: row.publicPrivateStatus,
    scope: row.documentScope,
    titles: row.affectedDocumentTitles.join(' | ').slice(0, 120),
    thumbnails: row.thumbnailPathStatus
      .map((thumb) => `${thumb.documentId}:${thumb.thumbnailStatus || 'unknown'}`)
      .join(', ')
      .slice(0, 80),
  })));

  console.log('\nDetailed missing objects:');
  for (const row of missingRows) {
    console.log(JSON.stringify(row, null, 2));
  }
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const [files, documents] = await Promise.all([
    fetchAll('cloud_files', 'id, storage_path, mime_type, size_bytes, created_at'),
    fetchAll(
      'documents',
      'id, title, file_id, is_public, document_scope, lifecycle_status, deleted_at, thumbnail_path, thumbnail_status'
    ),
  ]);

  const documentsByFileId = new Map();
  for (const doc of documents) {
    const key = Number(doc.file_id);
    const rows = documentsByFileId.get(key) || [];
    rows.push(doc);
    documentsByFileId.set(key, rows);
  }

  const missingRows = [];
  let checked = 0;

  for (const file of files) {
    checked += 1;
    const exists = await storageObjectExists(file.storage_path);
    if (!exists) {
      missingRows.push(buildReportRow(file, documentsByFileId.get(Number(file.id)) || []));
    }
  }

  if (options.json) {
    console.log(JSON.stringify({
      bucket: BUCKET,
      checked,
      totalCloudFiles: files.length,
      missingCount: missingRows.length,
      missing: missingRows,
      dryRun: !(options.markFailed || options.privateAffected || options.softDeleteAffected),
    }, null, 2));
  } else {
    printSummary({ files, missingRows, checked });
    printHumanReport(missingRows);
  }

  if (options.markFailed || options.privateAffected || options.softDeleteAffected) {
    await updateAffectedDocuments(missingRows, options);
  } else {
    console.log('Dry run complete. No rows were changed and no Storage objects were deleted.');
  }
}

run().catch((err) => {
  console.error('Storage audit failed:', err);
  process.exitCode = 1;
});
