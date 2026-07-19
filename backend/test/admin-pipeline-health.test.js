const assert = require('node:assert/strict');
const test = require('node:test');

process.env.SUPABASE_URL ||= 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

const adminService = require('../src/services/admin.service');
const documentModel = require('../src/models/document.model');
const aiService = require('../src/services/ai.service');
const activityService = require('../src/services/activity.service');
const userModel = require('../src/models/user.model');
const supabase = require('../src/config/supabase');

test('Admin RAG Pipeline Health Dashboard Services', async (t) => {
  const mockDocs = [
    { extraction_status: 'ready' },
    { extraction_status: 'ready' },
    { extraction_status: 'failed' },
    { extraction_status: 'empty' },
  ];

  const mockChunks = [
    { embedding_status: 'ready' },
    { embedding_status: 'ready' },
    { embedding_status: 'failed' },
  ];

  const mockFailedDocs = [
    { id: 101, title: 'Failed OCR Document', user_id: 'student-1', extraction_status: 'failed', updated_at: new Date().toISOString() },
    { id: 102, title: 'Empty Scan Document', user_id: 'student-2', extraction_status: 'empty', updated_at: new Date().toISOString() },
  ];

  const mockFailedChunks = [
    {
      doc_id: 103,
      embedding_error: 'API Error 429',
      documents: { title: 'Embedding Failure Document', user_id: 'student-1', deleted_at: null }
    }
  ];

  const mockUsers = [
    { id: 'student-1', email: 'student1@test.com' },
    { id: 'student-2', email: 'student2@test.com' },
  ];

  // 1. Mock supabase database calls dynamically
  t.mock.method(supabase, 'from', (table) => {
    return {
      select: (columns) => {
        return {
          is: (field, val) => {
            if (table === 'documents') {
              if (columns === 'extraction_status') {
                return Promise.resolve({ data: mockDocs, error: null });
              }
              // failed docs query
              return {
                limit: () => Promise.resolve({ data: mockFailedDocs, error: null })
              };
            }
          },
          in: (field, array) => {
            return {
              is: (f, v) => {
                return {
                  limit: () => Promise.resolve({ data: mockFailedDocs, error: null })
                };
              }
            };
          },
          eq: (field, val) => {
            if (table === 'document_chunks') {
              return {
                limit: () => Promise.resolve({ data: mockFailedChunks, error: null })
              };
            }
          },
          then: (cb) => {
            if (table === 'document_chunks') {
              return Promise.resolve(cb({ data: mockChunks, error: null }));
            }
          }
        };
      }
    };
  });

  t.mock.method(userModel, 'findAll', async () => mockUsers);

  // Test getPipelineHealth
  const health = await adminService.getPipelineHealth();

  assert.deepEqual(health.extractionCounts, { ready: 2, failed: 1, empty: 1 });
  assert.deepEqual(health.embeddingCounts, { ready: 2, failed: 1 });
  assert.equal(health.failedDocs.length, 2);
  assert.equal(health.failedDocs[0].email, 'student1@test.com');
  assert.equal(health.failedDocs[1].email, 'student2@test.com');
  assert.equal(health.failedChunkDocs.length, 1);
  assert.equal(health.failedChunkDocs[0].email, 'student1@test.com');
  assert.equal(health.failedChunkDocs[0].title, 'Embedding Failure Document');

  // 2. Reprocess Document Tests
  const mockDoc = { id: 101, title: 'Failed OCR Document', user_id: 'student-1', deleted_at: null };
  const mockDeletedDoc = { id: 102, title: 'Deleted Document', user_id: 'student-2', deleted_at: new Date().toISOString() };

  let loggedActivity = null;
  t.mock.method(activityService, 'log', (activity) => {
    loggedActivity = activity;
  });

  let processedParams = null;
  t.mock.method(aiService, 'processDocument', async (params) => {
    processedParams = params;
    return { status: 'ready' };
  });

  // Check: Reprocessing active document succeeds and logs correctly
  t.mock.method(documentModel, 'findById', async (id) => {
    if (id === 101) return mockDoc;
    if (id === 102) return mockDeletedDoc;
    return null;
  });

  const reprocessRes = await adminService.reprocessDocument(101, 'admin-user-999');
  assert.equal(reprocessRes.status, 'ready');
  assert.deepEqual(processedParams, { id: 101, userId: 'student-1', force: true });
  assert.deepEqual(loggedActivity, {
    userId: 'admin-user-999',
    action: 'admin.document.reprocess',
    targetType: 'document',
    targetId: 101,
    metadata: { title: 'Failed OCR Document', ownerId: 'student-1' }
  });

  // Check: Reprocessing soft-deleted document fails with 404
  await assert.rejects(
    adminService.reprocessDocument(102, 'admin-user-999'),
    /Document not found/
  );
});
