const supabase = require('../config/supabase');


function isMissingRelation(err) {
  return err && (err.code === '42P01' || err.code === 'PGRST205' || err.code === 'PGRST204');
}

class PreferenceModel {
  static async getMajors() {
    const { data, error } = await supabase
      .from('majors')
      .select('id, name, code')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async getSuggestedTagsByMajor(majorId) {
    if (!majorId) return [];

    const { data, error } = await supabase
      .from('major_suggested_tags')
      .select('tags ( id, name )')
      .eq('major_id', Number(majorId));

    if (error) throw error;
    return (data || [])
      .map((row) => row.tags)
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  static async getPreferences(userId) {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('user_id, major_id, goal, onboarded_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (isMissingRelation(error)) return null;
      throw error;
    }
    return data;
  }

  static async getSubjectsByMajor(majorId) {

    let query = supabase
      .from('subjects')
      .select('id, name, code')
      .order('name', { ascending: true });

    if (majorId) {
      query = query.or(`major_id.eq.${Number(majorId)},major_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  static async getSubjectIds(userId) {
    const { data, error } = await supabase
      .from('user_subject_selections')
      .select('subject_id')
      .eq('user_id', userId);

    if (error) {
      if (isMissingRelation(error)) return [];
      throw error;
    }
    return (data || []).map((row) => row.subject_id);
  }

  static async setSubjects(userId, subjectIds) {
    const { error: deleteError } = await supabase
      .from('user_subject_selections')
      .delete()
      .eq('user_id', userId);

    if (deleteError) throw deleteError;
    if (!subjectIds.length) return [];

    const rows = [...new Set(subjectIds)].map((id) => ({ user_id: userId, subject_id: id }));
    const { data, error } = await supabase
      .from('user_subject_selections')
      .insert(rows)
      .select('subject_id');

    if (error) throw error;
    return data || [];
  }

  static async recommendHybrid(userId, limit = 12) {
    const { data, error } = await supabase.rpc('recommend_documents_hybrid', {
      p_user_id: userId,
      p_limit: Number(limit),
    });

    if (error) throw error;
    return data || [];
  }

  // Kèm tên tag vì form onboarding làm việc bằng tên, không phải id
  static async getTopics(userId) {
    const { data, error } = await supabase
      .from('user_topic_selections')
      .select('tags ( id, name )')
      .eq('user_id', userId);

    if (error) {
      if (isMissingRelation(error)) return [];
      throw error;
    }
    return (data || []).map((row) => row.tags).filter(Boolean);
  }

  static async upsertPreferences(userId, { majorId, goal, onboardedAt }) {
    const payload = {
      user_id: userId,
      major_id: majorId || null,
      goal: goal || null,
      updated_at: new Date().toISOString(),
    };
    if (onboardedAt !== undefined) {
      payload.onboarded_at = onboardedAt;
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .upsert(payload, { onConflict: 'user_id' })
      .select('user_id, major_id, goal, onboarded_at')
      .single();

    if (error) throw error;
    return data;
  }


  static async setTopics(userId, tagIds) {
    const { error: deleteError } = await supabase
      .from('user_topic_selections')
      .delete()
      .eq('user_id', userId);

    if (deleteError) throw deleteError;
    if (!tagIds.length) return [];

    const rows = [...new Set(tagIds)].map((tagId) => ({ user_id: userId, tag_id: tagId }));
    const { data, error } = await supabase
      .from('user_topic_selections')
      .insert(rows)
      .select('tag_id');

    if (error) throw error;
    return data || [];
  }

}

module.exports = PreferenceModel;
