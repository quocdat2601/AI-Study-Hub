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

  static async attachDocuments(sessionId, docIds) {
    if (!docIds.length) return [];

    const rows = docIds.map((docId) => ({
      session_id: sessionId,
      doc_id: docId,
      added_at: new Date().toISOString(),
      removed_at: null,
      removed_by: null,
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
      .map((row) => row.documents)
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
