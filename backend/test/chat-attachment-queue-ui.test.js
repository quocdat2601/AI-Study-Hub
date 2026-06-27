const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const queueHook = fs.readFileSync(path.join(root, 'frontend', 'src', 'hooks', 'useChatAttachmentQueue.js'), 'utf8');
const attachmentBar = fs.readFileSync(path.join(root, 'frontend', 'src', 'components', 'workspace', 'ChatAttachmentBar.jsx'), 'utf8');

test('attachment queue cancellation clears active state and pumps the next item', () => {
  assert.match(queueHook, /function pumpQueue\(\)/);
  assert.match(queueHook, /if \(!enabled \|\| clearingRef\.current \|\| activeRef\.current \|\| !sessionRef\.current\) return/);
  assert.match(queueHook, /\.finally\(\(\) => \{[\s\S]*activeRef\.current = null;[\s\S]*pumpQueue\(\);[\s\S]*\}\)/);
  assert.match(queueHook, /if \(activeRef\.current\?\.id === id\) activeRef\.current\.controller\.abort\(\)/);
  assert.match(queueHook, /setQueueItems\(\(current\) => current\.filter\(\(candidate\) => candidate\.id !== id\)\)/);
});

test('attachment queue reconciles server-completed uploads after explicit cancel', () => {
  assert.match(queueHook, /cancelledIdsRef\.current\.add\(id\)/);
  assert.match(queueHook, /const wasCancelled = cancelledIdsRef\.current\.has\(item\.id\)/);
  assert.match(queueHook, /if \(wasCancelled && processing\?\.documentId\)/);
  assert.match(queueHook, /detachChatDocument\(activeSessionId, processing\.documentId\)/);
  assert.match(queueHook, /cancelledIdsRef\.current\.delete\(item\.id\)/);
});

test('attachment drawer replaces wide horizontal cards with a compact overlay', () => {
  assert.match(attachmentBar, /Attachments/);
  assert.match(attachmentBar, /aria-modal="true"/);
  assert.match(attachmentBar, /absolute inset-0 z-40 flex justify-end/);
  assert.match(attachmentBar, /summaryText/);
  assert.doesNotMatch(attachmentBar, /workspace-scrollbar flex gap-2 overflow-x-auto/);
});

test('attachment drawer exposes compact bulk cleanup actions', () => {
  assert.match(attachmentBar, /Clear pending uploads/);
  assert.match(attachmentBar, /Remove all temporary attachments/);
  assert.match(attachmentBar, /removableTemporaryAttachments/);
  assert.match(attachmentBar, /window\.confirm/);
});

test('attachment queue supports bulk pending cleanup without starting another upload', () => {
  assert.match(queueHook, /async function clearPending\(\)/);
  assert.match(queueHook, /cancelledIdsRef\.current\.add\(item\.id\)/);
  assert.match(queueHook, /activeRef\.current\?\.controller\.abort\(\)/);
  assert.doesNotMatch(queueHook, /function clearPending\(\)[\s\S]*activeRef\.current = null/);
  assert.match(queueHook, /clearPending,/);
});

test('clear pending waits for active settlement and refreshes authoritative session payload', () => {
  assert.match(queueHook, /const activeDone = activeRef\.current\?\.done \|\| null/);
  assert.match(queueHook, /await activeDone\.catch\(\(\) => null\)/);
  assert.match(queueHook, /getChatSessionMessages\(currentSessionId\)/);
  assert.match(queueHook, /callbacksRef\.current\.onPayload\?\.\(payload, currentSessionId\)/);
  assert.match(queueHook, /clearingRef\.current = true/);
  assert.match(queueHook, /isClearingPending/);
});

test('attachment drawer exposes recoverable permanent delete actions', () => {
  assert.match(attachmentBar, /Delete permanently/);
  assert.match(attachmentBar, /Remove all recoverable files/);
  assert.match(attachmentBar, /onDeleteRecoverable/);
  assert.match(attachmentBar, /onDeleteAllRecoverable/);
});
