const supabase = require('../config/supabase');

class StudyMaterialModel {
  static async findByDocAndUser(docId, userId) {
    const { data, error } = await supabase
      .from('workspace_study_materials')
      .select('*')
      .eq('doc_id', docId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async findById({ materialId, userId }) {
    const { data, error } = await supabase
      .from('workspace_study_materials')
      .select('*')
      .eq('id', materialId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async create(material) {
    const { data, error } = await supabase
      .from('workspace_study_materials')
      .insert([material])
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteById({ materialId, userId }) {
    const { data, error } = await supabase
      .from('workspace_study_materials')
      .delete()
      .eq('id', materialId)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}

module.exports = StudyMaterialModel;
