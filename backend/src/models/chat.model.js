const supabase = require('../config/supabase');

const SESSION_SELECT = `
  *,
  chat_session_documents (
    doc_id,
    added_at,
    documents (
      id,
      title,
      extraction_status,
      extraction_error
    )
  )
`;

class ChatModel {
  static async listSessions(userId) {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select(SESSION_SELECT)
      .eq('user_id', userId)
      .order('last_activity_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async createSession(userId, title = 'New chat') {
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert([{ user_id: userId, title }])
      .select(SESSION_SELECT)
      .single();

    if (error) throw error;
    return data;
  }

  static async findSessionById(sessionId, userId) {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select(SESSION_SELECT)
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async updateSession(sessionId, userId, updates) {
    const { data, error } = await supabase
      .from('chat_sessions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .select(SESSION_SELECT)
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteSession(sessionId, userId) {
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  static async countSessionDocuments(sessionId) {
    const { count, error } = await supabase
      .from('chat_session_documents')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);

    if (error) throw error;
    return count || 0;
  }

  static async addDocument(sessionId, docId) {
    const { data, error } = await supabase
      .from('chat_session_documents')
      .insert([{ session_id: sessionId, doc_id: docId }])
      .select(`
        doc_id,
        added_at,
        documents (
          id,
          title,
          extraction_status,
          extraction_error
        )
      `)
      .single();

    if (error) throw error;
    return data;
  }

  static async removeDocument(sessionId, docId) {
    const { error } = await supabase
      .from('chat_session_documents')
      .delete()
      .eq('session_id', sessionId)
      .eq('doc_id', docId);

    if (error) throw error;
    return true;
  }

  static async getSessionDocuments(sessionId) {
    const { data, error } = await supabase
      .from('chat_session_documents')
      .select(`
        added_at,
        documents (
          *,
          subjects (name, code),
          cloud_files (storage_path, mime_type, size_bytes)
        )
      `)
      .eq('session_id', sessionId)
      .order('added_at', { ascending: true });

    if (error) throw error;
    return (data || []).map((row) => ({ ...row.documents, added_at: row.added_at })).filter(Boolean);
  }

  static async getMessages(sessionId, options = {}) {
    const limit = Math.min(Number(options.limit) || 50, 100);
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('id', { ascending: false })
      .limit(limit);

    if (options.before) {
      query = query.lt('id', options.before);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).reverse();
  }

  static async getRecentMessages(sessionId, limit = 20) {
    return this.getMessages(sessionId, { limit });
  }

  static async addMessage(sessionId, role, content) {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([{ session_id: sessionId, role, content }])
      .select()
      .single();

    if (error) throw error;

    await supabase
      .from('chat_sessions')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', sessionId);

    return data;
  }
}

module.exports = ChatModel;
