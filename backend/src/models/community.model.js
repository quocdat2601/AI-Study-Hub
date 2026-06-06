const supabase = require('../config/supabase');

const POST_SELECT = `
  *,
  subjects (id, name, code),
  users!community_posts_user_id_fkey (id, email, role, status),
  documents (
    id,
    title,
    user_id,
    subject_id,
    status,
    extraction_status,
    extracted_text,
    created_at,
    updated_at,
    is_public,
    view_count,
    thumbnail_path,
    thumbnail_status,
    thumbnail_error,
    thumbnail_generated_at,
    subjects (name, code),
    cloud_files (storage_path, mime_type, size_bytes)
  ),
  chat_sessions (
    id,
    user_id,
    title,
    created_at,
    updated_at,
    last_activity_at
  )
`;

const REPLY_SELECT = `
  *,
  users!community_replies_user_id_fkey (id, email, role, status)
`;

class CommunityModel {
  static async listPosts() {
    const { data, error } = await supabase
      .from('community_posts')
      .select(POST_SELECT)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async findPostById(id) {
    const { data, error } = await supabase
      .from('community_posts')
      .select(POST_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async findOwnedPostById(id, userId) {
    const { data, error } = await supabase
      .from('community_posts')
      .select(POST_SELECT)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async createPost(postData) {
    const { data, error } = await supabase
      .from('community_posts')
      .insert([postData])
      .select(POST_SELECT)
      .single();

    if (error) throw error;
    return data;
  }

  static async updatePost(id, updates) {
    const { data, error } = await supabase
      .from('community_posts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(POST_SELECT)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async deletePost(id) {
    const { data, error } = await supabase
      .from('community_posts')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async listRepliesByPostId(postId) {
    const { data, error } = await supabase
      .from('community_replies')
      .select(REPLY_SELECT)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async listRepliesByPostIds(postIds) {
    if (!postIds.length) return [];

    const { data, error } = await supabase
      .from('community_replies')
      .select(REPLY_SELECT)
      .in('post_id', postIds)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async findReplyById(id) {
    const { data, error } = await supabase
      .from('community_replies')
      .select(REPLY_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async createReply(replyData) {
    const { data, error } = await supabase
      .from('community_replies')
      .insert([replyData])
      .select(REPLY_SELECT)
      .single();

    if (error) throw error;
    return data;
  }

  static async updateReply(id, updates) {
    const { data, error } = await supabase
      .from('community_replies')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(REPLY_SELECT)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async clearAcceptedReplies(postId) {
    const { error } = await supabase
      .from('community_replies')
      .update({
        is_accepted: false,
        updated_at: new Date().toISOString(),
      })
      .eq('post_id', postId)
      .eq('is_accepted', true);

    if (error) throw error;
    return true;
  }

  static async listVotesForPosts(postIds) {
    if (!postIds.length) return [];

    const { data, error } = await supabase
      .from('community_votes')
      .select('id, user_id, post_id, reply_id, value')
      .in('post_id', postIds);

    if (error) throw error;
    return data || [];
  }

  static async listVotesForReplies(replyIds) {
    if (!replyIds.length) return [];

    const { data, error } = await supabase
      .from('community_votes')
      .select('id, user_id, post_id, reply_id, value')
      .in('reply_id', replyIds);

    if (error) throw error;
    return data || [];
  }

  static async findPostVote(userId, postId) {
    const { data, error } = await supabase
      .from('community_votes')
      .select('*')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .is('reply_id', null)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async findReplyVote(userId, replyId) {
    const { data, error } = await supabase
      .from('community_votes')
      .select('*')
      .eq('user_id', userId)
      .eq('reply_id', replyId)
      .is('post_id', null)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async createVote(voteData) {
    const { data, error } = await supabase
      .from('community_votes')
      .insert([voteData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteVote(id) {
    const { data, error } = await supabase
      .from('community_votes')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async createReport(reportData) {
    const { data, error } = await supabase
      .from('community_reports')
      .insert([reportData])
      .select(`
        *,
        community_posts (id, title, post_type, status),
        community_replies (id, post_id, status, body)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  static async findOpenPostReport(reportedBy, postId) {
    const { data, error } = await supabase
      .from('community_reports')
      .select('*')
      .eq('reported_by', reportedBy)
      .eq('post_id', postId)
      .is('reply_id', null)
      .eq('status', 'open')
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async findOpenReplyReport(reportedBy, replyId) {
    const { data, error } = await supabase
      .from('community_reports')
      .select('*')
      .eq('reported_by', reportedBy)
      .eq('reply_id', replyId)
      .is('post_id', null)
      .eq('status', 'open')
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async listReports(limit = 50) {
    const { data, error } = await supabase
      .from('community_reports')
      .select(`
        *,
        community_posts (id, title, post_type, status, subject_id),
        community_replies (id, post_id, body, status),
        reporters:users!community_reports_reported_by_fkey (id, email, role, status),
        resolvers:users!community_reports_resolved_by_fkey (id, email, role, status)
      `)
      .order('created_at', { ascending: false })
      .limit(Math.min(Number(limit) || 50, 200));

    if (error) throw error;
    return data || [];
  }

  static async updateReport(id, updates) {
    const { data, error } = await supabase
      .from('community_reports')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        community_posts (id, title, post_type, status),
        community_replies (id, post_id, body, status)
      `)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}

module.exports = CommunityModel;
