const crypto = require('crypto');
const supabase = require('../config/supabase');
const chatSnapshotModel = require('../models/chat-snapshot.model');
const chatModel = require('../models/chat.model');
const documentModel = require('../models/document.model');
const userModel = require('../models/user.model');
const chatService = require('./chat.service');
const documentThumbnailService = require('./document-thumbnail.service');
const documentService = require('./document.service');
const supabaseService = require('./supabase.service');
const activityService = require('./activity.service');
const createError = require('../utils/createError');

const LINK_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const CLEANUP_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const PUBLIC_CITATION_EXCERPT_LIMIT = 400;

function featureEnabled() {
  return String(process.env.CHAT_SNAPSHOT_SHARING_ENABLED || 'false').toLowerCase() === 'true';
}

function requireFeature({ publicAccess = false } = {}) {
  if (!featureEnabled()) {
    throw createError(publicAccess ? 404 : 503, publicAccess
      ? 'Shared chat not found'
      : 'Immutable chat sharing is not enabled');
  }
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function normalizeIdList(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(Number).filter(Number.isInteger))];
}

function sourceDocumentId(source) {
  return Number(source?.documentId ?? source?.chunkDocumentId ?? source?.docId);
}

function sourceChunkId(source) {
  const value = Number(source?.chunkId ?? source?.id);
  return Number.isInteger(value) ? value : null;
}

function citationCounts(messages) {
  const counts = new Map();
  for (const message of messages) {
    for (const source of message.metadata?.sources || []) {
      const documentId = sourceDocumentId(source);
      if (Number.isInteger(documentId)) counts.set(documentId, (counts.get(documentId) || 0) + 1);
    }
  }
  return counts;
}

function sanitizeMessageMetadata(metadata = {}) {
  const allowed = ['provider', 'model', 'mode'];
  return Object.fromEntries(allowed.filter((key) => metadata[key] !== undefined).map((key) => [key, metadata[key]]));
}

