const documentModel = require('../models/document.model');
const userModel = require('../models/user.model');
const supabaseService = require('./supabase.service');
const documentTextService = require('./document-text.service');
const thumbnailService = require('./thumbnail.service');
const activityService = require('./activity.service');
const createError = require('../utils/createError');

function filterDocuments(documents, { search, subjectId }) {
  let filtered = documents;

  if (search) {
    const term = String(search).trim().toLowerCase();
    filtered = filtered.filter((doc) => doc.title.toLowerCase().includes(term));
  }

  if (subjectId) {
    filtered = filtered.filter((doc) => Number(doc.subject_id) === Number(subjectId));
  }

  return filtered;
}

async function listDocuments({ userId, search, subjectId }) {
  const documents = await documentModel.findByUserId(userId);
  return addThumbnailUrls(filterDocuments(documents, { search, subjectId }));
}

async function addThumbnailUrls(documents) {
  return Promise.all((documents || []).map(async (doc) => {
    if (!doc.thumbnail_path || doc.thumbnail_status !== 'ready') {
      return { ...doc, thumbnailUrl: null };
    }

    try {
      return {
        ...doc,
        thumbnailUrl: await supabaseService.getSignedUrl(doc.thumbnail_path),
      };
    } catch {
      return { ...doc, thumbnailUrl: null };
    }
  }));
}

async function generateAndSaveThumbnail({ userId, documentId, file }) {
  try {
    const thumbnailBuffer = await thumbnailService.generateThumbnailFromBuffer(file.buffer, file.mimetype);
    const thumbnailPath = thumbnailService.createThumbnailStoragePath({ userId, documentId });
    await supabaseService.uploadFile(thumbnailBuffer, thumbnailPath, 'image/png', { upsert: true });
    return documentModel.updateThumbnail(documentId, {
      status: 'ready',
      path: thumbnailPath,
    });
  } catch (err) {
    return documentModel.updateThumbnail(documentId, {
      status: 'failed',
      error: err.message,
    });
  }
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
      console.error('Cloud file row cleanup failed:', err.message);
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

function formatMegabytes(bytes) {
  return Math.round(Number(bytes || 0) / 1024 / 1024);
}

async function uploadDocument({ userId, file, title, subjectId }) {
  if (!file) {
    throw createError(400, 'No file uploaded');
  }

  const user = await userModel.findById(userId);
  if (!user) {
    throw createError(404, 'User not found');
  }

  const usedBytes = await documentModel.sumStorageByUserId(userId);
  const storageLimitBytes = Number(user.storage_limit_bytes || 0);
  if (usedBytes + file.size > storageLimitBytes) {
    throw createError(
      400,
      `Storage limit exceeded. ${formatMegabytes(usedBytes)} MB used of ${formatMegabytes(storageLimitBytes)} MB`
    );
  }

  const fileName = `${Date.now()}-${file.originalname}`;
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
      thumbnail_status: 'pending',
    });

    await generateAndSaveThumbnail({ userId, documentId: document.id, file });

    let extraction;
    try {
      extraction = await documentTextService.extractTextFromBuffer(file.buffer, file.mimetype);
    } catch (err) {
      extraction = {
        text: '',
        status: 'failed',
        error: err.message,
      };
    }

    const savedDocument = await documentModel.updateExtraction(document.id, extraction);
    activityService.log({
      userId,
      action: 'document.upload',
      targetType: 'document',
      targetId: savedDocument.id,
      metadata: {
        mimeType: file.mimetype,
        extractionStatus: savedDocument.extraction_status,
      },
    });

    const [documentWithThumbnail] = await addThumbnailUrls([savedDocument]);

    return {
      message: 'Document uploaded successfully',
      document: documentWithThumbnail,
    };
  } catch (err) {
    await cleanupFailedUpload({ storagePath, cloudFile, document });
    throw err;
  }
}

async function getDocumentById({ id, userId }) {
  const doc = await documentModel.findAccessibleById(id, userId);
  if (!doc) {
    throw createError(404, 'Document not found');
  }

  const [documentWithThumbnail] = await addThumbnailUrls([doc]);
  return documentWithThumbnail;
}

async function getSignedUrl({ id, userId }) {
  const doc = await documentModel.findAccessibleById(id, userId);
  if (!doc || !doc.cloud_files) {
    throw createError(404, 'File not found');
  }

  return { signedUrl: await supabaseService.getSignedUrl(doc.cloud_files.storage_path) };
}

module.exports = {
  listDocuments,
  uploadDocument,
  getDocumentById,
  getSignedUrl,
  addThumbnailUrls,
};
