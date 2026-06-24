const documentModel = require('../models/document.model');
const supabaseService = require('./supabase.service');
const chatService = require('./chat.service');
const documentService = require('./document.service');
const createError = require('../utils/createError');

async function getTrendingDocuments(limit) {
  const documents = await documentModel.findTrending(limit);
  const documentsWithThumbnails = await Promise.all(documents.map(async (doc) => {
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

  return documentsWithThumbnails.map(documentService.buildPublicDocumentPreview);
}

async function getPublicChatShare(token) {
  return chatService.getPublicChatShare(token);
}

async function searchPublicDocuments({ search, subjectId, sortBy, page, limit }) {
  const { documents, totalCount } = await documentModel.searchPublic({
    search,
    subjectId,
    sortBy,
    page,
    limit,
  });

  const documentsWithThumbnails = await Promise.all(documents.map(async (doc) => {
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

  const previews = documentsWithThumbnails.map((doc) => {
    const preview = documentService.buildPublicDocumentPreview(doc);
    return {
      ...preview,
      downloadCount: Number(doc.download_count || 0),
    };
  });

  return {
    documents: previews,
    totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
  };
}

async function getPublicDocumentById(id) {
  const doc = await documentModel.findPublicById(id);
  if (!doc) {
    throw createError(404, 'Public document not found');
  }

  // Increment view count asynchronously
  documentModel.incrementViewCount(id).catch((err) => {
    console.error('Failed to increment view count:', err.message);
  });

  let thumbnailUrl = null;
  if (doc.thumbnail_path && doc.thumbnail_status === 'ready') {
    try {
      thumbnailUrl = await supabaseService.getSignedUrl(doc.thumbnail_path);
    } catch {
      thumbnailUrl = null;
    }
  }

  const mapped = documentService.mapDocument(doc);
  return {
    ...mapped,
    thumbnailUrl,
    uploader: doc.users ? { email: doc.users.email } : null,
    viewCount: Number(doc.view_count || 0),
    downloadCount: Number(doc.download_count || 0),
  };
}

async function getPublicDocumentSignedUrl(id) {
  const doc = await documentModel.findPublicById(id);
  if (!doc || !doc.cloud_files) {
    throw createError(404, 'Public document not found');
  }

  // Increment download count asynchronously
  documentModel.incrementDownloadCount(id).catch((err) => {
    console.error('Failed to increment download count:', err.message);
  });

  const signedUrl = await supabaseService.getSignedUrl(doc.cloud_files.storage_path);
  return { signedUrl };
}

async function listDocumentComments(docId) {
  const comments = await documentModel.listComments(docId);
  return comments.map((c) => ({
    id: c.id,
    content: c.content,
    rating: c.rating,
    createdAt: c.created_at,
    user: c.users ? { email: c.users.email } : { email: 'anonymous' },
  }));
}

async function createDocumentComment({ docId, userId, content, rating }) {
  if (!String(content).trim()) {
    throw createError(400, 'Content cannot be empty');
  }

  const doc = await documentModel.findPublicById(docId);
  if (!doc) {
    throw createError(404, 'Public document not found');
  }

  const comment = await documentModel.createComment({ docId, userId, content, rating });
  return {
    id: comment.id,
    content: comment.content,
    rating: comment.rating,
    createdAt: comment.created_at,
    user: comment.users ? { email: comment.users.email } : { email: 'anonymous' },
  };
}

module.exports = {
  getTrendingDocuments,
  getPublicChatShare,
  searchPublicDocuments,
  getPublicDocumentById,
  getPublicDocumentSignedUrl,
  listDocumentComments,
  createDocumentComment,
};
