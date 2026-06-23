const supabase = require('../config/supabase');

class NotificationModel {
  static async create(notificationData = {}) {
    const insertData = {
      user_id: notificationData.user_id || notificationData.userId,
      type: notificationData.type || 'share',
      message: notificationData.message,
      ref_doc_id: notificationData.ref_doc_id || notificationData.refDocId || null,
      ref_post_id: notificationData.ref_post_id || notificationData.refPostId || null,
    };
    const { data, error } = await supabase
      .from('notifications')
      .insert([insertData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

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


}

module.exports = NotificationModel;
