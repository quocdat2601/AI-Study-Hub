const documentModel = require('../models/document.model');

const tagModel = require('../models/tag.model');

const userModel = require('../models/user.model');

const notificationModel = require('../models/notification.model');

const supabaseService = require('./supabase.service');

const activityService = require('./activity.service');

const createError = require('../utils/createError');

const PUBLIC_PREVIEW_MAX_CHARS = 150;

function mapDocument(doc) {

  if (!doc) return doc;



  const { document_tags: documentTags, ...rest } = doc;

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
  if (mimeType.includes('word')) return 'DOC';
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
  return canReadDocument(userId, id);
}

async function canEditDocument(userId, id) {
  return documentModel.findOwnedById(id, userId);
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

async function updateVisibility({ id, userId, isPublic }) {
  const doc = await canEditDocument(userId, id);
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



async function getSignedUrl({ id, userId }) {

  const doc = await documentModel.findAccessibleById(id, userId);

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

  const storagePath = document.cloud_files?.storage_path;

  const fileId = document.file_id;



  if (storagePath) {

    await supabaseService.deleteFile(storagePath);

  }



  await documentModel.delete(document.id);



  if (fileId) {

    await documentModel.deleteCloudFile(fileId);

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
  });

  const [documentWithThumbnail] = await addThumbnailUrls([updated]);
  return mapDocument(documentWithThumbnail);
}

module.exports = {
  mapDocument,
  listDocuments,
  getDocumentById,
  getSignedUrl,
  addThumbnailUrls,
  buildPublicDocumentPreview,
  canReadDocument,
  canUseDocumentInChat,
  canEditDocument,
  updateVisibility,
  updateDocument,
  deleteDocument,
  listDocumentShares,
  shareDocument,
  revokeDocumentShare,
  saveOcrText,
};

