const supabase = require('../config/supabase');

class DocumentOverviewModel {
  static async findByDocumentId(documentId) {
    const { data, error } = await supabase
      .from('document_overviews')
      .select('*')
      .eq('document_id', Number(documentId))
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  static async findReadyByDocumentIds(documentIds, overviewVersion) {
    const normalizedIds = [...new Set((documentIds || []).map(Number).filter(Number.isInteger))];
    if (!normalizedIds.length) return [];

    const { data, error } = await supabase
      .from('document_overviews')
      .select('*')
      .in('document_id', normalizedIds)
      .eq('overview_version', overviewVersion)
      .eq('status', 'ready');

    if (error) throw error;
    return data || [];
  }

  static async findReusableByFileId({ fileId, documentId, overviewVersion }) {
    if (!fileId) return null;

    const { data, error } = await supabase
      .from('document_overviews')
      .select('*, documents!inner(id, lifecycle_status, deleted_at)')
      .eq('file_id', Number(fileId))
      .eq('overview_version', overviewVersion)
      .eq('status', 'ready')
      .neq('document_id', Number(documentId))
      .is('documents.deleted_at', null)
      .eq('documents.lifecycle_status', 'active')
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  static async upsertPending({ documentId, fileId, provider, model, overviewVersion }) {
    const { data, error } = await supabase
      .from('document_overviews')
      .upsert({
        document_id: Number(documentId),
        file_id: fileId == null ? null : Number(fileId),
        status: 'pending',
        error: null,
        provider,
        model,
        overview_version: overviewVersion,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'document_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async markStale(documentId) {
    const existing = await this.findByDocumentId(documentId);
    if (!existing) return null;

    const { data, error } = await supabase
      .from('document_overviews')
      .update({
        status: 'stale',
        updated_at: new Date().toISOString(),
      })
      .eq('document_id', Number(documentId))
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async markReady({ documentId, fileId, overview, provider, model, overviewVersion }) {
    const { data, error } = await supabase
      .from('document_overviews')
      .upsert({
        document_id: Number(documentId),
        file_id: fileId == null ? null : Number(fileId),
        summary: overview.summary,
        document_type: overview.documentType,
        purpose: overview.purpose,
        key_topics: overview.keyTopics || [],
        outline: overview.outline || [],
        source_chunk_ids: overview.sourceChunkIds || [],
        status: 'ready',
        error: null,
        provider,
        model,
        overview_version: overviewVersion,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'document_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async markFailed({ documentId, fileId, error, provider, model, overviewVersion }) {
    const message = String(error?.message || error || 'Document overview generation failed').slice(0, 1000);
    const { data, error: dbError } = await supabase
      .from('document_overviews')
      .upsert({
        document_id: Number(documentId),
        file_id: fileId == null ? null : Number(fileId),
        status: 'failed',
        error: message,
        provider,
        model,
        overview_version: overviewVersion,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'document_id' })
      .select()
      .single();

    if (dbError) throw dbError;
    return data;
  }
}

module.exports = DocumentOverviewModel;
