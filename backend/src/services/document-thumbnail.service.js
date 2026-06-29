const documentModel = require('../models/document.model');
const supabaseService = require('./supabase.service');
const thumbnailService = require('./thumbnail.service');

const THUMBNAIL_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const generationByFileId = new Map();

function createFileThumbnailPath(fileId) {
  return `thumbnails/files/${Number(fileId)}.png`;
}

function isSupportedThumbnailMimeType(mimeType) {
  return THUMBNAIL_MIME_TYPES.has(mimeType);
}

async function resolveReadyThumbnail(document) {
  if (document?.thumbnail_path && document.thumbnail_status === 'ready') {
    return {
      path: document.thumbnail_path,
      status: 'ready',
      error: document.thumbnail_error || null,
      generatedAt: document.thumbnail_generated_at || null,
    };
  }
  if (!document?.file_id) return null;

  const sibling = await documentModel.findReadyThumbnailByFileId(document.file_id);
  if (sibling?.thumbnail_path) {
    return {
      path: sibling.thumbnail_path,
      status: 'ready',
      error: sibling.thumbnail_error || null,
      generatedAt: sibling.thumbnail_generated_at || null,
    };
  }

  const fileThumbnailPath = createFileThumbnailPath(document.file_id);
  if (!await supabaseService.fileExists(fileThumbnailPath)) return null;

  const thumbnail = { path: fileThumbnailPath, status: 'ready', error: null };
  await documentModel.updateThumbnailsByFileId(document.file_id, thumbnail);
  return { ...thumbnail, generatedAt: null };
}

async function ensureThumbnailForDocument({ document, buffer, mimeType }) {
  const ready = await resolveReadyThumbnail(document);
  if (ready) return { ...ready, reused: true };
  if (!document?.file_id) return generateAndSaveThumbnail({ document, buffer, mimeType });
  if (!buffer || !isSupportedThumbnailMimeType(mimeType)) return null;

  const key = String(document.file_id);
  if (!generationByFileId.has(key)) {
    generationByFileId.set(key, generateAndSaveThumbnail({ document, buffer, mimeType })
      .finally(() => generationByFileId.delete(key)));
  }
  return generationByFileId.get(key);
}

async function generateAndSaveThumbnail({ document, buffer, mimeType }) {
  if (!document?.id || !document?.user_id) {
    throw new Error('Document id and user_id are required for thumbnail generation');
  }

  if (!isSupportedThumbnailMimeType(mimeType)) {
    return {
      status: 'skipped',
      path: null,
      error: `Unsupported thumbnail MIME type: ${mimeType || 'unknown'}`,
    };
  }

  if (document.file_id) {
    const existing = await resolveReadyThumbnail(document);
    if (existing?.path) {
      return {
        status: 'ready',
        path: existing.path,
        error: null,
        reused: true,
      };
    }
  }

  try {
    const thumbnailBuffer = await thumbnailService.generateThumbnailFromBuffer(buffer, mimeType);
    const thumbnailPath = thumbnailService.createThumbnailStoragePath({
      userId: document.user_id,
      documentId: document.id,
      fileId: document.file_id,
    });
    await supabaseService.uploadFile(thumbnailBuffer, thumbnailPath, 'image/png', { upsert: true });
    const thumbnailData = {
      path: thumbnailPath,
      status: 'ready',
      error: null,
    };
    if (document.file_id) {
      await documentModel.updateThumbnailsByFileId(document.file_id, thumbnailData);
    } else {
      await documentModel.updateThumbnail(document.id, thumbnailData);
    }

    return {
      status: 'ready',
      path: thumbnailPath,
      error: null,
    };
  } catch (err) {
    const message = err.message || 'Thumbnail generation failed';
    const thumbnailData = {
      path: null,
      status: 'failed',
      error: message,
    };
    if (document.file_id) {
      await documentModel.updateThumbnailsByFileId(document.file_id, thumbnailData);
    } else {
      await documentModel.updateThumbnail(document.id, thumbnailData);
    }

    return {
      status: 'failed',
      path: null,
      error: message,
    };
  }
}

module.exports = {
  generateAndSaveThumbnail,
  ensureThumbnailForDocument,
  resolveReadyThumbnail,
  createFileThumbnailPath,
  isSupportedThumbnailMimeType,
};
