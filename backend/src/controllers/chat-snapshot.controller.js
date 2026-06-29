const snapshotService = require('../services/chat-snapshot.service');

async function getShareOptions(req, res, next) {
  try {
    res.json(await snapshotService.getShareOptions({ sessionId: req.params.sessionId, ownerId: req.user.id }));
  } catch (error) { next(error); }
}

async function createSnapshot(req, res, next) {
  try {
    res.status(201).json(await snapshotService.createSnapshot({
      sessionId: req.params.sessionId,
      ownerId: req.user.id,
      includedDocumentIds: req.body?.includedDocumentIds,
      acknowledgedExcludedCitationDocumentIds: req.body?.acknowledgedExcludedCitationDocumentIds,
    }));
  } catch (error) { next(error); }
}

async function listOwnedLinks(req, res, next) {
  try { res.json(await snapshotService.listOwnedLinks(req.user.id)); } catch (error) { next(error); }
}

async function disableLink(req, res, next) {
  try {
    res.json(await snapshotService.disableLink({ linkId: req.params.linkId, ownerId: req.user.id }));
  } catch (error) { next(error); }
}

async function updateLinkAccess(req, res, next) {
  try {
    res.json(await snapshotService.updateLinkAccess({
      linkId: req.params.linkId,
      ownerId: req.user.id,
      access: req.body?.access,
    }));
  } catch (error) { next(error); }
}

async function registerRecipientOpen(req, res, next) {
  try { res.json(await snapshotService.registerRecipientOpen({ token: req.params.token, userId: req.user.id })); } catch (error) { next(error); }
}

async function listReceivedLinks(req, res, next) {
  try { res.json(await snapshotService.listReceivedLinks(req.user.id)); } catch (error) { next(error); }
}

async function removeReceivedLink(req, res, next) {
  try { res.json(await snapshotService.removeReceivedLink({ recipientId: req.params.recipientId, userId: req.user.id })); } catch (error) { next(error); }
}

async function importSnapshot(req, res, next) {
  try {
    const result = await snapshotService.importSnapshot({ token: req.params.token, userId: req.user.id });
    res.status(result.created ? 201 : 200).json(result);
  } catch (error) { next(error); }
}

async function downloadSnapshotDocument(req, res, next) {
  try {
    res.json(await snapshotService.getSnapshotDocumentDownload({
      token: req.params.token,
      snapshotDocumentId: req.params.snapshotDocumentId,
      userId: req.user.id,
    }));
  } catch (error) { next(error); }
}

async function listSharedChats(req, res, next) {
  try { res.json(await snapshotService.listSharedChats(req.user.id)); } catch (error) { next(error); }
}

async function listSharedDocuments(req, res, next) {
  try { res.json(await snapshotService.listSharedDocuments(req.user.id)); } catch (error) { next(error); }
}

async function downloadSharedDocument(req, res, next) {
  try {
    res.json(await snapshotService.getSharedDocumentDownload({ documentId: req.params.documentId, userId: req.user.id }));
  } catch (error) { next(error); }
}

async function saveSharedDocument(req, res, next) {
  try {
    const result = await snapshotService.saveSharedDocumentToLibrary({
      documentId: req.params.documentId, userId: req.user.id,
    });
    res.status(result.reused ? 200 : 201).json(result);
  } catch (error) { next(error); }
}

module.exports = {
  getShareOptions,
  createSnapshot,
  listOwnedLinks,
  disableLink,
  updateLinkAccess,
  registerRecipientOpen,
  listReceivedLinks,
  removeReceivedLink,
  importSnapshot,
  downloadSnapshotDocument,
  listSharedChats,
  listSharedDocuments,
  downloadSharedDocument,
  saveSharedDocument,
};
