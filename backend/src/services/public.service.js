const documentModel = require('../models/document.model');
const supabaseService = require('./supabase.service');

async function getTrendingDocuments(limit) {
  const documents = await documentModel.findTrending(limit);
  return Promise.all(documents.map(async (doc) => {
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

module.exports = {
  getTrendingDocuments,
};
