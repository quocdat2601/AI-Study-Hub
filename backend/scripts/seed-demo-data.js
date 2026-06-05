require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const supabase = require('../src/config/supabase');
const supabaseService = require('../src/services/supabase.service');
const thumbnailService = require('../src/services/thumbnail.service');

const FILE_DIR = path.join(__dirname, '..', 'db', 'seeds', 'files');
const CREATOR_USER_ID = '5d687e23-1472-4a2f-ad46-6cdb08b16ea7';

const SUBJECTS = [
  {
    code: 'MLN131',
    name: 'MLN131',
    description: 'Materials for MLN131 study documents.',
  },
  {
    code: 'OTHER',
    name: 'Other',
    description: 'Documents that do not belong to a specific course subject.',
  },
];

const DOCUMENTS = [
  {
    fileMatch: 'MLN131',
    subjectCode: 'MLN131',
    viewCount: 30,
    text: 'Seeded MLN131 study material uploaded from real PDF source.',
  },
  {
    fileMatch: 'Hoa-purpose-of-visit',
    subjectCode: 'OTHER',
    viewCount: 12,
    text: 'Seeded personal document categorized as Other.',
  },
  {
    fileMatch: 'NGUYEN LE HONG HOA 87243020084',
    subjectCode: 'OTHER',
    viewCount: 8,
    text: 'Seeded personal document categorized as Other.',
  },
];

function titleFromFileName(fileName) {
  return path.basename(fileName, path.extname(fileName));
}

function safeStorageName(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  const baseName = path.basename(fileName, extension)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return `${baseName || Date.now()}${extension}`;
}

async function requireSeedFiles() {
  await fs.mkdir(FILE_DIR, { recursive: true });

  for (const doc of DOCUMENTS) {
    await resolveSeedFileName(doc.fileMatch);
  }
}

async function resolveSeedFileName(fileMatch) {
  const entries = await fs.readdir(FILE_DIR);
  const fileName = entries.find((entry) => {
    return entry.toLowerCase().endsWith('.pdf')
      && entry.toLowerCase().includes(fileMatch.toLowerCase());
  });

  if (!fileName) {
    throw new Error(`Missing seed PDF containing "${fileMatch}" in ${FILE_DIR}`);
  }

  return fileName;
}

async function getFirstActiveAdmin() {
  const { data, error } = await supabase
    .from('users')
    .select('id, email')
    .eq('role', 'admin')
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Seed requires at least one active admin user to create subjects.');
  return data;
}

async function getCreatorUser() {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, status')
    .eq('id', CREATOR_USER_ID)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Creator user not found: ${CREATOR_USER_ID}`);
  if (data.status !== 'active') throw new Error(`Creator user is not active: ${CREATOR_USER_ID}`);
  return data;
}

async function upsertSubjects(adminId) {
  const byCode = new Map();

  for (const subject of SUBJECTS) {
    const { data, error } = await supabase
      .from('subjects')
      .upsert(
        { ...subject, created_by: adminId, updated_at: new Date().toISOString() },
        { onConflict: 'code' }
      )
      .select()
      .single();

    if (error) throw error;
    byCode.set(data.code, data);
  }

  return byCode;
}

async function findExistingDocument(userId, title) {
  const { data, error } = await supabase
    .from('documents')
    .select('id, file_id')
    .eq('user_id', userId)
    .eq('title', title)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function ensureCloudFile(existingFileId, fileData) {
  if (existingFileId) {
    const { data, error } = await supabase
      .from('cloud_files')
      .update(fileData)
      .eq('id', existingFileId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('cloud_files')
    .insert(fileData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function createOrUpdateDocument({ creatorUserId, subjectId, cloudFile, doc }) {
  const title = titleFromFileName(doc.fileName);
  const existing = await findExistingDocument(creatorUserId, title);
  const payload = {
    title,
    user_id: creatorUserId,
    subject_id: subjectId,
    file_id: cloudFile.id,
    status: 'indexed',
    extracted_text: doc.text,
    extraction_status: 'ready',
    extraction_error: null,
    extracted_at: new Date().toISOString(),
    view_count: doc.viewCount,
    is_public: true,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabase
      .from('documents')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('documents')
    .insert({ ...payload, created_at: new Date().toISOString() })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updateThumbnail(documentId, status, thumbnailPath, errorMessage) {
  const { error } = await supabase
    .from('documents')
    .update({
      thumbnail_path: thumbnailPath || null,
      thumbnail_status: status,
      thumbnail_error: errorMessage || null,
      thumbnail_generated_at: status === 'ready' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId);

  if (error) throw error;
}

async function seed() {
  await requireSeedFiles();

  const [admin, creator] = await Promise.all([
    getFirstActiveAdmin(),
    getCreatorUser(),
  ]);
  const subjects = await upsertSubjects(admin.id);

  for (const doc of DOCUMENTS) {
    const fileName = await resolveSeedFileName(doc.fileMatch);
    const sourcePath = path.join(FILE_DIR, fileName);
    const buffer = await fs.readFile(sourcePath);
    const storagePath = `user-${creator.id}/seed-${safeStorageName(fileName)}`;
    await supabaseService.uploadFile(buffer, storagePath, 'application/pdf', { upsert: true });

    const title = titleFromFileName(fileName);
    const existing = await findExistingDocument(creator.id, title);
    const cloudFile = await ensureCloudFile(existing?.file_id, {
      storage_path: storagePath,
      mime_type: 'application/pdf',
      size_bytes: buffer.length,
    });

    const savedDocument = await createOrUpdateDocument({
      creatorUserId: creator.id,
      subjectId: subjects.get(doc.subjectCode).id,
      cloudFile,
      doc: { ...doc, fileName },
    });

    try {
      const thumbnailBuffer = await thumbnailService.generateThumbnailFromBuffer(buffer, 'application/pdf');
      const thumbnailPath = thumbnailService.createThumbnailStoragePath({
        userId: creator.id,
        documentId: savedDocument.id,
      });
      await supabaseService.uploadFile(thumbnailBuffer, thumbnailPath, 'image/png', { upsert: true });
      await updateThumbnail(savedDocument.id, 'ready', thumbnailPath);
    } catch (error) {
      await updateThumbnail(savedDocument.id, 'failed', null, error.message);
    }

    console.log(`Seeded ${title} for ${creator.email}`);
  }

  console.log('Demo seed completed.');
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
