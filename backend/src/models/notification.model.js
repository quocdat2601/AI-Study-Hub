const supabase = require('../config/supabase');

class NotificationModel {
  static async findByUserId(userId) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async markAllAsRead(userId) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  static async markAsRead(id, userId) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  static async create({ userId, type = 'share', message, refDocId = null }) {
    const { data, error } = await supabase
      .from('notifications')
      .insert([{
        user_id: userId,
        type,
        message,
        ref_doc_id: refDocId,
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = NotificationModel;
