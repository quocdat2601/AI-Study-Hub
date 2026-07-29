const crypto = require('crypto');
const documentModel = require('../models/document.model');
const documentChunkModel = require('../models/document-chunk.model');
const tagModel = require('../models/tag.model');
const userModel = require('../models/user.model');
const documentService = require('./document.service');
const notificationService = require('./notification.service');
const supabaseService = require('./supabase.service');
const documentTextService = require('./document-text.service');
const documentThumbnailService = require('./document-thumbnail.service');
const aiTagService = require('./ai-tag.service');
const activityService = require('./activity.service');
const createError = require('../utils/createError');
const { buildSafeStorageFileName } = require('../utils/sanitizeFileName');

function formatMegabytes(bytes) {
  return Math.round(Number(bytes || 0) / 1024 / 1024);
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
  return false;
}

async function cleanupFailedUpload({ storagePath, cloudFile, document }) {
  if (document?.id) {
    try {
      await documentModel.delete(document.id);
    } catch (err) {
      console.error('Document cleanup failed:', err.message);
    }
  }

  if (cloudFile?.id) {
    try {
      await documentModel.deleteCloudFile(cloudFile.id);
    } catch (err) {
      console.error('Cloud file cleanup failed:', err.message);
    }
  }

  if (storagePath) {
    try {
      await supabaseService.deleteFile(storagePath);
    } catch (err) {
      console.error('Storage cleanup failed:', err.message);
    }
  }
}


async function applyExtraction({ document, file, contentHash, deduped }) {
  if (deduped) {
    const source = await documentModel.findReadySourceByHash(contentHash, document.id);
    if (source) {
      const savedDocument = await documentModel.updateExtraction(document.id, {
        text: source.extracted_text,
        status: source.extraction_status,
        error: null,
        metadata: {
          ...(source.extraction_metadata || {}),
          dedupedFromDocumentId: source.id,
        },
      });
      await documentChunkModel.copyFromDocument(source.id, document.id);
      return savedDocument;
    }

  }

  let extraction;
  try {
    extraction = await documentTextService.extractTextFromBuffer(file.buffer, file.mimetype);
  } catch (err) {
    extraction = { text: '', status: 'failed', error: err.message };
  }
  return documentModel.updateExtraction(document.id, extraction);
}


async function upload({
  userId,
  file,
  title,
  subjectId,
  tags,
  isPublic = false,
  documentScope = 'library',
  originSessionId = null,
  expiresAt = null,
  afterDocumentCreated,
}) {
  if (!file) {
    throw createError(400, 'No file uploaded');
  }

  const user = await userModel.findById(userId);
  if (!user) {
    throw createError(404, 'User not found');
  }

  if (!['library', 'session'].includes(documentScope)) {
    throw createError(400, 'Document scope is invalid');
  }
  if (documentScope === 'session' && !originSessionId) {
    throw createError(400, 'Session documents require an origin session');
  }

  const usedBytes = await documentModel.sumStorageByUserId(userId);
  const limitBytes = Number(user.storage_limit_bytes || 0);
  if (usedBytes + file.size > limitBytes) {
    throw createError(
      400,
      `Storage limit exceeded. ${formatMegabytes(usedBytes)} MB / ${formatMegabytes(limitBytes)} MB`
    );
  }


  const contentHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const existingFile = await documentModel.findCloudFileByHash(contentHash);
  const deduped = Boolean(existingFile);

  const fileName = buildSafeStorageFileName(file.originalname);
  const storagePath = existingFile?.storage_path || `user-${userId}/${fileName}`;
  let cloudFile = null;
  let document = null;

  try {

    if (!deduped) {
      await supabaseService.uploadFile(file.buffer, storagePath, file.mimetype);
    }

    cloudFile = await documentModel.createCloudFile({
      storage_path: storagePath,
      mime_type: file.mimetype,
      size_bytes: file.size,
      content_hash: contentHash,
    });

    document = await documentModel.create({
      title: title || file.originalname,
      user_id: userId,
      subject_id: subjectId || null,
      file_id: cloudFile.id,
      status: 'uploaded',
      extraction_status: 'pending',
      is_public: documentScope === 'library' && parseBoolean(isPublic),
      document_scope: documentScope,
      origin_session_id: documentScope === 'session' ? Number(originSessionId) : null,
      lifecycle_status: 'active',
      last_accessed_at: documentScope === 'session' ? new Date().toISOString() : null,
      expires_at: documentScope === 'session' ? expiresAt : null,
      expired_at: null,
      purge_after: null,
    });

    if (afterDocumentCreated) {
      await afterDocumentCreated(document);
    }

    await documentThumbnailService.ensureThumbnailForDocument({
      document,
      buffer: file.buffer,
      mimeType: file.mimetype,
    });

    const savedDocument = await applyExtraction({ document, file, contentHash, deduped });

    if (tags) {
      await tagModel.setForDocument(savedDocument.id, tags);
    } else if (savedDocument?.extraction_status === 'ready') {

      await aiTagService.autoTagDocument({
        userId,
        docId: savedDocument.id,
        title: savedDocument.title,
        text: savedDocument.extracted_text,
      }).catch((err) => console.error('Auto-tag failed:', err.message));
    }

    const savedDocumentWithRelations = documentScope === 'session'
      ? await documentModel.findActiveSessionScopedById(savedDocument.id, originSessionId)
      : savedDocument;

    const [documentWithThumbnail] = await documentService.addThumbnailUrls([
      savedDocumentWithRelations,
    ]);
    const documentWithTags = documentService.mapDocument(documentWithThumbnail);

    activityService.log({
      userId,
      action: 'document.upload',
      targetType: 'document',
      targetId: savedDocument.id,
      metadata: {
        title: savedDocument.title,
        mimeType: file.mimetype,
        extractionStatus: savedDocument.extraction_status,
        deduplicated: deduped,
      },
    });

    // Notify administrators of the new upload
    await notificationService.notifyAdmins({
      type: 'system',
      message: `User ${user.email} uploaded a new document: "${savedDocument.title}"`,
      refDocId: savedDocument.id,
    });

    return {
      message: deduped
        ? 'Document uploaded successfully (reused existing file)'
        : 'Document uploaded successfully',
      document: documentWithTags,
    };
  } catch (err) {

    await cleanupFailedUpload({
      storagePath: deduped ? null : storagePath,
      cloudFile,
      document,
    });
    throw err;
  }
}

module.exports = { upload };
