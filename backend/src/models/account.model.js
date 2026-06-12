const supabase = require('../config/supabase');
const userModel = require('./user.model');

const BASIC_COLUMNS = 'id, email, role, status, storage_limit_bytes, created_at, updated_at, last_login_at';
const PROFILE_COLUMNS = 'display_name, handle, major, theme, language, avatar_path';

class AccountModel {
  static async findByUserId(userId) {
    const { data, error } = await supabase
      .from('users')
      .select(`${BASIC_COLUMNS}, ${PROFILE_COLUMNS}`)
      .eq('id', userId)
      .single();

    if (error?.code === '42703') {
      return userModel.findById(userId);
    }

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async findByHandle(handle) {
    const { data, error } = await supabase
      .from('users')
      .select('id, handle')
      .eq('handle', handle)
      .maybeSingle();

    if (error?.code === '42703') return null;
    if (error) throw error;
    return data;
  }

  static async updateProfile(userId, updates) {
    const { data, error } = await supabase
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select(`${BASIC_COLUMNS}, ${PROFILE_COLUMNS}`)
      .single();

    if (error?.code === '42703') {
      const basicUpdates = {};
      if (updates.email) basicUpdates.email = updates.email;
      if (!Object.keys(basicUpdates).length) {
        const migrationError = new Error(
          'Account profile columns are missing. Run backend/db/migrations/006_account_profile.sql in Supabase.'
        );
        migrationError.code = 'ACCOUNT_MIGRATION_REQUIRED';
        throw migrationError;
      }
      return userModel.update(userId, basicUpdates);
    }

    if (error) throw error;
    return data;
  }
}

module.exports = AccountModel;
