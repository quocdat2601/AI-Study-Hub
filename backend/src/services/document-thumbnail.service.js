const documentModel = require('../models/document.model');
const supabaseService = require('./supabase.service');
const thumbnailService = require('./thumbnail.service');

const THUMBNAIL_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function isSupportedThumbnailMimeType(mimeType) {
  return THUMBNAIL_MIME_TYPES.has(mimeType);
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

  try {
    const thumbnailBuffer = await thumbnailService.generateThumbnailFromBuffer(buffer, mimeType);
    const thumbnailPath = thumbnailService.createThumbnailStoragePath({
      userId: document.user_id,
      documentId: document.id,
    });
    await supabaseService.uploadFile(thumbnailBuffer, thumbnailPath, 'image/png', { upsert: true });
    await documentModel.updateThumbnail(document.id, {
      path: thumbnailPath,
      status: 'ready',
      error: null,
    });

    return {
      status: 'ready',
      path: thumbnailPath,
      error: null,
    };
  } catch (err) {
    const message = err.message || 'Thumbnail generation failed';
    await documentModel.updateThumbnail(document.id, {
      path: null,
      status: 'failed',
      error: message,
    });

    return {
      status: 'failed',
      path: null,
      error: message,
    };
  }
}

module.exports = {
  generateAndSaveThumbnail,
  isSupportedThumbnailMimeType,
};
