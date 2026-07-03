const supabase = require('../config/supabase');

class DocumentRoadmapModel {
  static async findByDocumentId(documentId) {
    const { data, error } = await supabase
      .from('document_roadmaps')
      .select('*')
      .eq('document_id', Number(documentId))
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  static async findReusableByFileId({ fileId, documentId, roadmapVersion }) {
    if (!fileId) return null;

    const { data, error } = await supabase
      .from('document_roadmaps')
      .select('*, documents!inner(id, lifecycle_status, deleted_at)')
      .eq('file_id', Number(fileId))
      .eq('roadmap_version', roadmapVersion)
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

  static async upsertPending({ documentId, fileId, provider, model, roadmapVersion }) {
    const { data, error } = await supabase
      .from('document_roadmaps')
      .upsert({
        document_id: Number(documentId),
        file_id: fileId == null ? null : Number(fileId),
        status: 'pending',
        error: null,
        provider,
        model,
        roadmap_version: roadmapVersion,
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
      .from('document_roadmaps')
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

  static async markReady({ documentId, fileId, roadmap, provider, model, roadmapVersion }) {
    const { data, error } = await supabase
      .from('document_roadmaps')
      .upsert({
        document_id: Number(documentId),
        file_id: fileId == null ? null : Number(fileId),
        title: roadmap.title,
        goal: roadmap.goal || null,
        steps: roadmap.steps || [],
        status: 'ready',
        error: null,
        provider,
        model,
        roadmap_version: roadmapVersion,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'document_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async markFailed({ documentId, fileId, error, provider, model, roadmapVersion }) {
    const message = String(error?.message || error || 'Document roadmap generation failed').slice(0, 1000);
    const { data, error: dbError } = await supabase
      .from('document_roadmaps')
      .upsert({
        document_id: Number(documentId),
        file_id: fileId == null ? null : Number(fileId),
        status: 'failed',
        error: message,
        provider,
        model,
        roadmap_version: roadmapVersion,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'document_id' })
      .select()
      .single();

    if (dbError) throw dbError;
    return data;
  }
}

module.exports = DocumentRoadmapModel;
