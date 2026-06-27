const supabase = require('../config/supabase');

class ChatSnapshotModel {
  static async createSnapshot(row) {
    const { data, error } = await supabase.from('chat_snapshots').insert([row]).select().single();
    if (error) throw error;
    return data;
  }

  static async updateSnapshot(id, values) {
    const { data, error } = await supabase
      .from('chat_snapshots').update(values).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  static async findOwnedSession(sessionId, ownerId) {
    const { data, error } = await supabase
      .from('chat_sessions').select('*').eq('id', sessionId).eq('user_id', ownerId)
      .is('deleted_at', null).maybeSingle();
    if (error) throw error;
    return data;
  }

  static async listActiveSourceDocuments(sessionId) {
    const { data, error } = await supabase
      .from('chat_session_documents')
      .select(`added_at, documents!inner (*, subjects (name, code), cloud_files (*))`)
      .eq('session_id', sessionId)
      .is('removed_at', null)
      .eq('documents.lifecycle_status', 'active')
      .is('documents.deleted_at', null)
      .order('added_at', { ascending: true });
    if (error) throw error;
    const now = Date.now();
    return (data || []).map((row) => row.documents).filter((document) => (
      !document.expires_at || new Date(document.expires_at).getTime() > now
    ));
  }

  static async listMessages(sessionId, cutoffId = null) {
    let query = supabase.from('chat_messages').select('*').eq('session_id', sessionId)
      .order('created_at', { ascending: true }).order('id', { ascending: true });
    if (cutoffId) query = query.lte('id', cutoffId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  static async listChunks(documentId) {
    const { data, error } = await supabase.from('document_chunks').select('*')
      .eq('doc_id', documentId).order('chunk_index', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  static async upsertFileVersion(row) {
    const { data, error } = await supabase.from('shared_file_versions').upsert([row], {
      onConflict: 'storage_path,object_kind', ignoreDuplicates: false,
    }).select().single();
    if (error) throw error;
    return data;
  }

  static async createSnapshotDocument(row) {
    const { data, error } = await supabase.from('chat_snapshot_documents')
      .insert([row]).select().single();
    if (error) throw error;
    return data;
  }

  static async createSnapshotChunks(rows) {
    if (!rows.length) return [];
    const { data, error } = await supabase.from('chat_snapshot_document_chunks')
      .insert(rows).select();
    if (error) throw error;
    return data || [];
  }

  static async createSnapshotMessage(row) {
    const { data, error } = await supabase.from('chat_snapshot_messages')
      .insert([row]).select().single();
    if (error) throw error;
    return data;
  }

  static async createCitations(rows) {
    if (!rows.length) return [];
    const { data, error } = await supabase.from('chat_snapshot_citations').insert(rows).select();
    if (error) throw error;
    return data || [];
  }

  static async createLink(row) {
    const { data, error } = await supabase.from('chat_snapshot_links').insert([row]).select().single();
    if (error) throw error;
    return data;
  }

  static async updateOwnedLinkAccess(linkId, ownerId, isEnabled) {
    const { data, error } = await supabase
      .from('chat_snapshot_links')
      .update({
        is_enabled: Boolean(isEnabled),
        disabled_at: isEnabled ? null : new Date().toISOString(),
        disabled_reason: isEnabled ? null : 'owner_restricted',
      })
      .eq('id', linkId)
      .eq('created_by', ownerId)
      .select('*, chat_snapshots (id, title, source_session_id, status, created_at)')
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  static async findLinkByHash(tokenHash) {
    const { data, error } = await supabase.from('chat_snapshot_links')
      .select('*, chat_snapshots (*)').eq('token_hash', tokenHash).maybeSingle();
    if (error) throw error;
    return data;
  }

  static async listSnapshotDocuments(snapshotId) {
    const { data, error } = await supabase.from('chat_snapshot_documents')
      .select('*, shared_file_versions!chat_snapshot_documents_file_version_id_fkey (*), thumbnail_file_version:shared_file_versions!chat_snapshot_documents_thumbnail_file_version_id_fkey (*)')
      .eq('snapshot_id', snapshotId).order('ordinal', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  static async findSnapshotDocument(snapshotId, snapshotDocumentId) {
    const { data, error } = await supabase.from('chat_snapshot_documents')
      .select('*, shared_file_versions!chat_snapshot_documents_file_version_id_fkey (*)')
      .eq('snapshot_id', snapshotId).eq('id', snapshotDocumentId).maybeSingle();
    if (error) throw error;
    return data;
  }

  static async listSnapshotMessages(snapshotId) {
    const { data, error } = await supabase.from('chat_snapshot_messages')
      .select('*, chat_snapshot_citations (*, chat_snapshot_documents (*), chat_snapshot_document_chunks (*))')
      .eq('snapshot_id', snapshotId).order('ordinal', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  static async listSnapshotChunks(snapshotDocumentId) {
    const { data, error } = await supabase.from('chat_snapshot_document_chunks')
      .select('*').eq('snapshot_document_id', snapshotDocumentId)
      .order('chunk_index', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  static async listOwnedLinks(ownerId) {
    const { data, error } = await supabase.from('chat_snapshot_links')
      .select('*, chat_snapshots (id, title, source_session_id, status, created_at)')
      .eq('created_by', ownerId).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async findOwnedImportByLibraryDocument(documentId, userId) {
    const { data, error } = await supabase
      .from('document_provenance')
      .select('import_id, chat_snapshot_imports!inner (id, imported_by, status, fork_session_id)')
      .eq('document_id', Number(documentId))
      .eq('chat_snapshot_imports.imported_by', userId)
      .eq('chat_snapshot_imports.status', 'ready')
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  static async upsertRecipient({ snapshotId, linkId, userId }) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('shared_snapshot_recipients')
      .upsert([{
        snapshot_id: snapshotId,
        link_id: linkId,
        user_id: userId,
        first_opened_at: now,
        last_opened_at: now,
      }], { onConflict: 'snapshot_id,user_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async listReceivedLinks(userId) {
    const { data, error } = await supabase
      .from('shared_snapshot_recipients')
      .select('id, snapshot_id, link_id, first_opened_at, last_opened_at, chat_snapshot_links!inner (*, chat_snapshots (id, title, source_session_id, status, created_at))')
      .eq('user_id', userId)
      .order('last_opened_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async removeRecipient(id, userId) {
    const { data, error } = await supabase
      .from('shared_snapshot_recipients')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  static async disableOwnedLink(linkId, ownerId) {
    const { data, error } = await supabase.from('chat_snapshot_links')
      .update({ disabled_at: new Date().toISOString(), disabled_reason: 'owner_disabled' })
      .eq('id', linkId).eq('created_by', ownerId).is('disabled_at', null).select().maybeSingle();
    if (error) throw error;
    return data;
  }

  static async findImport(snapshotId, userId) {
    const { data, error } = await supabase.from('chat_snapshot_imports').select('*')
      .eq('snapshot_id', snapshotId).eq('imported_by', userId).maybeSingle();
    if (error) throw error;
    return data;
  }

  static async createImport(row) {
    const { data, error } = await supabase.from('chat_snapshot_imports').insert([row]).select().single();
    if (error) throw error;
    return data;
  }

  static async updateImport(id, values) {
    const { data, error } = await supabase.from('chat_snapshot_imports')
      .update(values).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  static async createImportDocument(row) {
    const { data, error } = await supabase.from('chat_snapshot_import_documents')
      .insert([row]).select().single();
    if (error) throw error;
    return data;
  }

  static async listImports(userId) {
    const { data, error } = await supabase.from('chat_snapshot_imports')
      .select('*, chat_snapshots (id, title, created_at), chat_sessions (id, title, primary_document_id, last_activity_at, deleted_at)')
      .eq('imported_by', userId).eq('status', 'ready').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).filter((item) => !item.chat_sessions?.deleted_at);
  }

  static async listSharedDocuments(userId) {
    const { data, error } = await supabase.from('documents')
      .select('*, cloud_files (*), chat_snapshot_documents!documents_source_snapshot_document_id_fkey (snapshot_id)')
      .eq('user_id', userId).eq('document_scope', 'shared').is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async findOwnedImportDocumentByForkDocument(forkDocumentId, userId) {
    const { data, error } = await supabase
      .from('chat_snapshot_import_documents')
      .select(`
        import_id,
        snapshot_document_id,
        chat_snapshot_documents!inner (id, is_primary),
        chat_snapshot_imports!inner (id, imported_by, status, fork_session_id)
      `)
      .eq('fork_document_id', Number(forkDocumentId))
      .eq('chat_snapshot_imports.imported_by', userId)
      .eq('chat_snapshot_imports.status', 'ready')
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async findOwnedImportDocumentBySnapshotDocument(snapshotDocumentId, userId) {
    const { data, error } = await supabase
      .from('chat_snapshot_import_documents')
      .select(`
        import_id,
        snapshot_document_id,
        fork_document_id,
        chat_snapshot_documents!inner (id, is_primary),
        chat_snapshot_imports!inner (id, imported_by, status, fork_session_id)
      `)
      .eq('snapshot_document_id', snapshotDocumentId)
      .eq('chat_snapshot_imports.imported_by', userId)
      .eq('chat_snapshot_imports.status', 'ready')
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async updateImportDocumentFork({ importId, snapshotDocumentId, forkDocumentId }) {
    const { data, error } = await supabase
      .from('chat_snapshot_import_documents')
      .update({ fork_document_id: Number(forkDocumentId) })
      .eq('import_id', importId)
      .eq('snapshot_document_id', snapshotDocumentId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}

module.exports = ChatSnapshotModel;
