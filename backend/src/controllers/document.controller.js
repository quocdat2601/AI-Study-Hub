const Document = require('../models/document.model');
const supabaseService = require('../services/supabase.service');

/**
 * List owned + shared documents
 */
async function getAllDocuments(req, res, next) {
  try {
    const { search, subjectId } = req.query;
    const userId = req.user.id;

    // We'll use the model but apply filters if needed
    // For now, getting all for the user
    const documents = await Document.findByUserId(userId);

    // Basic search filter
    let filtered = documents;
    if (search) {
      filtered = filtered.filter(doc => 
        doc.title.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (subjectId) {
      filtered = filtered.filter(doc => doc.subject_id == subjectId);
    }

    res.json(filtered);
  } catch (err) {
    next(err);
  }
}

/**
 * Upload document
 */
async function uploadDocument(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.id;
    const { title, subjectId } = req.body;

    // 1. Upload to Supabase Storage
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const storagePath = `user-${userId}/${fileName}`;
    
    await supabaseService.uploadFile(req.file.buffer, storagePath, req.file.mimetype);

    // 2. Create entry in DB (Simplified for now - needs cloud_files table entry too)
    // In a real scenario, you'd do this in a transaction
    // For this boilerplate, we'll return success
    res.status(201).json({ 
      message: 'Document uploaded successfully',
      storagePath 
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get one document
 */
async function getDocumentById(req, res, next) {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

/**
 * Get signed URL
 */
async function getSignedUrl(req, res, next) {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc || !doc.cloud_files) {
      return res.status(404).json({ error: 'File not found' });
    }

    const url = await supabaseService.getSignedUrl(doc.cloud_files.storage_path);
    res.json({ signedUrl: url });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllDocuments,
  uploadDocument,
  getDocumentById,
  getSignedUrl
};
