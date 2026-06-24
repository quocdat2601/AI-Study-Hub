const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');

async function loadAttachmentUtils() {
  const file = path.resolve(__dirname, '..', '..', 'frontend', 'src', 'utils', 'chatAttachments.js');
  return import(pathToFileURL(file).href);
}

test('recoverable attachments stay separate and do not count toward the active limit', async () => {
  const { normalizeAttachmentPayload, getRecoverableAttachmentPresentation } = await loadAttachmentUtils();
  const payload = {
    documents: [{ id: 38 }, { id: 20 }, { id: 44 }],
    recoverableDocuments: [{
      id: 45,
      lifecycleStatus: 'expired',
      canRestore: true,
      purgeAfter: '2099-07-01T00:00:00.000Z',
    }],
  };

  const state = normalizeAttachmentPayload(payload);
  const presentation = getRecoverableAttachmentPresentation(
    state.recoverableAttachments[0],
    new Date('2026-06-24T00:00:00.000Z').getTime()
  );

  assert.deepEqual(state.activeAttachments.map((item) => item.id), [38, 20, 44]);
  assert.deepEqual(state.recoverableAttachments.map((item) => item.id), [45]);
  assert.equal(state.activeCount, 3);
  assert.equal(presentation.statusLabel, 'Expired');
  assert.equal(presentation.showRestore, true);
});

test('restored attachment moves into active files and increments the count once', async () => {
  const { normalizeAttachmentPayload } = await loadAttachmentUtils();
  const state = normalizeAttachmentPayload({
    documents: [{ id: 38 }, { id: 20 }, { id: 44 }, { id: 45 }],
    recoverableDocuments: [],
  });

  assert.deepEqual(state.activeAttachments.map((item) => item.id), [38, 20, 44, 45]);
  assert.deepEqual(state.recoverableAttachments, []);
  assert.equal(state.activeCount, 4);
});
