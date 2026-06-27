const documentModel = require('../models/document.model');
const chatModel = require('../models/chat.model');
const chatSnapshotModel = require('../models/chat-snapshot.model');

const tagModel = require('../models/tag.model');

const userModel = require('../models/user.model');

const notificationModel = require('../models/notification.model');

const supabaseService = require('./supabase.service');
const documentThumbnailService = require('./document-thumbnail.service');

const activityService = require('./activity.service');

const createError = require('../utils/createError');

const PUBLIC_PREVIEW_MAX_CHARS = 150;

function mapDocument(doc) {

  if (!doc) return doc;



  const { document_tags: documentTags, thumbnail_path: _thumbnailPath, ...rest } = doc;

  return {

    ...rest,

    tags: tagModel.normalizeDocumentTags(documentTags),

  };

}



function filterDocuments(documents, { search, subjectId }) {

  let filtered = documents;



  if (search) {

    const term = String(search).trim().toLowerCase();

    filtered = filtered.filter((doc) => {

      const titleMatch = doc.title.toLowerCase().includes(term);

      const tagMatch = (doc.tags || []).some((tag) => tag.name.includes(term));

      return titleMatch || tagMatch;

    });

  }



  if (subjectId) {

    filtered = filtered.filter((doc) => Number(doc.subject_id) === Number(subjectId));

  }



  return filtered;

}



function normalizePreviewText(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= PUBLIC_PREVIEW_MAX_CHARS) return normalized;
  return `${normalized.slice(0, PUBLIC_PREVIEW_MAX_CHARS)}...`;
}

function getDocumentFileType(doc) {
  const mimeType = doc.cloud_files?.mime_type || '';
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('word')) return 'DOCX';
  if (mimeType === 'text/plain') return 'TXT';
  if (mimeType.startsWith('image/')) return 'IMAGE';
  return 'DOC';
}

function buildPublicDocumentPreview(doc) {
  return {
    id: doc.id,
    title: doc.title,
    subject: doc.subjects?.name || null,
    subjectCode: doc.subjects?.code || null,
    viewCount: Number(doc.view_count || 0),
    fileType: getDocumentFileType(doc),
    thumbnailUrl: doc.thumbnailUrl || null,
    previewText: normalizePreviewText(doc.extracted_text),
    createdAt: doc.created_at,
    fileSizeBytes: Number(doc.cloud_files?.size_bytes || 0),
  };
}

async function canReadDocument(userId, id) {
  return documentModel.findAccessibleById(id, userId);
}

async function canUseDocumentInChat(userId, id) {
  const libraryDocument = await canReadDocument(userId, id);
  return libraryDocument || documentModel.findOwnedSharedById(id, userId);
}

async function canAttachDocumentToSession(userId, id) {
  const doc = await documentModel.findById(id);
  if (!doc) return null;
  if (String(doc.user_id) === String(userId) || doc.is_public) return doc;

  const share = await documentModel.findShareByDocAndRecipient(doc.id, userId);
  return share?.status === 'active' ? doc : null;
}

async function canEditDocument(userId, id) {
  return documentModel.findOwnedById(id, userId);
}

async function addThumbnailUrls(documents) {
  return Promise.all((documents || []).map(async (doc) => {
    let thumbnail = await documentThumbnailService.resolveReadyThumbnail(doc);
    if (
      !thumbnail
      && doc.cloud_files?.storage_path
      && documentThumbnailService.isSupportedThumbnailMimeType(doc.cloud_files?.mime_type)
    ) {
      try {
        const buffer = await supabaseService.downloadFile(doc.cloud_files.storage_path);
        const generated = await documentThumbnailService.ensureThumbnailForDocument({
          document: doc,
          buffer,
          mimeType: doc.cloud_files.mime_type,
        });
        if (generated?.status === 'ready') {
          thumbnail = {
            path: generated.path,
            status: 'ready',
            error: null,
            generatedAt: generated.generatedAt || null,
          };
        }
      } catch (error) {
        console.warn(`Thumbnail resolution failed for document ${doc.id}:`, error.message);
      }
    }

    if (!thumbnail?.path || thumbnail.status !== 'ready') {
      const isImage = String(doc.cloud_files?.mime_type || '').startsWith('image/');
      const storagePath = doc.cloud_files?.storage_path;
      if (isImage && storagePath) {
        try {
          return { ...doc, thumbnailUrl: await supabaseService.getSignedUrl(storagePath) };
        } catch (error) {
          console.warn(`Image preview URL failed for document ${doc.id}:`, error.message);
        }
      }
      return { ...doc, thumbnailUrl: null };
    }

    try {
      return {
        ...doc,
        thumbnail_path: thumbnail.path,
        thumbnail_status: thumbnail.status,
        thumbnail_error: thumbnail.error || null,
        thumbnail_generated_at: thumbnail.generatedAt || null,
        thumbnailUrl: await supabaseService.getSignedUrl(thumbnail.path),
      };
    } catch {
      return { ...doc, thumbnailUrl: null };
    }
  }));
}

