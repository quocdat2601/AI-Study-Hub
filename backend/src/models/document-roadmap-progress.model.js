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
