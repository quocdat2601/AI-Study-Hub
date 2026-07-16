const documentModel = require('../models/document.model');


function requireDocumentOwner() {
  return async function documentOwnerMiddleware(req, res, next) {
    try {
      const doc = await documentModel.findById(req.params.id);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const isOwner = doc.user_id === req.user.id;
      const isAdmin = req.user.role === 'admin';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Only the document owner can perform this action' });
      }

      req.document = doc;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = requireDocumentOwner;