async function updateVisibility({ id, userId, role, isPublic }) {
  const doc = role === 'admin'
    ? await documentModel.findById(id)
    : await canEditDocument(userId, id);
  if (!doc) {
    throw createError(404, 'Document not found');
  }

  const updatedDocument = await documentModel.updateVisibility(id, Boolean(isPublic));
  const [documentWithThumbnail] = await addThumbnailUrls([updatedDocument]);
  return {
    message: isPublic ? 'Document is now public' : 'Document is now private',
    document: mapDocument(documentWithThumbnail),
  };
}

async function listDocuments({ userId, search, subjectId }) {
  const documents = (await documentModel.findByUserId(userId)).map(mapDocument);
  return addThumbnailUrls(filterDocuments(documents, { search, subjectId }));
}



async function getDocumentById({ id, userId }) {

  const doc = await documentModel.findAccessibleById(id, userId);

  if (!doc) {

    throw createError(404, 'Document not found');

  }



  return mapDocument(doc);

}

async function getWorkspaceDocumentById({ id, userId }) {
  const libraryDocument = await getDocumentById({ id, userId });
  return libraryDocument || documentModel.findOwnedSharedById(id, userId);
}



async function getSignedUrl({ id, userId }) {

  const doc = await documentModel.findAccessibleById(id, userId)
    || await documentModel.findOwnedSharedById(id, userId);

  if (!doc || !doc.cloud_files) {

    throw createError(404, 'File not found');

  }



  return { signedUrl: await supabaseService.getSignedUrl(doc.cloud_files.storage_path) };

}



async function updateDocument({ document, title, subjectId, tags }) {

  if (title === undefined && subjectId === undefined && tags === undefined) {

    throw createError(400, 'Nothing to update. Send title, subjectId and/or tags');

  }



  if (title !== undefined && !String(title).trim()) {

    throw createError(400, 'Title cannot be empty');

  }



  let updated = document;



  if (title !== undefined || subjectId !== undefined) {

    updated = await documentModel.update(document.id, {

      title: title !== undefined ? String(title).trim() : undefined,

      subjectId,

    });

  }



  if (tags !== undefined) {

    await tagModel.setForDocument(document.id, tags);

    updated = await documentModel.findById(document.id);

  }



  activityService.log({

    userId: document.user_id,

    action: 'document.update',

    targetType: 'document',

    targetId: updated.id,

    metadata: { title: updated.title, subjectId: updated.subject_id },

  });



  return {

    message: 'Document updated successfully',

    document: mapDocument(updated),

  };

}



async function deleteDocument({ document, userId }) {
  const importedSessionId = await deleteImportedForkForPrimaryDocument({ document, userId });
  if (!importedSessionId && await chatModel.countActiveSessionsByPrimaryDocument(document.id)) {
    throw createError(409, 'This document is the primary document of an active chat session. Keep the chat or delete the session first.');
  }

  const storagePath = document.cloud_files?.storage_path;

  const fileId = document.file_id;



  await documentModel.delete(document.id);



  if (fileId && await documentModel.countDocumentsByFileId(fileId) === 0) {

    await documentModel.deleteCloudFile(fileId);

  }



  // Chỉ xóa object vật lý khi không còn cloud_file nào khác trỏ tới (dedup-safe)

  if (storagePath) {

    const stillReferenced = await documentModel.countCloudFilesByStoragePath(storagePath);

    if (stillReferenced === 0) {

      await supabaseService.deleteFile(storagePath);

    }

  }



  activityService.log({

    userId,

    action: 'document.delete',

    targetType: 'document',

    targetId: document.id,

    metadata: { title: document.title },

  });



  return { message: 'Document deleted successfully' };

}

async function deleteImportedForkForPrimaryDocument({ document, userId }) {
  const provenance = await chatSnapshotModel.findOwnedImportByLibraryDocument(document.id, userId);
  const sessionId = provenance?.chat_snapshot_imports?.fork_session_id;
  if (!sessionId) return null;
  const session = await chatModel.findOwnedSession(sessionId, userId);
  if (!session || Number(session.primary_document_id) !== Number(document.id)) return null;

  await chatModel.softRemoveAllSessionDocuments(session.id, userId);
  await chatModel.softDeleteOwnedSession(session.id, userId);
  activityService.log({
    userId,
    action: 'chat.snapshot.imported_session.delete_with_primary_document',
    targetType: 'chat_session',
    targetId: session.id,
    metadata: { documentId: document.id },
  });
  return session.id;
}



