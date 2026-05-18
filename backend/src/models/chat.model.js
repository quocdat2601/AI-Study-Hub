const supabase = require('../config/supabase');

class ChatModel {
  static async findOrCreateSession(userId, docId) {
    // Check if session exists
    const { data: session, error: findError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('doc_id', docId)
      .maybeSingle();

    if (findError) throw findError;
    if (session) return session;

    // Create new session
    const { data: newSession, error: createError } = await supabase
      .from('chat_sessions')
      .insert([{ user_id: userId, doc_id: docId }])
      .select()
      .single();

    if (createError) throw createError;
    return newSession;
  }

  static async getMessages(sessionId) {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
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
}

module.exports = ChatModel;
