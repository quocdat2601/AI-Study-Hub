const supabase = require('../config/supabase');

const COLUMNS = 'id, user_id, provider, masked_key, iv, auth_tag, encrypted_key, created_at, updated_at';

class UserApiKeyModel {
  /**
   * Upsert (insert or update) a user's API key for a given provider.
   * One row per user+provider.
   */
  static async upsert(userId, provider, encryptedPayload, maskedKey) {
    const { iv, tag, ciphertext } = encryptedPayload;
    const { data, error } = await supabase
      .from('user_api_keys')
      .upsert(
        {
          user_id: userId,
          provider,
          masked_key: maskedKey,
          iv: iv,
          auth_tag: tag,
          encrypted_key: ciphertext,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,provider' }
      )
      .select('id, user_id, provider, masked_key, created_at, updated_at')
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get all saved keys for a user (masked only — no raw ciphertext).
   */
  static async findByUserId(userId) {
    const { data, error } = await supabase
      .from('user_api_keys')
      .select('id, provider, masked_key, created_at, updated_at')
      .eq('user_id', userId)
      .order('provider');

    if (error) throw error;
    return data || [];
  }

  /**
   * Get the encrypted payload for a specific provider so it can be decrypted.
   */
  static async findRawByUserAndProvider(userId, provider) {
    const { data, error } = await supabase
      .from('user_api_keys')
      .select('iv, auth_tag, encrypted_key')
      .eq('user_id', userId)
      .eq('provider', provider)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return {
      iv: data.iv,
      tag: data.auth_tag,
      ciphertext: data.encrypted_key,
    };
  }

  /**
   * Delete a user's key for a provider.
   */
  static async deleteByUserAndProvider(userId, provider) {
    const { error } = await supabase
      .from('user_api_keys')
      .delete()
      .eq('user_id', userId)
      .eq('provider', provider);

    if (error) throw error;
  }
}

module.exports = UserApiKeyModel;
