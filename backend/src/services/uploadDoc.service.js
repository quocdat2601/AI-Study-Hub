const documentModel = require('../models/document.model');
const tagModel = require('../models/tag.model');
const userModel = require('../models/user.model');
const documentService = require('./document.service');
const notificationService = require('./notification.service');
const supabaseService = require('./supabase.service');
const documentTextService = require('./document-text.service');
const activityService = require('./activity.service');
const createError = require('../utils/createError');
const { buildSafeStorageFileName } = require('../utils/sanitizeFileName');

function formatMegabytes(bytes) {
  return Math.round(Number(bytes || 0) / 1024 / 1024);
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

/**
 * UploadDoc — upload file lên Supabase Storage và lưu metadata vào DB.
 */
async function upload({ userId, file, title, subjectId, tags }) {
  if (!file) {
    throw createError(400, 'No file uploaded');
  }

  const user = await userModel.findById(userId);
  if (!user) {
    throw createError(404, 'User not found');
  }

  const usedBytes = await documentModel.sumStorageByUserId(userId);
  const limitBytes = Number(user.storage_limit_bytes || 0);
  if (usedBytes + file.size > limitBytes) {
    throw createError(
      400,
      `Storage limit exceeded. ${formatMegabytes(usedBytes)} MB / ${formatMegabytes(limitBytes)} MB`
    );
  }

  const fileName = buildSafeStorageFileName(file.originalname);
  const storagePath = `user-${userId}/${fileName}`;
  let cloudFile = null;
  let document = null;

  try {
    await supabaseService.uploadFile(file.buffer, storagePath, file.mimetype);

    cloudFile = await documentModel.createCloudFile({
      storage_path: storagePath,
      mime_type: file.mimetype,
      size_bytes: file.size,
    });

    document = await documentModel.create({
      title: title || file.originalname,
      user_id: userId,
      subject_id: subjectId || null,
      file_id: cloudFile.id,
      status: 'uploaded',
      extraction_status: 'pending',
    });

    let extraction;
    try {
      extraction = await documentTextService.extractTextFromBuffer(file.buffer, file.mimetype);
    } catch (err) {
      extraction = { text: '', status: 'failed', error: err.message };
    }

    const savedDocument = await documentModel.updateExtraction(document.id, extraction);

    if (tags) {
      await tagModel.setForDocument(savedDocument.id, tags);
    }

    const documentWithTags = documentService.mapDocument(
      await documentModel.findById(savedDocument.id)
    );

    activityService.log({
      userId,
      action: 'document.upload',
      targetType: 'document',
      targetId: savedDocument.id,
      metadata: {
        title: savedDocument.title,
        mimeType: file.mimetype,
        extractionStatus: savedDocument.extraction_status,
      },
    });

    // Notify administrators of the new upload
    await notificationService.notifyAdmins({
      type: 'system',
      message: `User ${user.email} uploaded a new document: "${savedDocument.title}"`,
      refDocId: savedDocument.id,
    });

    return {
      message: 'Document uploaded successfully',
      document: documentWithTags,
    };
  } catch (err) {
    await cleanupFailedUpload({ storagePath, cloudFile, document });
    throw err;
  }
}

module.exports = { upload };
