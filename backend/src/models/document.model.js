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

  static async countByUserId(userId) {
    const { count, error } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) throw error;
    return count || 0;
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
        subjects (name, code),
        cloud_files (mime_type, size_bytes)
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
        subjects (name, code),
        cloud_files (mime_type, size_bytes)
      `)
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
