const supabase = require('../config/supabase');

class BookmarkModel {
  static async findByUserId(userId) {
    const { data, error } = await supabase
      .from('bookmarks')
      .select(`
        *,
        documents!inner (
          id,
          title,
          subject_id,
          document_scope,
          lifecycle_status,
          deleted_at,
          subjects (name, code)
        )
      `)
      .eq('user_id', userId)
      .eq('documents.document_scope', 'library')
      .eq('documents.lifecycle_status', 'active')
      .is('documents.deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async countByUserId(userId) {
    const { count, error } = await supabase
      .from('bookmarks')
      .select('*, documents!inner(id)', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('documents.document_scope', 'library')
      .eq('documents.lifecycle_status', 'active')
      .is('documents.deleted_at', null);

    if (error) throw error;
    return count || 0;
  }

  static async create(userId, docId) {
    const { data, error } = await supabase
      .from('bookmarks')
      .insert([{ user_id: userId, doc_id: docId }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async delete(userId, docId) {
    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('user_id', userId)
      .eq('doc_id', docId);

    if (error) throw error;
    return true;
  }
}

module.exports = BookmarkModel;
