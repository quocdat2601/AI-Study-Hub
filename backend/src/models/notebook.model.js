const supabase = require('../config/supabase');

class NotebookModel {
  static async findByDocAndUser(docId, userId) {
    const { data, error } = await supabase
      .from('document_notes')
      .select('*')
      .eq('doc_id', docId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async create(note) {
    const { data, error } = await supabase
      .from('document_notes')
      .insert([note])
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  static async findById({ noteId, userId, docId }) {
    const { data, error } = await supabase
      .from('document_notes')
      .select('*')
      .eq('id', noteId)
      .eq('user_id', userId)
      .eq('doc_id', docId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async updateById({ noteId, userId, docId, updates }) {
    const { data, error } = await supabase
      .from('document_notes')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId)
      .eq('user_id', userId)
      .eq('doc_id', docId)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async deleteById({ noteId, userId, docId }) {
    const { data, error } = await supabase
      .from('document_notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', userId)
      .eq('doc_id', docId)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}

module.exports = NotebookModel;
