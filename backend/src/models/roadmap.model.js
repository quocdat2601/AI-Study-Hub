/* eslint-env node */
const supabase = require('../config/supabase');

class RoadMapModel {
  static async findByUserAndDoc({ userId, docId }) {
    const { data, error } = await supabase
      .from('document_roadmaps_user')
      .select('*')
      .eq('user_id', userId)
      .eq('doc_id', Number(docId))
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async upsert({ userId, docId, goal, roadmap }) {
    const payload = {
      user_id: userId,
      doc_id: Number(docId),
      goal: goal || null,
      roadmap: roadmap || {},
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('document_roadmaps_user')
      .upsert(payload, { onConflict: 'user_id,doc_id' })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  static async updateRoadmap({ userId, docId, roadmap }) {
    const { data, error } = await supabase
      .from('document_roadmaps_user')
      .update({
        roadmap: roadmap || {},
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('doc_id', Number(docId))
      .select('*')
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}

module.exports = RoadMapModel;

