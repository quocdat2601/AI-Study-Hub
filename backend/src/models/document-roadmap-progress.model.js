const supabase = require('../config/supabase');

class DocumentRoadmapProgressModel {
  static async findByRoadmapAndUser(roadmapId, userId) {
    const { data, error } = await supabase
      .from('document_roadmap_progress')
      .select('step_order')
      .eq('roadmap_id', Number(roadmapId))
      .eq('user_id', userId)
      .order('step_order', { ascending: true });

    if (error) throw error;
    return (data || []).map((row) => Number(row.step_order));
  }

  // Toàn bộ tick của user kèm roadmap + document (cho widget "Tiếp tục học" ở Dashboard);
  // chỉ lấy document còn sống, tổng hợp tiến độ làm ở service
  static async findByUserWithRoadmaps(userId) {
    const { data, error } = await supabase
      .from('document_roadmap_progress')
      .select('roadmap_id, step_order, completed_at, document_roadmaps!inner(id, document_id, title, steps, status, documents!inner(id, title, deleted_at, lifecycle_status))')
      .eq('user_id', userId)
      .is('document_roadmaps.documents.deleted_at', null)
      .eq('document_roadmaps.documents.lifecycle_status', 'active');

    if (error) throw error;
    return data || [];
  }

  static async markStepComplete({ roadmapId, userId, stepOrder }) {
    const { data, error } = await supabase
      .from('document_roadmap_progress')
      .upsert({
        roadmap_id: Number(roadmapId),
        user_id: userId,
        step_order: Number(stepOrder),
      }, { onConflict: 'roadmap_id,user_id,step_order', ignoreDuplicates: true })
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async markStepIncomplete({ roadmapId, userId, stepOrder }) {
    const { data, error } = await supabase
      .from('document_roadmap_progress')
      .delete()
      .eq('roadmap_id', Number(roadmapId))
      .eq('user_id', userId)
      .eq('step_order', Number(stepOrder))
      .select('id')
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}

module.exports = DocumentRoadmapProgressModel;