async function listDocumentShares({ document }) {

  const shares = await documentModel.findSharesByDocId(document.id);

  const users = await Promise.all(

    shares.map((share) => userModel.findById(share.shared_to))

  );



  return shares.map((share, index) => ({

    id: share.id,

    sharedTo: users[index]

      ? { id: users[index].id, email: users[index].email }

      : null,

    createdAt: share.created_at,

  }));

}



async function shareDocument({ document, userId, email }) {

  const targetEmail = String(email || '').trim().toLowerCase();

  if (!targetEmail) {

    throw createError(400, 'Email is required');

  }



  const recipient = await userModel.findByEmail(targetEmail);

  if (!recipient) {

    throw createError(404, 'User not found with this email');

  }

  if (recipient.status !== 'active') {

    throw createError(400, 'This user account is not active');

  }

  if (recipient.id === userId) {

    throw createError(400, 'You cannot share a document with yourself');

  }



  const existing = await documentModel.findShareByDocAndRecipient(document.id, recipient.id);

  if (existing?.status === 'active') {

    throw createError(400, 'Document is already shared with this user');

  }



  const share = await documentModel.createShare({

    docId: document.id,

    sharedBy: userId,

    sharedTo: recipient.id,

  });



  const sharer = await userModel.findById(userId);

  await notificationModel.create({

    userId: recipient.id,

    type: 'share',

    message: `${sharer?.email || 'Someone'} shared "${document.title}" with you`,

    refDocId: document.id,

  });



  activityService.log({

    userId,

    action: 'document.share',

    targetType: 'document',

    targetId: document.id,

    metadata: { sharedTo: recipient.email },

  });



  return {

    message: 'Document shared successfully',

    share: {

      id: share.id,

      sharedTo: { id: recipient.id, email: recipient.email },

      createdAt: share.created_at,

    },

  };

}



async function revokeDocumentShare({ document, shareId }) {

  const revoked = await documentModel.revokeShare(shareId, document.id);

  if (!revoked) {

    throw createError(404, 'Share not found');

  }



  return { message: 'Share revoked successfully' };

}

async function saveOcrText({ document, text, append }) {
  const normalized = String(text || '').trim();
  if (!normalized) {
    throw createError(400, 'Text is required');
  }

  const merged = append && document.extracted_text
    ? `${String(document.extracted_text).trim()}\n\n${normalized}`
    : normalized;

  const updated = await documentModel.updateExtraction(document.id, {
    text: merged,
    status: merged.length >= 50 ? 'ready' : 'empty',
    error: null,
    metadata: {
      extractionMethod: 'manual-ocr-text',
      fallbackFromPdfParse: false,
    },
  });

  const [documentWithThumbnail] = await addThumbnailUrls([updated]);
  return mapDocument(documentWithThumbnail);
}

// ─── Soft delete / trash / restore ──────────────────────────────────────────

// Owner xóa mềm: đánh dấu deleted_at, file vẫn ở trên cloud (chỉ chủ sở hữu)
async function softDeleteDocument({ document, userId }) {
  if (document.user_id !== userId) {
    throw createError(403, 'You can only delete your own documents');
  }
  const importedSessionId = await deleteImportedForkForPrimaryDocument({ document, userId });
  if (!importedSessionId && await chatModel.countActiveSessionsByPrimaryDocument(document.id)) {
    throw createError(409, 'This document is the primary document of an active chat session. Keep the chat or delete the session first.');
  }
  await documentModel.softDelete(document.id);

  activityService.log({
    userId,
    action: 'document.soft_delete',
    targetType: 'document',
    targetId: document.id,
    metadata: { title: document.title },
  });

  return {
    message: importedSessionId
      ? 'Document and imported chat session moved to trash'
      : 'Document moved to trash',
    documentDeleted: true,
    sessionDeleted: Boolean(importedSessionId),
    sessionId: importedSessionId,
  };
}

// Danh sách thùng rác của user
async function listTrash({ userId }) {
  const documents = await documentModel.findDeletedByUserId(userId);
  return documents.map(mapDocument);
}

// Khôi phục doc trong thùng rác (chỉ chủ sở hữu)
async function restoreDocument({ id, userId }) {
  const doc = await documentModel.findAnyById(id);
  if (!doc || doc.document_scope !== 'library' || !doc.deleted_at) {
    throw createError(404, 'Document not found in trash');
  }
  if (doc.user_id !== userId) {
    throw createError(403, 'You can only restore your own documents');
  }

  const restored = await documentModel.restore(id);

  activityService.log({
    userId,
    action: 'document.restore',
    targetType: 'document',
    targetId: doc.id,
  });

  return { message: 'Document restored', document: mapDocument(restored) };
}

const TRASH_RETENTION_DAYS = 30;

