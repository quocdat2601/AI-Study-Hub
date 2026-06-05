const documentModel = require('../models/document.model');
const supabaseService = require('./supabase.service');
const chatService = require('./chat.service');
const documentService = require('./document.service');

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

module.exports = {
  getTrendingDocuments,
  getPublicChatShare,
};
