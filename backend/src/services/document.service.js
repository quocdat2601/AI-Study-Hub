const documentModel = require('../models/document.model');
const supabaseService = require('./supabase.service');
const documentTextService = require('./document-text.service');
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
  return filterDocuments(documents, { search, subjectId });
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

async function uploadDocument({ userId, file, title, subjectId }) {
  if (!file) {
    throw createError(400, 'No file uploaded');
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
    });

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

    return {
      message: 'Document uploaded successfully',
      document: savedDocument,
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

  return doc;
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
};
