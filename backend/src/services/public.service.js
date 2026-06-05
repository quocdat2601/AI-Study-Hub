const documentModel = require('../models/document.model');

async function getTrendingDocuments(limit) {
  return documentModel.findTrending(limit);
}

module.exports = {
  getTrendingDocuments,
};
