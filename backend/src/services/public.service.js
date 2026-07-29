const documentModel = require('../models/document.model');
const supabaseService = require('./supabase.service');
const chatService = require('./chat.service');
const documentService = require('./document.service');
const createError = require('../utils/createError');

/**
 * Retrieves the trending documents inside the public docs catalog.
 * @param {number} limit - Maximum number of documents to return.
 * @returns {Promise<Array<object>>} Trending public document previews.
 */
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

/**
 * Retrieves public chat session sharing traces using the unique share token.
 * @param {string} token - Unique shared session token.
 * @returns {Promise<object>} Shared session logs and messages content.
 */
async function getPublicChatShare(token) {
  return chatService.getPublicChatShare(token);
}

/**
 * Searches public documents with query text, optional subject tag, sorting, and pagination.
 * @param {object} params
 * @param {string} [params.search] - Case-insensitive text query.
 * @param {number} [params.subjectId] - Optional subject tag filter ID.
 * @param {string} [params.sortBy] - Sorting filter ('views', 'downloads', 'recent').
 * @param {number} params.page - Selected page index.
 * @param {number} params.limit - Query window count limit.
 * @returns {Promise<object>} Paginated document list.
 */
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

/**
 * Fetches single document profile details by ID and increments view counters.
 * @param {number|string} id - Document ID.
 * @returns {Promise<object>} Hydrated document preview metadata with download and view counts.
 */
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

/**
 * Generates secure cloud storage download links for a document and increments down counter.
 * @param {number|string} id - Target document ID.
 * @returns {Promise<{signedUrl: string}>} Signed storage URL download target.
 */
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

/**
 * Fetches comment feedback threads on a shared document asset.
 * @param {number|string} docId - Target document ID.
 * @returns {Promise<Array<object>>} Comments thread list.
 */
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

/**
 * Creates user rating feedback and comment review on a shared document.
 * @param {object} params
 * @param {number|string} params.docId - Associated document ID.
 * @param {string} params.userId - Reviewer user ID context.
 * @param {string} params.content - Feedback comment text.
 * @param {number} params.rating - Numeric rating.
 * @returns {Promise<object>} Created comment metadata properties.
 */
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
