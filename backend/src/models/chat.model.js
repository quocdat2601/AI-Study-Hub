const supabase = require('../config/supabase');

class ChatModel {
  static async countByUserId(userId) {
    const { count, error } = await supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

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
      .select(`
        *,
        chat_session_documents!inner (
          doc_id
        )
      `)
      .eq('user_id', userId)
      .eq('chat_session_documents.doc_id', docId)
      .order('last_activity_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async createSession(userId, title = 'New chat') {
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert([{
        user_id: userId,
        title,
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async listOwnedSessions(userId) {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('last_activity_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async attachDocuments(sessionId, docIds) {
    if (!docIds.length) return [];

    const rows = docIds.map((docId) => ({
      session_id: sessionId,
      doc_id: docId,
    }));

    const { data, error } = await supabase
      .from('chat_session_documents')
      .upsert(rows, {
        onConflict: 'session_id,doc_id',
        ignoreDuplicates: true,
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
          subjects (name, code),
          cloud_files (storage_path, mime_type, size_bytes)
        )
      `)
      .eq('session_id', sessionId)
      .order('added_at', { ascending: true });

    if (error) throw error;

    return (data || [])
      .map((row) => row.documents)
      .filter(Boolean);
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

  static async addMessage(sessionId, role, content) {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([{ session_id: sessionId, role, content }])
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
      .eq('id', sessionId);

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
