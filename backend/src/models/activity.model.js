const supabase = require('../config/supabase');

class ActivityModel {
  static async create({ userId, action, targetType, targetId, metadata }) {
    const { data, error } = await supabase
      .from('activity_logs')
      .insert([{
        user_id: userId || null,
        action,
        target_type: targetType || null,
        target_id: targetId || null,
        metadata: metadata || null,
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async listLatest(limit = 20) {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(Number(limit) || 20, 100));

    if (error) throw error;
    return data || [];
  }
}

module.exports = ActivityModel;
