const supabase = require('../config/supabase');

class AnnouncementModel {
  static async create({ title, message, targetRole, createdBy }) {
    const insertData = {
      title,
      message,
      target_role: targetRole || 'all',
      created_by: createdBy || null,
    };
    const { data, error } = await supabase
      .from('announcements')
      .insert([insertData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async findAll(limit = 20) {
    const { data, error } = await supabase
      .from('announcements')
      .select('*, announcement_reads(user_id)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(row => ({
      ...row,
      read_count: row.announcement_reads?.length || 0
    }));
  }

  static async findActiveForUser({ userId, userRole }) {
    const { data, error } = await supabase
      .from('announcements')
      .select('*, announcement_reads(user_id, read_at)')
      .or(`target_role.eq.all,target_role.eq.${userRole}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => {
      const userRead = row.announcement_reads?.find(r => r.user_id === userId);
      return {
        ...row,
        read_at: userRead ? userRead.read_at : null
      };
    });
  }

  static async markRead({ announcementId, userId }) {
    const { data, error } = await supabase
      .from('announcement_reads')
      .upsert({ announcement_id: announcementId, user_id: userId, read_at: new Date().toISOString() })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async delete(id) {
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
}

module.exports = AnnouncementModel;
