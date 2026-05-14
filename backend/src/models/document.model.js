const supabase = require('../config/supabase');

class DocumentModel {
  static async findByUserId(userId) {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        subjects (name, code),
        cloud_files (storage_path, size_bytes)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async findById(id) {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        subjects (name, code),
        cloud_files (storage_path, size_bytes)
      `)
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async create(docData) {
    const { data, error } = await supabase
      .from('documents')
      .insert([docData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = DocumentModel;
