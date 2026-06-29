const crypto = require('crypto');
const supabase = require('../config/supabase');
const supabaseService = require('./supabase.service');
const activityService = require('./activity.service');
const snapshotService = require('./chat-snapshot.service');

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_MAX_BATCHES = 10;
const DEFAULT_LEASE_SECONDS = 1800;
const MAX_STORAGE_ATTEMPTS = 10;

function boundedInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

async function countRows(table, configure) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  query = configure(query);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function getDryRunSummary() {
  const now = new Date().toISOString();
  const [dueForExpiry, dueForPurge, dueStorage] = await Promise.all([
    countRows('documents', (query) => query
      .eq('document_scope', 'session')
      .eq('lifecycle_status', 'active')
      .is('deleted_at', null)
      .lte('expires_at', now)),
    countRows('documents', (query) => query
      .eq('document_scope', 'session')
      .eq('lifecycle_status', 'expired')
      .is('deleted_at', null)
      .lte('purge_after', now)),
    countRows('storage_cleanup_queue', (query) => query
      .eq('status', 'pending')
      .lte('next_attempt_at', now)),
  ]);
  return { dryRun: true, dueForExpiry, dueForPurge, dueStorage, ranAt: now };
}

async function expireBatch(batchSize) {
  const { data, error } = await supabase.rpc('expire_due_session_documents', {
    p_batch_size: batchSize,
  });
  if (error) throw error;
  for (const row of data || []) {
    activityService.log({
      action: 'chat.attachment.expire',
      targetType: 'document',
      targetId: row.document_id,
      metadata: { expiredAt: row.expired_at, purgeAfter: row.purge_after },
    });
  }
  return data || [];
}

async function claimPurgeBatch(batchSize, claimToken, leaseSeconds) {
  const { data, error } = await supabase.rpc('claim_session_documents_for_purge', {
    p_batch_size: batchSize,
    p_claim_token: claimToken,
    p_lease_seconds: leaseSeconds,
  });
  if (error) throw error;
  return data || [];
}

async function releaseFailedPurgeClaim(documentId, claimToken, error) {
  const { error: updateError } = await supabase
    .from('documents')
    .update({
      lifecycle_status: 'expired',
      purge_claim_token: null,
      purge_claimed_at: null,
      last_cleanup_error: String(error?.message || error).slice(0, 2000),
      purge_after: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .eq('document_scope', 'session')
    .eq('lifecycle_status', 'purging')
    .eq('purge_claim_token', claimToken);
  if (updateError) console.error('[session-lifecycle] failed to release purge claim:', updateError.message);
}

async function finalizePurge(document, claimToken) {
  const { data, error } = await supabase.rpc('finalize_session_document_purge', {
    p_document_id: document.document_id,
    p_claim_token: claimToken,
  });
  if (error) throw error;
  const result = data?.[0] || { finalized: false };
  if (result.finalized) {
    activityService.log({
      userId: document.user_id,
      action: 'chat.attachment.purge',
      targetType: 'document',
      targetId: document.document_id,
      metadata: { sessionId: document.session_id, title: document.title },
    });
  }
  return result;
}

async function claimStorageBatch(batchSize, claimToken, leaseSeconds) {
  const { data, error } = await supabase.rpc('claim_storage_cleanup_items', {
    p_batch_size: batchSize,
    p_claim_token: claimToken,
    p_lease_seconds: leaseSeconds,
  });
  if (error) throw error;
  return data || [];
}

async function storagePathIsReferenced(item) {
  const table = item.object_kind === 'thumbnail' ? 'documents' : 'cloud_files';
  const column = item.object_kind === 'thumbnail' ? 'thumbnail_path' : 'storage_path';
  const [liveReferences, snapshotReferences] = await Promise.all([
    countRows(table, (query) => query.eq(column, item.storage_path)),
    countRows('shared_file_versions', (query) => query.eq('storage_path', item.storage_path)),
  ]);
  return liveReferences + snapshotReferences > 0;
}

async function purgeSnapshots(batchSize, maxBatches, leaseSeconds, summary) {
  summary.snapshotEligibilityMarked = await snapshotService.markCleanupEligibility();
  for (let index = 0; index < maxBatches; index += 1) {
    const claimToken = crypto.randomUUID();
    const { data, error } = await supabase.rpc('claim_chat_snapshots_for_purge', {
      p_batch_size: batchSize,
      p_claim_token: claimToken,
      p_lease_seconds: leaseSeconds,
    });
    if (error) throw error;
    const claimed = data || [];
    summary.snapshotsClaimed += claimed.length;
    for (const snapshot of claimed) {
      const { data: finalized, error: finalizeError } = await supabase.rpc('finalize_chat_snapshot_purge', {
        p_snapshot_id: snapshot.snapshot_id,
        p_claim_token: claimToken,
      });
      if (finalizeError) {
        summary.snapshotPurgeFailed += 1;
        console.error(`[session-lifecycle] snapshot ${snapshot.snapshot_id} purge failed:`, finalizeError.message);
      } else if (finalized) {
        summary.snapshotsPurged += 1;
      }
    }
    if (claimed.length < batchSize) break;
  }
}

async function completeStorageItem(item, claimToken, metadata = {}) {
  const { error } = await supabase
    .from('storage_cleanup_queue')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      claim_token: null,
      claimed_at: null,
      last_error: metadata.skipped ? 'Skipped because the path is referenced again' : null,
    })
    .eq('id', item.queue_id)
    .eq('status', 'processing')
    .eq('claim_token', claimToken);
  if (error) throw error;
}

