const supabase = require('../config/supabase');

class ChatModel {
  static async countByUserId(userId) {
    const { count, error } = await supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) throw error;
    return count || 0;
  }

  static async countUserMessages() {
    const { count, error } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'user');

    if (error) throw error;
    return count || 0;
  }

  static async findSessionById(sessionId) {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async findOwnedSession(sessionId, userId) {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async findReadableShare(sessionId, userId) {
    const { data, error } = await supabase
      .from('chat_session_shares')
      .select('session_id')
      .eq('session_id', sessionId)
      .eq('shared_to', userId)
      .is('revoked_at', null)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async findMostRecentOwnedSessionByDocument(userId, docId) {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('primary_document_id', docId)
      .is('deleted_at', null)
      .order('last_activity_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async createSession(userId, title = 'New chat', primaryDocumentId) {
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert([{
        user_id: userId,
        title,
        primary_document_id: primaryDocumentId,
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async attachDocuments(sessionId, docIds, { uploadRequestId = null } = {}) {
    if (!docIds.length) return [];

    const rows = docIds.map((docId) => ({
      session_id: sessionId,
      doc_id: docId,
      added_at: new Date().toISOString(),
      removed_at: null,
      removed_by: null,
      upload_request_id: uploadRequestId,
    }));

    const { data, error } = await supabase
      .from('chat_session_documents')
      .upsert(rows, {
        onConflict: 'session_id,doc_id',
        ignoreDuplicates: false,
      })
      .select();

    if (error) throw error;
    return data || [];
  }

  static async listSessionDocuments(sessionId) {
    const { data, error } = await supabase
      .from('chat_session_documents')
      .select(`
        added_at,
        removed_at,
        documents (
          id,
          title,
          user_id,
          subject_id,
          status,
          extraction_status,
          extracted_text,
          created_at,
          updated_at,
          deleted_at,
          is_public,
          view_count,
          thumbnail_path,
          thumbnail_status,
          thumbnail_error,
          thumbnail_generated_at,
          document_scope,
          origin_session_id,
          lifecycle_status,
          last_accessed_at,
          expires_at,
          expired_at,
          purge_after,
          purge_claimed_at,
          purge_attempts,
          last_cleanup_error,
          subjects (name, code),
          cloud_files (storage_path, mime_type, size_bytes)
        )
      `)
      .eq('session_id', sessionId)
      .is('removed_at', null)
      .order('added_at', { ascending: true });

    if (error) throw error;

    const now = Date.now();
    return (data || [])
      .map((row) => row.documents ? { ...row.documents, upload_request_id: row.upload_request_id } : null)
      .filter((document) => {
        if (!document || document.deleted_at || document.lifecycle_status !== 'active') return false;
        return !document.expires_at || new Date(document.expires_at).getTime() > now;
      });
  }

  static async countActiveSessionDocuments(sessionId) {
    const { count, error } = await supabase
      .from('chat_session_documents')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .is('removed_at', null);

    if (error) throw error;
    return count || 0;
  }

  static classifyRecoverableSessionDocuments(rows, sessionId, ownerUserId, now = Date.now()) {
    return (rows || []).flatMap((row) => {
      const document = row.documents;
      if (!document || document.deleted_at || document.lifecycle_status === 'purging') return [];

      const removed = Boolean(row.removed_at);
      if (document.document_scope === 'library') {
        if (!removed || document.lifecycle_status !== 'active') return [];
        return [{
          ...document,
          attachment_removed_at: row.removed_at,
          can_restore: true,
        }];
      }

      if (
        document.document_scope !== 'session'
        || Number(document.origin_session_id) !== Number(sessionId)
        || String(document.user_id) !== String(ownerUserId)
      ) return [];

      const expiresAt = document.expires_at
        ? new Date(document.expires_at).getTime()
        : null;
      const timeExpired = expiresAt !== null && expiresAt <= now;
      const expired = document.lifecycle_status === 'expired' || timeExpired;
      const recoveryDeadline = document.purge_after
        ? new Date(document.purge_after).getTime()
        : timeExpired
          ? expiresAt + (7 * 24 * 60 * 60 * 1000)
          : null;
      const recoveryOpen = !expired
        || (Number.isFinite(recoveryDeadline) && recoveryDeadline > now);

      if ((!removed && !expired) || !recoveryOpen) return [];
      return [{
        ...document,
        lifecycle_status: expired ? 'expired' : document.lifecycle_status,
        attachment_removed_at: row.removed_at,
        can_restore: true,
      }];
    });
  }

  static async listRecoverableSessionDocuments(sessionId, ownerUserId) {
    const { data, error } = await supabase
      .from('chat_session_documents')
      .select(`
        added_at,
        removed_at,
        upload_request_id,
        documents (
          id,
          title,
          user_id,
          file_id,
          file_id,
          subject_id,
          status,
          extraction_status,
          created_at,
          updated_at,
          deleted_at,
          is_public,
          thumbnail_path,
          thumbnail_status,
          document_scope,
          origin_session_id,
          lifecycle_status,
          last_accessed_at,
          expires_at,
          expired_at,
          purge_after,
          purge_claimed_at,
          purge_attempts,
          last_cleanup_error,
          subjects (name, code),
          cloud_files (storage_path, mime_type, size_bytes)
        )
      `)
      .eq('session_id', sessionId)
      .order('added_at', { ascending: true });
    if (error) throw error;

    return this.classifyRecoverableSessionDocuments(data, sessionId, ownerUserId);
  }

  static async findActiveSessionDocument(sessionId, docId) {
    const { data, error } = await supabase
      .from('chat_session_documents')
      .select(`
        *,
        documents!inner (
          id,
          lifecycle_status,
          deleted_at,
          expires_at
        )
      `)
      .eq('session_id', sessionId)
      .eq('doc_id', docId)
      .is('removed_at', null)
      .eq('documents.lifecycle_status', 'active')
      .is('documents.deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    if (data?.documents?.expires_at && new Date(data.documents.expires_at).getTime() <= Date.now()) {
      return null;
    }
    return data;
  }

  static async findSessionDocumentLink(sessionId, docId) {
    const { data, error } = await supabase
      .from('chat_session_documents')
      .select('*')
      .eq('session_id', sessionId)
      .eq('doc_id', docId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async listActiveSessionDocumentLinks(sessionId) {
    const { data, error } = await supabase
      .from('chat_session_documents')
      .select(`
        *,
        documents!inner (
          id,
          lifecycle_status,
          deleted_at,
          expires_at
        )
      `)
      .eq('session_id', sessionId)
      .is('removed_at', null)
      .eq('documents.lifecycle_status', 'active')
      .is('documents.deleted_at', null)
      .order('added_at', { ascending: true });

    if (error) throw error;
    const now = Date.now();
    return (data || []).filter((row) => (
      !row.documents?.expires_at || new Date(row.documents.expires_at).getTime() > now
    ));
  }

  static async softRemoveSessionDocument(sessionId, docId, removedBy) {
    const { data, error } = await supabase
      .from('chat_session_documents')
      .update({
        removed_at: new Date().toISOString(),
        removed_by: removedBy || null,
      })
      .eq('session_id', sessionId)
      .eq('doc_id', docId)
      .is('removed_at', null)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async removeTemporarySessionAttachments(sessionId, userId) {
    const { data, error } = await supabase.rpc('remove_temporary_session_attachments', {
      p_session_id: Number(sessionId),
      p_user_id: userId,
    });
    if (error) throw error;
    return (data || []).map((row) => Number(row.document_id));
  }

  static async permanentlyRemoveRecoverableSessionAttachments(sessionId, userId, documentId = null) {
    const { data, error } = await supabase.rpc('permanently_remove_recoverable_session_attachments', {
      p_session_id: Number(sessionId),
      p_user_id: userId,
      p_document_id: documentId == null ? null : Number(documentId),
    });
    if (error) throw error;
    return (data || []).map((row) => Number(row.document_id));
  }

  static async getMessages(sessionId) {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async listOwnedSessions(userId, primaryDocumentId) {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select(`
        id,
        title,
        created_at,
        updated_at,
        last_activity_at,
        primary_document_id,
        chat_session_documents (
          doc_id,
          removed_at,
          documents (
            id,
            lifecycle_status,
            deleted_at,
            expires_at
          )
        )
      `)
      .eq('user_id', userId)
      .eq('primary_document_id', primaryDocumentId)
      .is('deleted_at', null)
      .order('last_activity_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async updateOwnedSessionTitle(sessionId, userId, title) {
    const { data, error } = await supabase
      .from('chat_sessions')
      .update({
        title,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async softRemoveAllSessionDocuments(sessionId, removedBy) {
    const { data, error } = await supabase
      .from('chat_session_documents')
      .update({ removed_at: new Date().toISOString(), removed_by: removedBy || null })
      .eq('session_id', Number(sessionId))
      .is('removed_at', null)
      .select('doc_id');
    if (error) throw error;
    return data || [];
  }

  static async findSessionDocumentByUploadRequestId(sessionId, uploadRequestId) {
    if (!uploadRequestId) return null;
    const { data, error } = await supabase
      .from('chat_session_documents')
      .select('session_id, doc_id, removed_at, upload_request_id')
      .eq('session_id', Number(sessionId))
      .eq('upload_request_id', uploadRequestId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  static async updateOwnedSessionPrimaryDocument(sessionId, userId, primaryDocumentId) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('chat_sessions')
      .update({
        primary_document_id: Number(primaryDocumentId),
        updated_at: now,
        last_activity_at: now,
      })
      .eq('id', Number(sessionId))
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async countActiveSessionsByPrimaryDocument(documentId) {
    const { count, error } = await supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('primary_document_id', Number(documentId))
      .is('deleted_at', null);
    if (error) throw error;
    return count || 0;
  }

  static async softDeleteOwnedSession(sessionId, userId) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('chat_sessions')
      .update({
        deleted_at: now,
        updated_at: now,
      })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async getRecentMessages(sessionId, limit = 8) {
    const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 8);
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, session_id, role, content, metadata, created_at')
      .eq('session_id', sessionId)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(safeLimit);

    if (error) throw error;
    return (data || []).reverse();
  }

  static async addMessage(sessionId, role, content, metadata = {}) {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([{ session_id: sessionId, role, content, metadata: metadata || {} }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async touchSession(sessionId) {
    const { error } = await supabase
      .from('chat_sessions')
      .update({
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .is('deleted_at', null);

    if (error) throw error;
    return true;
  }

  static async createOrUpdateUserShare(sessionId, sharedBy, sharedTo) {
    const { data, error } = await supabase
      .from('chat_session_shares')
      .upsert([{
        session_id: sessionId,
        shared_by: sharedBy,
        shared_to: sharedTo,
        permission: 'read',
        revoked_at: null,
      }], {
        onConflict: 'session_id,shared_to',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async revokeUserShare(sessionId, sharedTo) {
    const { data, error } = await supabase
      .from('chat_session_shares')
      .update({
        revoked_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId)
      .eq('shared_to', sharedTo)
      .is('revoked_at', null)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async upsertPublicLink(sessionId, tokenHash, createdBy) {
    const { data, error } = await supabase
      .from('chat_public_links')
      .upsert([{
        session_id: sessionId,
        token_hash: tokenHash,
        created_by: createdBy,
        created_at: new Date().toISOString(),
        revoked_at: null,
      }], {
        onConflict: 'session_id',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async revokePublicLink(sessionId) {
    const { data, error } = await supabase
      .from('chat_public_links')
      .update({
        revoked_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId)
      .is('revoked_at', null)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async findActivePublicLinkByTokenHash(tokenHash) {
    const { data, error } = await supabase
      .from('chat_public_links')
      .select('session_id, revoked_at')
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}

module.exports = ChatModel;
