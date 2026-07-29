const subjectModel = require('../models/subject.model');
const activityService = require('./activity.service');
const createError = require('../utils/createError');

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function validateSubject({ name, code }) {
  if (!String(name || '').trim()) {
    throw createError(400, 'Subject name is required');
  }

  if (!normalizeCode(code)) {
    throw createError(400, 'Subject code is required');
  }
}

function handleUniqueCodeError(err) {
  if (err.code === '23505') {
    throw createError(409, 'Subject code already exists');
  }
  throw err;
}

async function listSubjects() {
  const supabase = require('../config/supabase');
  const [subjects, docRowsResult] = await Promise.all([
    subjectModel.listSubjects(),
    supabase
      .from('documents')
      .select('subject_id')
      .eq('is_public', true)
      .eq('document_scope', 'library')
      .eq('lifecycle_status', 'active')
      .eq('status', 'indexed')
      .is('deleted_at', null)
  ]);

  if (docRowsResult.error) throw docRowsResult.error;

  const docCountsMap = new Map();
  (docRowsResult.data || []).forEach((row) => {
    if (row.subject_id) {
      docCountsMap.set(row.subject_id, (docCountsMap.get(row.subject_id) || 0) + 1);
    }
  });

  return (subjects || []).map((subject) => ({
    ...subject,
    docCount: Number(docCountsMap.get(subject.id) || 0),
  }));
}

async function createSubject({ name, code, description, createdBy }) {
  validateSubject({ name, code });

  try {
    const subject = await subjectModel.create({
      name: String(name).trim(),
      code: normalizeCode(code),
      description: String(description || '').trim(),
      created_by: createdBy,
    });

    activityService.log({
      userId: createdBy,
      action: 'subject.create',
      targetType: 'subject',
      targetId: subject.id,
    });

    return subject;
  } catch (err) {
    handleUniqueCodeError(err);
  }
}

async function updateSubject(id, { name, code, description }) {
  validateSubject({ name, code });

  try {
    const subject = await subjectModel.updateSubject(id, {
      name: String(name).trim(),
      code: normalizeCode(code),
      description: String(description || '').trim(),
    });

    if (!subject) {
      throw createError(404, 'Subject not found');
    }

    return subject;
  } catch (err) {
    handleUniqueCodeError(err);
  }
}

async function deleteSubject(id) {
  const documentCount = await subjectModel.countDocuments(id);

  if (documentCount > 0) {
    throw createError(400, 'Cannot delete a subject with assigned documents');
  }

  const subject = await subjectModel.deleteSubject(id);
  if (!subject) {
    throw createError(404, 'Subject not found');
  }

  return subject;
}

module.exports = {
  listSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
};
