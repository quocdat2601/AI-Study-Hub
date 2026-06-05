const supabase = require('../config/supabase');

class DocumentModel {
  static async findByUserId(userId) {
    const { data: ownedDocs, error: ownedError } = await supabase
      .from('documents')
      .select(`
        *,
        subjects (name, code),
        cloud_files (storage_path, mime_type, size_bytes)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (ownedError) throw ownedError;

    const { data: shares, error: sharedError } = await supabase
      .from('doc_shares')
      .select(`
        documents (
          *,
          subjects (name, code),
          cloud_files (storage_path, mime_type, size_bytes)
        )
      `)
      .eq('shared_to', userId)
      .eq('status', 'active');

    if (sharedError) throw sharedError;

    const sharedDocs = (shares || [])
      .map((share) => share.documents)
      .filter(Boolean);

    const byId = new Map();
    [...(ownedDocs || []), ...sharedDocs].forEach((doc) => byId.set(doc.id, doc));

    return [...byId.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  static async findById(id) {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        subjects (name, code),
        cloud_files (storage_path, mime_type, size_bytes)
      `)
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async findAccessibleById(id, userId) {
    const doc = await this.findById(id);
    if (!doc) return null;
    if (doc.user_id === userId) return doc;

    const { data: share, error } = await supabase
      .from('doc_shares')
      .select('id')
      .eq('doc_id', id)
      .eq('shared_to', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw error;
    return share ? doc : null;
  }

  static async createCloudFile(fileData) {
    const { data, error } = await supabase
      .from('cloud_files')
      .insert([fileData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteCloudFile(id) {
    const { error } = await supabase
      .from('cloud_files')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  static async create(docData) {
    const { data, error } = await supabase
      .from('documents')
      .insert([docData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async delete(id) {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  static async updateExtraction(id, extractionData) {
    const { data, error } = await supabase
      .from('documents')
      .update({
        extracted_text: extractionData.text,
        extraction_status: extractionData.status,
        extraction_error: extractionData.error,
        extracted_at: new Date().toISOString(),
        status: extractionData.status === 'ready' ? 'indexed' : 'uploaded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        subjects (name, code),
        cloud_files (storage_path, mime_type, size_bytes)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  static async updateThumbnail(id, thumbnailData) {
    const { data, error } = await supabase
      .from('documents')
      .update({
        thumbnail_path: thumbnailData.path || null,
        thumbnail_status: thumbnailData.status,
        thumbnail_error: thumbnailData.error || null,
        thumbnail_generated_at: thumbnailData.status === 'ready' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        subjects (name, code),
        cloud_files (storage_path, mime_type, size_bytes)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  static async countByUserId(userId) {
    const { count, error } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) throw error;
    return count || 0;
  }

  static async findAdminOverviewDocuments(sinceDate) {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        id,
        status,
        extraction_status,
        created_at,
        subject_id,
        subjects (name, code),
        cloud_files (size_bytes)
      `)
      .gte('created_at', sinceDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async findAllForAdminOverview() {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        id,
        status,
        extraction_status,
        created_at,
        subject_id,
        subjects (name, code),
        cloud_files (size_bytes)
      `);

    if (error) throw error;
    return data || [];
  }

  static async findRecentByUserId(userId, limit = 5) {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        id,
        title,
        status,
        extraction_status,
        created_at,
        view_count,
        thumbnail_path,
        thumbnail_status,
        thumbnail_error,
        thumbnail_generated_at,
        subjects (name, code),
        cloud_files (storage_path, mime_type, size_bytes)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(Math.min(Number(limit) || 5, 20));

    if (error) throw error;
    return data || [];
  }

  static async findTrending(limit = 5) {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        id,
        title,
        created_at,
        extracted_text,
        extraction_status,
        view_count,
        thumbnail_path,
        thumbnail_status,
        thumbnail_error,
        thumbnail_generated_at,
        subjects (name, code),
        cloud_files (storage_path, mime_type, size_bytes)
      `)
      .eq('is_public', true)
      .order('view_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(Math.min(Number(limit) || 5, 12));

    if (error) throw error;
    return data || [];
  }

  static async sumStorageByUserId(userId) {
    const { data, error } = await supabase
      .from('documents')
      .select('cloud_files (size_bytes)')
      .eq('user_id', userId);

    if (error) throw error;

    return (data || []).reduce((total, doc) => {
      return total + Number(doc.cloud_files?.size_bytes || 0);
    }, 0);
  }
}

module.exports = DocumentModel;
