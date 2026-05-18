const supabase = require('../config/supabase');

class BookmarkModel {
  static async findByUserId(userId) {
    const { data, error } = await supabase
      .from('bookmarks')
      .select(`
        *,
        documents (
          id,
          title,
          subject_id,
          subjects (name, code)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
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
