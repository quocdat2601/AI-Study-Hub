const supabase = require('../config/supabase');

function toVectorLiteral(values) {
  if (!Array.isArray(values) || !values.length) return null;
  return `[${values.map((value) => Number(value)).join(',')}]`;
}

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
      embedding: toVectorLiteral(chunk.embedding),
      embedding_model: chunk.embeddingModel || null,
      embedding_status: chunk.embeddingStatus || (chunk.embedding ? 'ready' : 'pending'),
      embedding_error: chunk.embeddingError || null,
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

  static async findByDocumentIds(docIds) {
    const normalizedIds = [...new Set((docIds || []).map(Number).filter(Number.isInteger))];
    if (!normalizedIds.length) return [];

    const { data, error } = await supabase
      .from('document_chunks')
      .select('*')
      .in('doc_id', normalizedIds)
      .order('doc_id', { ascending: true })
      .order('chunk_index', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async findByIds(ids) {
    const normalizedIds = [...new Set((ids || []).map(Number).filter(Number.isInteger))];
    if (!normalizedIds.length) return [];

    const { data, error } = await supabase
      .from('document_chunks')
      .select('*')
      .in('id', normalizedIds)
      .order('doc_id', { ascending: true })
      .order('chunk_index', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async matchByEmbedding({ docId, embedding, limit = 4 }) {
    const { data, error } = await supabase.rpc('match_document_chunks', {
      p_doc_id: Number(docId),
      p_query_embedding: toVectorLiteral(embedding),
      p_match_count: Number(limit),
    });

    if (error) throw error;
    return data || [];
  }

  static async matchByEmbeddingAcrossDocuments({ docIds, embedding, limit = 4 }) {
    const normalizedIds = [...new Set((docIds || []).map(Number).filter(Number.isInteger))];
    if (!normalizedIds.length) return [];

    const { data, error } = await supabase.rpc('match_document_chunks_multi', {
      p_doc_ids: normalizedIds,
      p_query_embedding: toVectorLiteral(embedding),
      p_match_count: Number(limit),
    });

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

  // Sao chép chunks + vector từ document nguồn sang document đích (dedup, khỏi gọi lại Embedding API)
  static async copyFromDocument(sourceDocId, targetDocId) {
    const { data, error } = await supabase.rpc('copy_document_chunks', {
      p_source_doc_id: Number(sourceDocId),
      p_target_doc_id: Number(targetDocId),
    });

    if (error) throw error;
    return data || 0;
  }
}

module.exports = DocumentChunkModel;