async function failStorageItem(item, claimToken, failure) {
  const terminal = Number(item.attempts || 0) >= MAX_STORAGE_ATTEMPTS;
  const delaySeconds = Math.min(86400, 60 * (2 ** Math.min(Number(item.attempts || 1), 10)));
  const { error } = await supabase
    .from('storage_cleanup_queue')
    .update({
      status: terminal ? 'failed' : 'pending',
      claim_token: null,
      claimed_at: null,
      next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
      last_error: String(failure?.message || failure).slice(0, 2000),
    })
    .eq('id', item.queue_id)
    .eq('status', 'processing')
    .eq('claim_token', claimToken);
  if (error) throw error;
  if (terminal) {
    activityService.log({
      action: 'storage.cleanup.failed',
      targetType: 'storage_cleanup_queue',
      targetId: item.queue_id,
      metadata: { storagePath: item.storage_path, objectKind: item.object_kind },
    });
  }
  return terminal;
}

async function runLifecycleCleanup(options = {}) {
  const batchSize = boundedInteger(options.batchSize, DEFAULT_BATCH_SIZE, 1, 500);
  const maxBatches = boundedInteger(options.maxBatches, DEFAULT_MAX_BATCHES, 1, 100);
  const leaseSeconds = boundedInteger(options.leaseSeconds, DEFAULT_LEASE_SECONDS, 60, 86400);
  if (options.dryRun) return getDryRunSummary();

  const summary = {
    dryRun: false,
    scannedBatches: 0,
    expired: 0,
    claimed: 0,
    reclaimed: 0,
    finalized: 0,
    finalizeSkipped: 0,
    finalizeFailed: 0,
    storageClaimed: 0,
    storageDeleted: 0,
    storageSkippedReferenced: 0,
    storageRetried: 0,
    storageFailed: 0,
    snapshotEligibilityMarked: 0,
    snapshotsClaimed: 0,
    snapshotsPurged: 0,
    snapshotPurgeFailed: 0,
    ranAt: new Date().toISOString(),
  };

  if (snapshotService.featureEnabled()) {
    await purgeSnapshots(batchSize, maxBatches, leaseSeconds, summary);
  }

  for (let index = 0; index < maxBatches; index += 1) {
    const rows = await expireBatch(batchSize);
    summary.scannedBatches += 1;
    summary.expired += rows.length;
    if (rows.length < batchSize) break;
  }

  for (let index = 0; index < maxBatches; index += 1) {
    const claimToken = crypto.randomUUID();
    const claimed = await claimPurgeBatch(batchSize, claimToken, leaseSeconds);
    summary.claimed += claimed.length;
    summary.reclaimed += claimed.filter((row) => row.was_reclaimed).length;
    for (const document of claimed) {
      try {
        const result = await finalizePurge(document, claimToken);
        if (result.finalized) summary.finalized += 1;
        else summary.finalizeSkipped += 1;
      } catch (error) {
        summary.finalizeFailed += 1;
        console.error(`[session-lifecycle] finalize ${document.document_id} failed:`, error.message);
        await releaseFailedPurgeClaim(document.document_id, claimToken, error);
      }
    }
    if (claimed.length < batchSize) break;
  }

  for (let index = 0; index < maxBatches; index += 1) {
    const claimToken = crypto.randomUUID();
    const items = await claimStorageBatch(batchSize, claimToken, leaseSeconds);
    summary.storageClaimed += items.length;
    for (const item of items) {
      try {
        if (await storagePathIsReferenced(item)) {
          await completeStorageItem(item, claimToken, { skipped: true });
          summary.storageSkippedReferenced += 1;
          continue;
        }
        await supabaseService.deleteFile(item.storage_path);
        await completeStorageItem(item, claimToken);
        summary.storageDeleted += 1;
      } catch (error) {
        const terminal = await failStorageItem(item, claimToken, error);
        if (terminal) summary.storageFailed += 1;
        else summary.storageRetried += 1;
      }
    }
    if (items.length < batchSize) break;
  }

  return summary;
}

module.exports = {
  getDryRunSummary,
  runLifecycleCleanup,
};
