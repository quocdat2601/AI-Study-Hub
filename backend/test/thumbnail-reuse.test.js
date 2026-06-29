const assert = require('node:assert/strict');
const test = require('node:test');

process.env.SUPABASE_URL ||= 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

const documentModel = require('../src/models/document.model');
const documentService = require('../src/services/document.service');
const documentThumbnailService = require('../src/services/document-thumbnail.service');
const supabaseService = require('../src/services/supabase.service');
const thumbnailService = require('../src/services/thumbnail.service');

test('documents sharing one file_id do not create duplicate thumbnail objects', async (t) => {
  const uploads = [];
  let readyThumbnail = null;
  t.mock.method(documentModel, 'findReadyThumbnailByFileId', async () => readyThumbnail);
  t.mock.method(supabaseService, 'fileExists', async () => false);
  t.mock.method(thumbnailService, 'generateThumbnailFromBuffer', async () => Buffer.from('thumbnail'));
  t.mock.method(supabaseService, 'uploadFile', async (_buffer, path) => {
    uploads.push(path);
  });
  t.mock.method(documentModel, 'updateThumbnailsByFileId', async (fileId, thumbnailData) => {
    readyThumbnail = {
      file_id: fileId,
      thumbnail_path: thumbnailData.path,
      thumbnail_status: thumbnailData.status,
      thumbnail_error: thumbnailData.error,
      thumbnail_generated_at: '2026-06-25T00:00:00.000Z',
    };
    return [];
  });

  const [first, second] = await Promise.all([
    documentThumbnailService.ensureThumbnailForDocument({
      document: { id: 10, user_id: 'user-1', file_id: 77 },
      buffer: Buffer.from('pdf'),
      mimeType: 'application/pdf',
    }),
    documentThumbnailService.ensureThumbnailForDocument({
      document: { id: 11, user_id: 'user-2', file_id: 77 },
      buffer: Buffer.from('same pdf'),
      mimeType: 'application/pdf',
    }),
  ]);

  assert.equal(first.path, 'thumbnails/files/77.png');
  assert.equal(second.path, 'thumbnails/files/77.png');
  assert.deepEqual(uploads, ['thumbnails/files/77.png']);
});

test('document list enrichment reuses a ready thumbnail from the shared file', async (t) => {
  t.mock.method(documentModel, 'findReadyThumbnailByFileId', async (fileId) => ({
    file_id: fileId,
    thumbnail_path: 'thumbnails/files/88.png',
    thumbnail_status: 'ready',
    thumbnail_error: null,
    thumbnail_generated_at: '2026-06-25T00:00:00.000Z',
  }));
  t.mock.method(supabaseService, 'getSignedUrl', async (path) => `signed:${path}`);

  const [sharedDocument, libraryDocument] = await documentService.addThumbnailUrls([
    { id: 20, file_id: 88, title: 'Shared snapshot document', document_scope: 'shared', thumbnail_path: null, thumbnail_status: 'pending' },
    { id: 21, file_id: 88, title: 'Saved from shared snapshot', document_scope: 'library', thumbnail_path: null, thumbnail_status: 'pending' },
  ]);

  assert.equal(sharedDocument.thumbnailUrl, 'signed:thumbnails/files/88.png');
  assert.equal(libraryDocument.thumbnailUrl, 'signed:thumbnails/files/88.png');
  assert.equal(sharedDocument.thumbnail_path, 'thumbnails/files/88.png');
  assert.equal(libraryDocument.thumbnail_status, 'ready');
});

test('a file-level thumbnail repairs stale shared metadata without selecting a deleted sibling', async (t) => {
  t.mock.method(documentModel, 'findReadyThumbnailByFileId', async () => null);
  t.mock.method(supabaseService, 'fileExists', async (path) => path === 'thumbnails/files/91.png');
  const propagated = [];
  t.mock.method(documentModel, 'updateThumbnailsByFileId', async (fileId, thumbnail) => { propagated.push({ fileId, thumbnail }); return []; });
  t.mock.method(supabaseService, 'getSignedUrl', async (path) => `signed:${path}`);

  const [document] = await documentService.addThumbnailUrls([{
    id: 30,
    file_id: 91,
    document_scope: 'shared',
    thumbnail_path: null,
    thumbnail_status: 'pending',
  }]);

  assert.equal(document.thumbnailUrl, 'signed:thumbnails/files/91.png');
  assert.deepEqual(propagated, [{
    fileId: 91,
    thumbnail: { path: 'thumbnails/files/91.png', status: 'ready', error: null },
  }]);
});

test('image documents fall back to signed original file preview when no thumbnail exists', async (t) => {
  t.mock.method(documentModel, 'findReadyThumbnailByFileId', async () => null);
  t.mock.method(supabaseService, 'fileExists', async () => false);
  t.mock.method(documentThumbnailService, 'isSupportedThumbnailMimeType', () => false);
  t.mock.method(supabaseService, 'getSignedUrl', async (path) => `signed:${path}`);

  const [document] = await documentService.addThumbnailUrls([{
    id: 40,
    file_id: 101,
    title: 'pasted-image.png',
    document_scope: 'session',
    thumbnail_path: null,
    thumbnail_status: 'pending',
    cloud_files: {
      mime_type: 'image/png',
      storage_path: 'chat/session-1/pasted-image.png',
    },
  }]);

  assert.equal(document.thumbnailUrl, 'signed:chat/session-1/pasted-image.png');
});