function sanitizePublicExcerpt(value, limit = PUBLIC_CITATION_EXCERPT_LIMIT) {
  const cleaned = String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= limit) return cleaned;
  return `${cleaned.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function mapDocumentPreview(document) {
  return {
    id: document.id,
    title: document.title,
    isPrimary: Boolean(document.is_primary),
    fileType: document.document_metadata?.mimeType || 'application/octet-stream',
    sizeBytes: Number(document.document_metadata?.sizeBytes || 0),
    extractionStatus: document.extraction_status,
  };
}

async function requireOwnedSession(sessionId, ownerId) {
  const session = await chatSnapshotModel.findOwnedSession(Number(sessionId), ownerId);
  if (!session) throw createError(404, 'Chat session not found');
  return session;
}

async function getShareOptions({ sessionId, ownerId }) {
  requireFeature();
  const session = await requireOwnedSession(sessionId, ownerId);
  const [documents, messages] = await Promise.all([
    chatSnapshotModel.listActiveSourceDocuments(session.id),
    chatSnapshotModel.listMessages(session.id),
  ]);
  const counts = citationCounts(messages);
  const options = documents.map((document) => {
    const isPrimary = Number(document.id) === Number(session.primary_document_id);
    const ownedOrPublic = String(document.user_id) === String(ownerId) || document.is_public;
    return {
      id: document.id,
      title: document.title,
      isPrimary,
      required: isPrimary,
      eligible: ownedOrPublic && Boolean(document.cloud_files?.content_hash),
      ineligibleReason: !ownedOrPublic
        ? 'Private documents owned by another user cannot be re-shared'
        : !document.cloud_files?.content_hash ? 'File content hash is not ready' : null,
      citationCount: counts.get(Number(document.id)) || 0,
      extractionStatus: document.extraction_status,
    };
  });
  const primary = options.find((item) => item.isPrimary);
  if (!primary?.eligible) throw createError(409, 'PRIMARY_DOCUMENT_UNAVAILABLE');
  const { links } = await listOwnedLinks(ownerId);
  return {
    session: { id: session.id, title: session.title },
    documents: options,
    links: links.filter((link) => Number(link.sourceSessionId) === Number(session.id)),
  };
}

async function copySnapshotDocument({ snapshot, document, ordinal, isPrimary }) {
  const file = document.cloud_files;
  if (!file?.content_hash) throw createError(409, `FILE_VERSION_NOT_READY:${document.id}`);
  const fileVersion = await chatSnapshotModel.upsertFileVersion({
    object_kind: 'original', source_cloud_file_id: file.id, storage_path: file.storage_path,
    content_hash: file.content_hash, mime_type: file.mime_type, size_bytes: file.size_bytes,
  });
  let thumbnailVersion = null;
  if (document.thumbnail_path && document.thumbnail_status === 'ready') {
    thumbnailVersion = await chatSnapshotModel.upsertFileVersion({
      object_kind: 'thumbnail', source_cloud_file_id: null, storage_path: document.thumbnail_path,
      content_hash: null, mime_type: 'image/png', size_bytes: 0,
    });
  }
  const snapshotDocument = await chatSnapshotModel.createSnapshotDocument({
    snapshot_id: snapshot.id,
    source_document_id: document.id,
    file_version_id: fileVersion.id,
    thumbnail_file_version_id: thumbnailVersion?.id || null,
    ordinal,
    is_primary: isPrimary,
    title: document.title,
    document_metadata: {
      mimeType: file.mime_type,
      sizeBytes: Number(file.size_bytes || 0),
      subject: document.subjects?.name || null,
      subjectCode: document.subjects?.code || null,
    },
    extracted_text: document.extracted_text || null,
    extraction_status: document.extraction_status || null,
    extraction_metadata: document.extraction_metadata || {},
  });
  const chunks = await chatSnapshotModel.listChunks(document.id);
  const copiedChunks = await chatSnapshotModel.createSnapshotChunks(chunks.map((chunk) => ({
    snapshot_document_id: snapshotDocument.id,
    source_chunk_id: chunk.id,
    chunk_index: chunk.chunk_index,
    content: chunk.content,
    token_estimate: chunk.token_estimate || 0,
    metadata: chunk.metadata || {},
    embedding: chunk.embedding,
    embedding_model: chunk.embedding_model,
    embedding_status: chunk.embedding_status || 'pending',
  })));
  return {
    snapshotDocument,
    chunksBySourceId: new Map(copiedChunks.map((chunk) => [Number(chunk.source_chunk_id), chunk])),
  };
}

async function createSnapshot({ sessionId, ownerId, includedDocumentIds, acknowledgedExcludedCitationDocumentIds }) {
  requireFeature();
  const session = await requireOwnedSession(sessionId, ownerId);
  const [activeDocuments, messages] = await Promise.all([
    chatSnapshotModel.listActiveSourceDocuments(session.id),
    chatSnapshotModel.listMessages(session.id),
  ]);
  const activeById = new Map(activeDocuments.map((document) => [Number(document.id), document]));
  const primaryId = Number(session.primary_document_id);
  if (!activeById.has(primaryId)) throw createError(409, 'PRIMARY_DOCUMENT_UNAVAILABLE');
  const requested = new Set(normalizeIdList(includedDocumentIds));
  requested.add(primaryId);
  const selected = activeDocuments.filter((document) => requested.has(Number(document.id)));
  if (selected.length !== requested.size) throw createError(409, 'ATTACHMENT_SELECTION_CHANGED');
  for (const document of selected) {
    if (String(document.user_id) !== String(ownerId) && !document.is_public) {
      throw createError(403, `Document ${document.id} cannot be re-shared`);
    }
    if (!document.cloud_files?.content_hash) throw createError(409, `FILE_VERSION_NOT_READY:${document.id}`);
  }

  const counts = citationCounts(messages);
  const excludedCitedIds = [...counts.keys()].filter((id) => activeById.has(id) && !requested.has(id));
  const acknowledged = new Set(normalizeIdList(acknowledgedExcludedCitationDocumentIds));
  if (excludedCitedIds.some((id) => !acknowledged.has(id))) {
    const error = createError(409, 'CITED_ATTACHMENTS_EXCLUDED');
    error.responseBody = {
      error: 'CITED_ATTACHMENTS_EXCLUDED',
      details: excludedCitedIds.map((id) => ({
        documentId: id, title: activeById.get(id)?.title, citationCount: counts.get(id),
      })),
    };
    throw error;
  }

  const cutoff = messages.at(-1)?.id || null;
  const snapshot = await chatSnapshotModel.createSnapshot({
    source_session_id: session.id,
    owner_id: ownerId,
    title: session.title || 'Shared chat',
    source_session_updated_at: session.updated_at,
    source_message_cutoff_id: cutoff,
  });

  try {
    const documentMap = new Map();
    const chunkMaps = new Map();
    for (let index = 0; index < selected.length; index += 1) {
      const document = selected[index];
      const copied = await copySnapshotDocument({
        snapshot, document, ordinal: index, isPrimary: Number(document.id) === primaryId,
      });
      documentMap.set(Number(document.id), copied.snapshotDocument);
      chunkMaps.set(Number(document.id), copied.chunksBySourceId);
    }

    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];
      const sources = (message.metadata?.sources || []).filter((source) => documentMap.has(sourceDocumentId(source)));
      const snapshotMessage = await chatSnapshotModel.createSnapshotMessage({
        snapshot_id: snapshot.id,
        source_message_id: message.id,
        ordinal: index,
        role: message.role,
        content: message.content,
        metadata: {
          ...sanitizeMessageMetadata(message.metadata),
          omittedCitationCount: (message.metadata?.sources || []).length - sources.length,
        },
        original_created_at: message.created_at,
      });
      await chatSnapshotModel.createCitations(sources.map((source) => {
        const docId = sourceDocumentId(source);
        const snapshotDocument = documentMap.get(docId);
        const snapshotChunk = chunkMaps.get(docId)?.get(sourceChunkId(source));
        return {
          snapshot_message_id: snapshotMessage.id,
          snapshot_document_id: snapshotDocument.id,
          snapshot_chunk_id: snapshotChunk?.id || null,
          page_start: source.pageStart ?? source.pageNumber ?? null,
          page_end: source.pageEnd ?? source.pageNumber ?? null,
          score: source.score ?? null,
          retrieval_type: source.metadata?.retrieval || null,
          excerpt: source.content || snapshotChunk?.content || null,
        };
      }));
    }

    const rawToken = createToken();
    const expiresAt = new Date(Date.now() + LINK_LIFETIME_MS).toISOString();
    const link = await chatSnapshotModel.createLink({
      snapshot_id: snapshot.id,
      token_hash: tokenHash(rawToken),
      token_value: rawToken,
      created_by: ownerId,
      expires_at: expiresAt,
    });
    await chatSnapshotModel.updateSnapshot(snapshot.id, {
      status: 'ready', ready_at: new Date().toISOString(), failure_error: null,
    });
    activityService.log({ userId: ownerId, action: 'chat.snapshot.create', targetType: 'chat_snapshot', metadata: { snapshotId: snapshot.id } });
    return {
      snapshotId: snapshot.id,
      linkId: link.id,
      token: rawToken,
      path: `/shared/chat/${rawToken}`,
      expiresAt,
      warnings: excludedCitedIds.map((id) => ({ documentId: id, citationCount: counts.get(id) })),
    };
  } catch (error) {
    await chatSnapshotModel.updateSnapshot(snapshot.id, {
      status: 'failed',
      failure_error: String(error.message || error).slice(0, 2000),
      cleanup_eligible_at: new Date(Date.now() + CLEANUP_GRACE_MS).toISOString(),
    }).catch(() => null);
    throw error;
  }
}

function assertActiveLink(link, { publicAccess = false } = {}) {
  if (!link || link.chat_snapshots?.status !== 'ready') {
    throw createError(404, publicAccess ? 'Shared chat not found' : 'Shared chat is unavailable');
  }
  if (link.is_enabled === false || link.disabled_at || new Date(link.expires_at).getTime() <= Date.now()) {
    throw createError(410, 'SHARE_UNAVAILABLE');
  }
}

function mapCitation(citation) {
  const document = citation.chat_snapshot_documents;
  const chunk = citation.chat_snapshot_document_chunks;
  const excerpt = sanitizePublicExcerpt(citation.excerpt || chunk?.content || '');
  return {
    documentId: document?.id || citation.snapshot_document_id,
    documentTitle: document?.title || 'Document',
    chunkId: chunk?.id || citation.snapshot_chunk_id,
    chunkIndex: chunk?.chunk_index ?? null,
    pageStart: citation.page_start,
    pageEnd: citation.page_end,
    score: citation.score,
    excerpt,
  };
}

async function getPublicPreview(token) {
  requireFeature({ publicAccess: true });
  const link = await chatSnapshotModel.findLinkByHash(tokenHash(String(token || '')));
  assertActiveLink(link, { publicAccess: true });
  const [documents, messages] = await Promise.all([
    chatSnapshotModel.listSnapshotDocuments(link.snapshot_id),
    chatSnapshotModel.listSnapshotMessages(link.snapshot_id),
  ]);
  return {
    snapshot: {
      id: link.snapshot_id,
      title: link.chat_snapshots.title,
      createdAt: link.chat_snapshots.created_at,
      expiresAt: link.expires_at,
    },
    documents: documents.map(mapDocumentPreview),
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      metadata: {
        ...sanitizeMessageMetadata(message.metadata),
        omittedCitationCount: Number(message.metadata?.omittedCitationCount || 0),
      },
      createdAt: message.original_created_at,
      sources: (message.chat_snapshot_citations || []).map(mapCitation),
    })),
    capabilities: { preview: true, importRequiresAuth: true, downloadRequiresAuth: true },
  };
}

async function buildLinkSummary(link, recipient = null) {
  const snapshot = link.chat_snapshots;
  const [documents, messages, sourceSession] = await Promise.all([
    chatSnapshotModel.listSnapshotDocuments(link.snapshot_id),
    chatSnapshotModel.listSnapshotMessages(link.snapshot_id),
    snapshot?.source_session_id ? chatModel.findSessionById(snapshot.source_session_id) : Promise.resolve(null),
  ]);
  const expired = new Date(link.expires_at).getTime() <= Date.now();
  const enabled = link.is_enabled !== false && !link.disabled_at;
  return {
    id: link.id,
    snapshotId: link.snapshot_id,
    sourceSessionId: snapshot?.source_session_id || null,
    title: snapshot?.title || 'Shared chat',
    sourceSessionTitle: sourceSession?.title || 'Source chat',
    createdAt: link.created_at,
    expiresAt: link.expires_at,
    status: expired ? 'Expired' : enabled ? 'Shared' : 'Restricted',
    isEnabled: enabled,
    documentCount: documents.length,
    messageCount: messages.length,
    shareUrl: link.token_value ? `/shared/chat/${link.token_value}` : null,
    ...(recipient ? {
      recipientId: recipient.id,
      firstOpenedAt: recipient.first_opened_at,
      lastOpenedAt: recipient.last_opened_at,
    } : {}),
  };
}

async function registerRecipientOpen({ token, userId }) {
  requireFeature();
  const link = await chatSnapshotModel.findLinkByHash(tokenHash(String(token || '')));
  assertActiveLink(link);
  if (String(link.created_by) === String(userId)) return { recorded: false };
  const recipient = await chatSnapshotModel.upsertRecipient({
    snapshotId: link.snapshot_id,
    linkId: link.id,
    userId,
  });
  return { recorded: true, link: await buildLinkSummary(link, recipient) };
}

async function listOwnedLinks(ownerId) {
  requireFeature();
  const links = await chatSnapshotModel.listOwnedLinks(ownerId);
  return { links: await Promise.all(links.map((link) => buildLinkSummary(link))) };
}

async function listReceivedLinks(userId) {
  requireFeature();
  const rows = await chatSnapshotModel.listReceivedLinks(userId);
  return {
    links: await Promise.all(rows.map((row) => buildLinkSummary(row.chat_snapshot_links, row))),
  };
}

async function removeReceivedLink({ recipientId, userId }) {
  requireFeature();
  const removed = await chatSnapshotModel.removeRecipient(recipientId, userId);
  if (!removed) throw createError(404, 'Received link not found');
  return { message: 'Removed from Shared with me' };
}

async function disableLink({ linkId, ownerId }) {
  requireFeature();
  const link = await chatSnapshotModel.updateOwnedLinkAccess(linkId, ownerId, false);
  if (!link) throw createError(404, 'Shared link not found');
  return { message: 'Shared link restricted', isEnabled: false };
}

async function updateLinkAccess({ linkId, ownerId, access }) {
  requireFeature();
  if (!['shared', 'restricted'].includes(access)) {
    throw createError(400, 'Access must be shared or restricted');
  }
  const link = await chatSnapshotModel.updateOwnedLinkAccess(linkId, ownerId, access === 'shared');
  if (!link) throw createError(404, 'Shared link not found');
  return {
    id: link.id,
    snapshotId: link.snapshot_id,
    isEnabled: link.is_enabled,
    status: link.is_enabled ? 'Shared' : 'Restricted',
    expiresAt: link.expires_at,
    shareUrl: link.token_value ? `/shared/chat/${link.token_value}` : null,
  };
}

async function importSnapshot({ token, userId }) {
  requireFeature();
  const link = await chatSnapshotModel.findLinkByHash(tokenHash(String(token || '')));
  assertActiveLink(link);
  const existing = await chatSnapshotModel.findImport(link.snapshot_id, userId);
  if (existing?.status === 'ready' && existing.fork_session_id) {
    return {
      ...(await chatService.getMessages({ sessionId: existing.fork_session_id, userId })),
      created: false,
    };
  }
  if (existing?.status === 'creating') throw createError(409, 'Import is already in progress');
  const snapshotDocuments = await chatSnapshotModel.listSnapshotDocuments(link.snapshot_id);
  const snapshotMessages = await chatSnapshotModel.listSnapshotMessages(link.snapshot_id);
  const importRow = existing || await chatSnapshotModel.createImport({
    snapshot_id: link.snapshot_id, imported_by: userId, status: 'creating',
  });
  const createdDocumentIds = [];
  let forkSession = null;
  try {
    const documentMap = new Map();
    const chunkMap = new Map();
    for (const snapshotDocument of snapshotDocuments) {
      const file = snapshotDocument.shared_file_versions;
      const thumbnailVersion = snapshotDocument.thumbnail_file_version;
      const cloudFile = await documentModel.createCloudFile({
        storage_path: file.storage_path,
        mime_type: file.mime_type,
        size_bytes: file.size_bytes,
        content_hash: file.content_hash,
      });
      const document = await documentModel.create({
        title: snapshotDocument.title,
        user_id: userId,
        subject_id: null,
        file_id: cloudFile.id,
        status: snapshotDocument.extraction_status === 'ready' ? 'indexed' : 'uploaded',
        extraction_status: snapshotDocument.extraction_status || 'empty',
        extracted_text: snapshotDocument.extracted_text,
        extraction_metadata: snapshotDocument.extraction_metadata || {},
        thumbnail_path: thumbnailVersion?.storage_path || null,
        thumbnail_status: thumbnailVersion?.storage_path ? 'ready' : 'pending',
        is_public: false,
        document_scope: 'shared',
        origin_session_id: null,
        lifecycle_status: 'active',
        source_snapshot_document_id: snapshotDocument.id,
      });
      createdDocumentIds.push(document.id);
      documentMap.set(snapshotDocument.id, document);
      const chunks = await chatSnapshotModel.listSnapshotChunks(snapshotDocument.id);
      if (chunks.length) {
        const { data, error } = await supabase.from('document_chunks').insert(chunks.map((chunk) => ({
          doc_id: document.id,
          chunk_index: chunk.chunk_index,
          content: chunk.content,
          token_estimate: chunk.token_estimate,
          metadata: chunk.metadata,
          embedding: chunk.embedding,
          embedding_model: chunk.embedding_model,
          embedding_status: chunk.embedding_status,
        }))).select();
        if (error) throw error;
        (data || []).forEach((forkChunk) => {
          const source = chunks.find((chunk) => chunk.chunk_index === forkChunk.chunk_index);
          if (source) chunkMap.set(String(source.id), forkChunk);
        });
      }
    }
    const primarySnapshotDocument = snapshotDocuments.find((document) => document.is_primary);
    const primaryDocument = documentMap.get(primarySnapshotDocument?.id);
    if (!primaryDocument) throw new Error('Snapshot primary document is missing');
    forkSession = await chatModel.createSession(userId, link.chat_snapshots.title, primaryDocument.id);
    await chatModel.attachDocuments(forkSession.id, [...documentMap.values()].map((document) => document.id));
    for (const snapshotDocument of snapshotDocuments) {
      await chatSnapshotModel.createImportDocument({
        import_id: importRow.id,
        snapshot_document_id: snapshotDocument.id,
        fork_document_id: documentMap.get(snapshotDocument.id).id,
      });
    }
    for (const message of snapshotMessages) {
      const sources = (message.chat_snapshot_citations || []).map((citation) => {
        const forkDocument = documentMap.get(citation.snapshot_document_id);
        const forkChunk = chunkMap.get(String(citation.snapshot_chunk_id));
        return {
          documentId: forkDocument?.id,
          chunkDocumentId: forkDocument?.id,
          documentTitle: forkDocument?.title,
          chunkId: forkChunk?.id || null,
          chunkIndex: forkChunk?.chunk_index ?? citation.chat_snapshot_document_chunks?.chunk_index ?? null,
          pageStart: citation.page_start,
          pageEnd: citation.page_end,
          score: citation.score,
          content: citation.excerpt,
        };
      }).filter((source) => source.documentId);
      await chatModel.addMessage(forkSession.id, message.role, message.content, {
        ...(message.metadata || {}), sources,
      });
    }
    await chatSnapshotModel.updateImport(importRow.id, {
      status: 'ready', fork_session_id: forkSession.id, ready_at: new Date().toISOString(), error: null,
    });
    activityService.log({ userId, action: 'chat.snapshot.import', targetType: 'chat_snapshot', metadata: { snapshotId: link.snapshot_id, sessionId: forkSession.id } });
    return {
      ...(await chatService.getMessages({ sessionId: forkSession.id, userId })),
      created: true,
    };
  } catch (error) {
    await chatSnapshotModel.updateImport(importRow.id, { status: 'failed', error: String(error.message || error).slice(0, 2000) }).catch(() => null);
    if (forkSession) await chatModel.softDeleteOwnedSession(forkSession.id, userId).catch(() => null);
    if (createdDocumentIds.length) await supabase.from('documents').delete().in('id', createdDocumentIds).catch(() => null);
    throw error;
  }
}

async function getSnapshotDocumentDownload({ token, snapshotDocumentId }) {
  requireFeature();
  const link = await chatSnapshotModel.findLinkByHash(tokenHash(String(token || '')));
  assertActiveLink(link);
  const document = await chatSnapshotModel.findSnapshotDocument(link.snapshot_id, snapshotDocumentId);
  if (!document?.shared_file_versions?.storage_path) throw createError(404, 'Snapshot document not found');
  return { signedUrl: await supabaseService.getSignedUrl(document.shared_file_versions.storage_path) };
}

async function listSharedChats(userId) {
  requireFeature();
  const imports = await chatSnapshotModel.listImports(userId);
  const sharedChats = await Promise.all(imports.map(async (item) => {
    const session = item.chat_sessions;
    if (!session) return item;
    const [documents, messages] = await Promise.all([
      chatModel.listSessionDocuments(session.id),
      chatModel.getMessages(session.id),
    ]);
    const primaryDocument = documents.find((document) => (
      Number(document.id) === Number(session.primary_document_id)
    ));
    return {
      ...item,
      chat_sessions: {
        ...session,
        primary_document_title: primaryDocument?.title || 'Document',
        attachment_count: documents.length,
        message_count: messages.length,
      },
    };
  }));
  return { sharedChats };
}

async function listSharedDocuments(userId) {
  requireFeature();
  const sharedDocuments = await chatSnapshotModel.listSharedDocuments(userId);
  const documentsWithThumbnails = await documentService.addThumbnailUrls(sharedDocuments);
  const documents = await Promise.all(documentsWithThumbnails.map(async (document) => {
    const { data: provenance, error } = await supabase
      .from('document_provenance')
      .select('document_id, documents!inner (id, user_id, document_scope, lifecycle_status, deleted_at)')
      .eq('snapshot_document_id', document.source_snapshot_document_id)
      .eq('documents.user_id', userId)
      .maybeSingle();
    if (error) throw error;
    const saved = provenance?.documents;
    return {
      ...documentService.mapDocument(document),
      savedDocumentId: saved
        && String(saved.user_id) === String(userId)
        && saved.document_scope === 'library'
        && saved.lifecycle_status === 'active'
        && !saved.deleted_at
        ? saved.id
        : null,
    };
  }));
  return { documents };
}

async function requireOwnedSharedDocument(documentId, userId) {
  const { data, error } = await supabase.from('documents').select('*, cloud_files (*)')
    .eq('id', Number(documentId)).eq('user_id', userId).eq('document_scope', 'shared')
    .is('deleted_at', null).maybeSingle();
  if (error) throw error;
  if (!data) throw createError(404, 'Shared document not found');
  return data;
}

async function getReusableThumbnailData(source) {
  if (source.thumbnail_path && source.thumbnail_status === 'ready') {
    return {
      thumbnail_path: source.thumbnail_path,
      thumbnail_status: source.thumbnail_status,
      thumbnail_error: source.thumbnail_error || null,
      thumbnail_generated_at: source.thumbnail_generated_at || null,
    };
  }

  const fileThumbnail = await documentModel.findReadyThumbnailByFileId(source.file_id);
  if (fileThumbnail?.thumbnail_path) {
    return {
      thumbnail_path: fileThumbnail.thumbnail_path,
      thumbnail_status: fileThumbnail.thumbnail_status,
      thumbnail_error: fileThumbnail.thumbnail_error || null,
      thumbnail_generated_at: fileThumbnail.thumbnail_generated_at || null,
    };
  }

  return {
    thumbnail_path: null,
    thumbnail_status: 'pending',
    thumbnail_error: null,
    thumbnail_generated_at: null,
  };
}

async function ensureFileThumbnailGenerated(source, document) {
  const existing = await documentModel.findReadyThumbnailByFileId(source.file_id);
  if (existing?.thumbnail_path) return existing;
  if (!documentThumbnailService.isSupportedThumbnailMimeType(source.cloud_files?.mime_type)) {
    return null;
  }

  const buffer = await supabaseService.downloadFile(source.cloud_files.storage_path);
  return documentThumbnailService.ensureThumbnailForDocument({
    document: {
      ...document,
      file_id: source.file_id,
      user_id: document.user_id,
    },
    buffer,
    mimeType: source.cloud_files.mime_type,
  });
}

async function getSharedDocumentDownload({ documentId, userId }) {
  requireFeature();
  const document = await requireOwnedSharedDocument(documentId, userId);
  return { signedUrl: await supabaseService.getSignedUrl(document.cloud_files.storage_path) };
}

async function promoteImportedPrimaryDocument({ source, document, userId }) {
  const importDocument = source.source_snapshot_document_id
    ? await chatSnapshotModel.findOwnedImportDocumentBySnapshotDocument(source.source_snapshot_document_id, userId)
    : await chatSnapshotModel.findOwnedImportDocumentByForkDocument(source.id, userId);
  if (!importDocument?.chat_snapshot_documents?.is_primary) {
    return { sessionUpdated: false, sessionId: null };
  }

  const importRow = importDocument.chat_snapshot_imports;
  const sessionId = Number(importRow?.fork_session_id);
  const session = await chatModel.findOwnedSession(sessionId, userId);
  if (!session) throw createError(404, 'Imported chat session not found');

  if (Number(session.primary_document_id) === Number(document.id)) {
    return { sessionUpdated: true, sessionId: session.id };
  }
  if (Number(session.primary_document_id) !== Number(source.id)) {
    throw createError(409, 'Imported chat session primary document changed');
  }

  // Swap the active attachment before adding the library copy so a session already
  // at its attachment limit can still promote its primary document.
  await chatModel.softRemoveSessionDocument(session.id, source.id, userId);
  let promoted;
  try {
    await chatModel.attachDocuments(session.id, [document.id]);
    promoted = await chatModel.updateOwnedSessionPrimaryDocument(session.id, userId, document.id);
    if (!promoted) throw createError(404, 'Imported chat session not found');
  } catch (error) {
    await chatModel.softRemoveSessionDocument(session.id, document.id, userId).catch(() => null);
    await chatModel.attachDocuments(session.id, [source.id]).catch(() => null);
    throw error;
  }
  await chatSnapshotModel.updateImportDocumentFork({
    importId: importDocument.import_id,
    snapshotDocumentId: importDocument.snapshot_document_id,
    forkDocumentId: document.id,
  });
  return { sessionUpdated: true, sessionId: session.id };
}

async function restoreExistingLibraryDocument(existingDocument, userId) {
  if (
    !existingDocument
    || String(existingDocument.user_id) !== String(userId)
    || existingDocument.document_scope !== 'library'
  ) return null;

  if (!existingDocument.deleted_at) return { document: existingDocument, restored: false };
  const restored = await documentModel.restore(existingDocument.id);
  return { document: restored, restored: true };
}

async function saveSharedDocumentToLibrary({ documentId, userId }) {
  requireFeature();
  const source = await requireOwnedSharedDocument(documentId, userId);
  const { data: existing } = await supabase.from('document_provenance')
    .select('document_id, documents!inner (*)')
    .eq('snapshot_document_id', source.source_snapshot_document_id)
    .eq('documents.user_id', userId)
    .maybeSingle();
  const reusableExisting = await restoreExistingLibraryDocument(existing?.documents, userId);
  if (reusableExisting) {
    if (reusableExisting.document.thumbnail_status !== 'ready') {
      await ensureFileThumbnailGenerated(source, reusableExisting.document).catch((error) => {
        console.error(`Shared document thumbnail generation failed for file ${source.file_id}:`, error.message);
        return null;
      });
    }
    const [document] = await documentService.addThumbnailUrls([reusableExisting.document]);
    const promotion = await promoteImportedPrimaryDocument({ source, document, userId });
    return {
      document: documentService.mapDocument(document),
      reused: true,
      restored: reusableExisting.restored,
      ...promotion,
    };
  }
  const user = await userModel.findById(userId);
  const usedBytes = await documentModel.sumStorageByUserId(userId);
  if (usedBytes + Number(source.cloud_files.size_bytes || 0) > Number(user.storage_limit_bytes || 0)) {
    throw createError(400, 'Storage limit exceeded');
  }
  const thumbnailData = await getReusableThumbnailData(source);
  const document = await documentModel.create({
    title: source.title,
    user_id: userId,
    subject_id: null,
    file_id: source.file_id,
    status: source.status,
    extraction_status: source.extraction_status,
    extracted_text: source.extracted_text,
    extraction_metadata: source.extraction_metadata || {},
    thumbnail_path: thumbnailData.thumbnail_path,
    thumbnail_status: thumbnailData.thumbnail_status,
    thumbnail_error: thumbnailData.thumbnail_error,
    thumbnail_generated_at: thumbnailData.thumbnail_generated_at,
    is_public: false,
    document_scope: 'library',
    origin_session_id: null,
    lifecycle_status: 'active',
  });
  if (thumbnailData.thumbnail_status !== 'ready') {
    await ensureFileThumbnailGenerated(source, document).catch((error) => {
      console.error(`Shared document thumbnail generation failed for file ${source.file_id}:`, error.message);
      return null;
    });
  }
  await supabase.rpc('copy_document_chunks', { p_source_doc_id: source.id, p_target_doc_id: document.id });
  const { data: importMap } = await supabase.from('chat_snapshot_import_documents')
    .select('import_id').eq('fork_document_id', source.id).maybeSingle();
  const { error } = await supabase.from('document_provenance').insert([{
    document_id: document.id,
    source_type: 'shared_snapshot',
    snapshot_document_id: source.source_snapshot_document_id,
    import_id: importMap?.import_id || null,
  }]);
  if (error) throw error;
  const [documentWithThumbnail] = await documentService.addThumbnailUrls([document]);
  const promotion = await promoteImportedPrimaryDocument({
    source,
    document: documentWithThumbnail,
    userId,
  });
  return {
    document: documentService.mapDocument(documentWithThumbnail),
    reused: false,
    ...promotion,
  };
}

async function markCleanupEligibility() {
  const now = new Date();
  const { data: snapshots, error } = await supabase.from('chat_snapshots')
    .select('id, status, cleanup_eligible_at, chat_snapshot_links (expires_at, disabled_at), chat_snapshot_imports (status)')
    .in('status', ['ready', 'failed']);
  if (error) throw error;
  let marked = 0;
  for (const snapshot of snapshots || []) {
    if (snapshot.chat_snapshot_imports?.some((item) => item.status === 'ready')) continue;
    const links = snapshot.chat_snapshot_links || [];
    const allInactive = !links.length || links.every((link) => link.disabled_at || new Date(link.expires_at) <= now);
    if (!allInactive || snapshot.cleanup_eligible_at) continue;
    const latestInactiveAt = links.reduce((latest, link) => {
      const value = new Date(link.disabled_at || link.expires_at).getTime();
      return Math.max(latest, value);
    }, now.getTime());
    await chatSnapshotModel.updateSnapshot(snapshot.id, {
      cleanup_eligible_at: new Date(latestInactiveAt + CLEANUP_GRACE_MS).toISOString(),
    });
    marked += 1;
  }
  return marked;
}

module.exports = {
  featureEnabled,
  getShareOptions,
  createSnapshot,
  getPublicPreview,
  registerRecipientOpen,
  listOwnedLinks,
  listReceivedLinks,
  removeReceivedLink,
  disableLink,
  updateLinkAccess,
  importSnapshot,
  getSnapshotDocumentDownload,
  listSharedChats,
  listSharedDocuments,
  getSharedDocumentDownload,
  saveSharedDocumentToLibrary,
  promoteImportedPrimaryDocument,
  restoreExistingLibraryDocument,
  markCleanupEligibility,
};
