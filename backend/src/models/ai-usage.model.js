const supabase = require('../config/supabase');

class AiUsageModel {
  static async create(logData) {
    const { data, error } = await supabase
      .from('ai_usage_logs')
      .insert([{
        user_id: logData.userId,
        doc_id: logData.docId,
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
}

module.exports = AiUsageModel;
