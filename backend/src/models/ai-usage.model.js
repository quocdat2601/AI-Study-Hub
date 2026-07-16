const supabase = require('../config/supabase');

class AiUsageModel {
  static async create(logData) {
    const { data, error } = await supabase
      .from('ai_usage_logs')
      .insert([{
        user_id: logData.userId,
        doc_id: logData.docId,
        session_id: logData.sessionId || null,
        provider: logData.provider || 'gemini',
        model: logData.model,
        request_type: logData.requestType || 'document_qa',
        prompt_tokens: Number(logData.promptTokens || 0),
        completion_tokens: Number(logData.completionTokens || 0),
        total_tokens: Number(logData.totalTokens || 0),
        request_count: Number(logData.requestCount || 1),
        success: Boolean(logData.success),
        error_code: logData.errorCode || null,
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async listSince({ model, since, userId }) {
    let query = supabase
      .from('ai_usage_logs')
      .select('request_count, total_tokens, user_id, success, created_at')
      .eq('model', model)
      .gte('created_at', since.toISOString());

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  static async aggregateByModel({ since }) {
    const { data, error } = await supabase
      .from('ai_usage_logs')
      .select('provider, model, request_count, total_tokens, success')
      .gte('created_at', since.toISOString());

    if (error) throw error;

    const groups = {};
    (data || []).forEach(row => {
      const key = `${row.provider || 'gemini'}:${row.model}`;
      if (!groups[key]) {
        groups[key] = {
          provider: row.provider || 'gemini',
          model: row.model,
          total_requests: 0,
          total_tokens: 0,
          error_count: 0
        };
      }
      groups[key].total_requests += Number(row.request_count || 1);
      groups[key].total_tokens += Number(row.total_tokens || 0);
      if (!row.success) {
        groups[key].error_count += 1;
      }
    });

    return Object.values(groups);
  }

  static async topUsersToday(limit = 10) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('ai_usage_logs')
      .select('user_id, request_count, total_tokens, users(email)')
      .gte('created_at', startOfToday.toISOString());

    if (error) throw error;

    const userStats = {};
    (data || []).forEach(row => {
      const userId = row.user_id || 'anonymous';
      const email = row.users?.email || 'System';
      if (!userStats[userId]) {
        userStats[userId] = {
          user_id: userId,
          email,
          request_count: 0,
          total_tokens: 0
        };
      }
      userStats[userId].request_count += Number(row.request_count || 1);
      userStats[userId].total_tokens += Number(row.total_tokens || 0);
    });

    return Object.values(userStats)
      .sort((a, b) => b.request_count - a.request_count)
      .slice(0, limit);
  }
}

module.exports = AiUsageModel;
