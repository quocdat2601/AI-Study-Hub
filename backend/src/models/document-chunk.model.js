const supabase = require('../config/supabase');

class DocumentChunkModel {
  static async replaceForDocument(docId, chunks) {
    const numericDocId = Number(docId);

    const { error: deleteError } = await supabase
      .from('document_chunks')
      .delete()
      .eq('doc_id', numericDocId);

    if (deleteError) throw deleteError;

    if (!chunks.length) return [];

    const rows = chunks.map((chunk, index) => ({
      doc_id: numericDocId,
      chunk_index: index,
      content: chunk.content,
      token_estimate: chunk.tokenEstimate,
      metadata: chunk.metadata || {},
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('document_chunks')
      .insert(rows)
      .select()
      .order('chunk_index', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async findByDocumentId(docId) {
    const { data, error } = await supabase
      .from('document_chunks')
      .select('*')
      .eq('doc_id', Number(docId))
      .order('chunk_index', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async countByDocumentId(docId) {
    const { count, error } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('doc_id', Number(docId));

    if (error) throw error;
    return count || 0;
  }
}

module.exports = DocumentChunkModel;
