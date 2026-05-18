const supabase = require('../config/supabase');

class SubjectModel {
  static async findAll() {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data;
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
}

module.exports = SubjectModel;
