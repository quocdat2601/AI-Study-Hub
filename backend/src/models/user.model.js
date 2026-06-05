const supabase = require('../config/supabase');

const USER_COLUMNS = 'id, email, role, status, storage_limit_bytes, created_at, last_login_at';

class UserModel {
  static async findAll() {
    const { data, error } = await supabase
      .from('users')
      .select(USER_COLUMNS)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async findByEmail(email) {
    const { data, error } = await supabase
      .from('users')
      .select(USER_COLUMNS)
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async findById(id) {
    const { data, error } = await supabase
      .from('users')
      .select(USER_COLUMNS)
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async create(userData) {
    const { data, error } = await supabase
      .from('users')
      .insert([userData])
      .select(USER_COLUMNS)
      .single();

    if (error) throw error;
    return data;
  }

  static async update(id, updates) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select(USER_COLUMNS)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async updateStatus(id, status) {
    return this.update(id, { status, updated_at: new Date().toISOString() });
  }

  static async countAll() {
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return count || 0;
  }

  static async findCreatedSince(date) {
    const { data, error } = await supabase
      .from('users')
      .select('id, created_at')
      .gte('created_at', date.toISOString());

    if (error) throw error;
    return data || [];
  }
}

module.exports = UserModel;
