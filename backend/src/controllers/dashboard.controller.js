const supabase = require('../config/supabase');

async function getDashboardData(req, res, next) {
  try {
    const userId = req.user.id;

    // 1. Get user storage info
    const { data: user } = await supabase
      .from('users')
      .select('storage_limit_bytes')
      .eq('id', userId)
      .single();

    // 2. Get document counts
    const { count: docCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // 3. Get recent uploads
    const { data: recentDocs } = await supabase
      .from('documents')
      .select('id, title, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    res.json({
      storage: {
        limit: user.storage_limit_bytes,
        used: 0 // Needs storage calculation logic
      },
      stats: {
        documents: docCount
      },
      recentDocuments: recentDocs
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboardData
};