// Xóa cứng vĩnh viễn — chỉ chủ sở hữu, và doc PHẢI đang ở thùng rác
async function purgeDocument({ id, userId }) {
  const doc = await documentModel.findAnyById(id);
  if (!doc || doc.document_scope !== 'library') {
    throw createError(404, 'Document not found');
  }
  if (doc.user_id !== userId) {
    throw createError(403, 'You can only permanently delete your own documents');
  }
  if (!doc.deleted_at) {
    throw createError(400, 'Document must be in trash before it can be permanently deleted');
  }

  // Tái dùng hard-delete sẵn có (xóa file storage + row DB + cloud_file)
  await deleteDocument({ document: doc, userId });

  return { message: 'Document permanently deleted' };
}

// Đổ sạch thùng rác: purge toàn bộ doc đã xóa mềm của user
async function emptyTrash({ userId }) {
  const docs = await documentModel.findDeletedByUserId(userId);
  let purged = 0;
  for (const doc of docs) {
    await deleteDocument({ document: doc, userId });
    purged += 1;
  }
  return { message: `Emptied trash: ${purged} document(s) permanently deleted`, purged };
}

// Xóa mềm nhiều doc cùng lúc (chỉ doc của chính user)
async function bulkSoftDelete({ ids, userId }) {
  const succeeded = [];
  const failed = [];
  for (const id of ids) {
    const doc = await documentModel.findById(id);
    if (!doc) {
      failed.push({ id, reason: 'not found' });
      continue;
    }
    if (doc.user_id !== userId) {
      failed.push({ id, reason: 'forbidden' });
      continue;
    }
    await documentModel.softDelete(id);
    activityService.log({
      userId,
      action: 'document.soft_delete',
      targetType: 'document',
      targetId: doc.id,
      metadata: { title: doc.title },
    });
    succeeded.push(doc.id);
  }
  return { message: `Soft-deleted ${succeeded.length} document(s)`, succeeded, failed };
}

// Khôi phục nhiều doc cùng lúc (chỉ doc của chính user)
async function bulkRestore({ ids, userId }) {
  const succeeded = [];
  const failed = [];
  for (const id of ids) {
    const doc = await documentModel.findAnyById(id);
    if (!doc || doc.document_scope !== 'library' || !doc.deleted_at) {
      failed.push({ id, reason: 'not in trash' });
      continue;
    }
    if (doc.user_id !== userId) {
      failed.push({ id, reason: 'forbidden' });
      continue;
    }
    await documentModel.restore(id);
    activityService.log({
      userId,
      action: 'document.restore',
      targetType: 'document',
      targetId: doc.id,
    });
    succeeded.push(doc.id);
  }
  return { message: `Restored ${succeeded.length} document(s)`, succeeded, failed };
}

// Auto-purge: xóa cứng mọi doc đã ở thùng rác quá hạn giữ (mặc định 30 ngày)
async function purgeExpiredTrash() {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const docs = await documentModel.findExpiredTrash(cutoff);
  let purged = 0;
  for (const doc of docs) {
    try {
      await deleteDocument({ document: doc, userId: doc.user_id });
      purged += 1;
    } catch (err) {
      console.error(`[auto-purge] failed for document ${doc.id}:`, err.message);
    }
  }
  return { purged, retentionDays: TRASH_RETENTION_DAYS, ranAt: new Date().toISOString() };
}

// Các action liên quan vòng đời xóa, dùng cho admin xem lịch sử
const DELETION_LOG_ACTIONS = [
  'document.soft_delete',
  'document.restore',
  'document.delete',
  'document.purge',
];

// Admin xem lịch sử xóa/khôi phục — chỉ metadata (title, ai, khi nào), không có nội dung file
async function listDeletionLogs({ limit }) {
  const logs = await activityService.listByActions(DELETION_LOG_ACTIONS, limit);
  return logs.map((entry) => ({
    logId: entry.id,
    action: entry.action,
    documentId: entry.target_id,
    title: entry.metadata?.title || null,
    userId: entry.user_id,
    at: entry.created_at,
  }));
}

module.exports = {
  mapDocument,
  listDocuments,
  getDocumentById,
  getWorkspaceDocumentById,
  getSignedUrl,
  addThumbnailUrls,
  buildPublicDocumentPreview,
  canReadDocument,
  canUseDocumentInChat,
  canAttachDocumentToSession,
  canEditDocument,
  updateVisibility,
  updateDocument,
  deleteDocument,
  deleteImportedForkForPrimaryDocument,
  softDeleteDocument,
  listTrash,
  restoreDocument,
  purgeDocument,
  emptyTrash,
  bulkSoftDelete,
  bulkRestore,
  purgeExpiredTrash,
  listDeletionLogs,
  listDocumentShares,
  shareDocument,
  revokeDocumentShare,
  saveOcrText,
};
