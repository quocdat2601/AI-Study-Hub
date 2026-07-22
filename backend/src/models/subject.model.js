const supabase = require('../config/supabase');

class SubjectModel {
  static async findAll() {
    const { data, error } = await supabase
      .from('subjects')
      .select('*, majors (id, code, name)')
      .order('name', { ascending: true });

    if (error) throw error;

    // Flatten majors join into major_id / major_code / major_name fields
    return (data || []).map((s) => ({
      ...s,
      major_id: s.majors?.id ?? s.major_id ?? null,
      major_code: s.majors?.code ?? null,
      major_name: s.majors?.name ?? null,
      majors: undefined,
    }));
  }

  static async listSubjects() {
    return this.findAll();
  }

  static async findByCode(code) {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('code', code)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async create(subjectData) {
    const { data, error } = await supabase
      .from('subjects')
      .insert([subjectData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateSubject(id, updates) {
    const { data, error } = await supabase
      .from('subjects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async deleteSubject(id) {
    const { data, error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async countDocuments(id) {
    const { count, error } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('subject_id', id)
      .eq('document_scope', 'library');

    if (error) throw error;
    return count || 0;
  }
}

module.exports = SubjectModel;
