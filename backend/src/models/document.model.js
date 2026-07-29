const supabase = require('../config/supabase');
const TagModel = require('./tag.model');

const DOCUMENT_SELECT = `
  *,
  subjects (name, code),
  cloud_files (storage_path, mime_type, size_bytes),
  ${TagModel.documentTagSelect}
`;

class DocumentModel {
  static async findByUserId(userId) {
    const { data: ownedDocs, error: ownedError } = await supabase
      .from('documents')
      .select(DOCUMENT_SELECT)
      .eq('user_id', userId)
      .eq('document_scope', 'library')
      .eq('lifecycle_status', 'active')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (ownedError) throw ownedError;

    const { data: shares, error: sharedError } = await supabase
      .from('doc_shares')
      .select(`
        documents!inner (
          ${DOCUMENT_SELECT}
        )
      `)
      .eq('shared_to', userId)
      .eq('status', 'active')
      .eq('documents.document_scope', 'library')
      .eq('documents.lifecycle_status', 'active')
      .is('documents.deleted_at', null);

    if (sharedError) throw sharedError;

    const sharedDocs = (shares || [])
      .map((share) => share.documents ? { ...share.documents, access_via: 'share' } : null)
      .filter((doc) => doc && !doc.deleted_at);

    // Fetch bookmarked public documents
    const { data: bookmarks, error: bookmarkError } = await supabase
      .from('bookmarks')
      .select(`
        documents!inner (
          ${DOCUMENT_SELECT}
        )
      `)
      .eq('user_id', userId)
      .eq('documents.lifecycle_status', 'active')
      .is('documents.deleted_at', null);

    if (bookmarkError) throw bookmarkError;

    const bookmarkedDocs = (bookmarks || [])
      .map((b) => b.documents ? { ...b.documents, access_via: 'bookmark' } : null)
      .filter((doc) => doc && !doc.deleted_at);

    const byId = new Map();
    [...(ownedDocs || []).map((doc) => ({ ...doc, access_via: 'owner' })), ...sharedDocs, ...bookmarkedDocs]
      .forEach((doc) => byId.set(doc.id, doc));

    return [...byId.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  // Lấy nhiều document công khai theo danh sách id (cho gợi ý) — giữ đủ field preview
  static async findPublicByIds(ids) {
    if (!ids || !ids.length) return [];

    const { data, error } = await supabase
      .from('documents')
      .select(DOCUMENT_SELECT)
      .in('id', ids)
      .eq('is_public', true)
      .eq('document_scope', 'library')
      .eq('lifecycle_status', 'active')
      .is('deleted_at', null);

    if (error) throw error;
    return data || [];
  }

  static async findById(id) {
    const { data, error } = await supabase
      .from('documents')
      .select(DOCUMENT_SELECT)
      .eq('id', id)
      .eq('document_scope', 'library')
      .eq('lifecycle_status', 'active')
      .is('deleted_at', null)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async findOwnedById(id, userId) {
    const { data, error } = await supabase
      .from('documents')
      .select(DOCUMENT_SELECT)
      .eq('id', id)
      .eq('user_id', userId)
      .eq('document_scope', 'library')
      .eq('lifecycle_status', 'active')
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async findOwnedSharedById(id, userId) {
    const { data, error } = await supabase
      .from('documents')
      .select(DOCUMENT_SELECT)
      .eq('id', id)
      .eq('user_id', userId)
      .eq('document_scope', 'shared')
      .eq('lifecycle_status', 'active')
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  static async findAccessibleById(id, userId) {
    const doc = await this.findById(id);
    if (!doc) return null;
    if (doc.user_id === userId) return doc;
    if (doc.is_public) return doc;

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

  static async findActiveById(id) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('documents')
      .select(DOCUMENT_SELECT)
      .eq('id', id)
      .eq('lifecycle_status', 'active')
      .is('deleted_at', null)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async findActiveSessionScopedById(id, sessionId) {
    let query = supabase
      .from('documents')
      .select(DOCUMENT_SELECT)
      .eq('id', id)
      .eq('document_scope', 'session')
      .eq('lifecycle_status', 'active')
      .is('deleted_at', null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    if (sessionId !== undefined && sessionId !== null) {
      query = query.eq('origin_session_id', Number(sessionId));
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  }

  static async convertSessionDocumentToLibrary({ id, userId, sessionId }) {
    const { data, error } = await supabase.rpc('convert_session_document_to_library', {
      p_document_id: Number(id),
      p_session_id: Number(sessionId),
      p_user_id: userId,
    });
    if (error) throw error;
    if (!data?.length) return null;
    return this.findAnyById(id);
  }

  static async touchSessionDocuments(documentIds) {
    const ids = [...new Set((documentIds || []).map(Number).filter(Number.isInteger))];
    if (!ids.length) return [];
    const { data, error } = await supabase.rpc('touch_session_documents', {
      p_document_ids: ids,
      p_accessed_at: new Date().toISOString(),
    });
    if (error) throw error;
    return data || [];
  }

  static async restoreSessionDocument({ id, userId, sessionId }) {
    const { data, error } = await supabase.rpc('restore_session_document', {
      p_document_id: Number(id),
      p_session_id: Number(sessionId),
      p_user_id: userId,
    });
    if (error) throw error;
    return data?.[0] || null;
  }

  static async findSessionDocumentForRecovery(id, sessionId) {
    const { data, error } = await supabase
      .from('documents')
      .select(DOCUMENT_SELECT)
      .eq('id', Number(id))
      .eq('document_scope', 'session')
      .eq('origin_session_id', Number(sessionId))
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  static async findSessionPurgeLog(sessionId, documentId) {
    const { data, error } = await supabase
      .from('session_document_purge_log')
      .select('document_id, purged_at')
      .eq('session_id', Number(sessionId))
      .eq('document_id', Number(documentId))
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  // ─── Soft delete / trash / restore ──────────────────────────────────────────

  // Tìm doc theo id BẤT KỂ đã xóa mềm hay chưa (cho restore/purge)
  static async findAnyById(id) {
    const { data, error } = await supabase
      .from('documents')
      .select(DOCUMENT_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  // Danh sách doc đã xóa mềm của user (thùng rác)
  static async findDeletedByUserId(userId) {
    const { data, error } = await supabase
      .from('documents')
      .select(DOCUMENT_SELECT)
      .eq('user_id', userId)
      .eq('document_scope', 'library')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Doc trong thùng rác đã quá hạn giữ (deleted_at < cutoff) — cho auto-purge
  static async findExpiredTrash(cutoffISO) {
    const { data, error } = await supabase
      .from('documents')
      .select(DOCUMENT_SELECT)
      .eq('document_scope', 'library')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoffISO);

    if (error) throw error;
    return data || [];
  }

  // Xóa mềm: đánh dấu deleted_at = now()
  static async softDelete(id, { moderationReason, moderatedBy } = {}) {
    const { data, error } = await supabase
      .from('documents')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        moderation_reason: moderationReason || null,
        moderated_by: moderatedBy || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Khôi phục: xóa cờ deleted_at
  static async restore(id) {
    const { data, error } = await supabase
      .from('documents')
      .update({
        deleted_at: null,
        lifecycle_status: 'active',
        expires_at: null,
        expired_at: null,
        purge_after: null,
        purge_claim_token: null,
        purge_claimed_at: null,
        last_cleanup_error: null,
        moderation_reason: null,
        moderated_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(DOCUMENT_SELECT)
      .single();

    if (error) throw error;
    return data;
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

  // Tìm một cloud_file đã có cùng mã nội dung (dedup) — để dùng lại storage_path
  static async findCloudFileByHash(contentHash) {
    if (!contentHash) return null;

    const { data, error } = await supabase
      .from('cloud_files')
      .select('id, storage_path, mime_type, size_bytes, content_hash')
      .eq('content_hash', contentHash)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  // Đếm số cloud_file còn trỏ tới cùng object vật lý — để biết khi nào được xóa file thật
  static async countCloudFilesByStoragePath(storagePath) {
    const [{ count: cloudCount, error: cloudError }, { count: snapshotCount, error: snapshotError }] = await Promise.all([
      supabase.from('cloud_files').select('*', { count: 'exact', head: true }).eq('storage_path', storagePath),
      supabase.from('shared_file_versions').select('*', { count: 'exact', head: true }).eq('storage_path', storagePath),
    ]);
    if (cloudError) throw cloudError;
    if (snapshotError) throw snapshotError;
    return (cloudCount || 0) + (snapshotCount || 0);
  }

  static async countDocumentsByFileId(fileId) {
    const { count, error } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('file_id', Number(fileId));
    if (error) throw error;
    return count || 0;
  }

  // Tìm một document đã trích xuất xong (cùng nội dung) để sao chép text + chunks
  static async findReadySourceByHash(contentHash, excludeDocId = null) {
    if (!contentHash) return null;

    let query = supabase
      .from('documents')
      .select('id, extracted_text, extraction_status, extraction_metadata, cloud_files!inner (content_hash)')
      .eq('cloud_files.content_hash', contentHash)
      .eq('extraction_status', 'ready')
      .limit(1);

    if (excludeDocId != null) {
      query = query.neq('id', excludeDocId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
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

  static async update(id, { title, subjectId }) {
    const payload = { updated_at: new Date().toISOString() };

    if (title !== undefined) {
      payload.title = title;
    }
    if (subjectId !== undefined) {
      payload.subject_id = subjectId || null;
    }

    const { data, error } = await supabase
      .from('documents')
      .update(payload)
      .eq('id', id)
      .select(DOCUMENT_SELECT)
      .single();

    if (error) throw error;
    return data;
  }

  static async updateExtraction(id, extractionData) {
    const { data, error } = await supabase
      .from('documents')
      .update({
        extracted_text: extractionData.text,
        extraction_status: extractionData.status,
        extraction_error: extractionData.error,
        extraction_metadata: extractionData.metadata || {},
        extracted_at: new Date().toISOString(),
        status: extractionData.status === 'ready' ? 'indexed' : 'uploaded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(DOCUMENT_SELECT)
      .single();

    if (error) throw error;
    return data;
  }

  static async findShareByDocAndRecipient(docId, sharedTo) {
    const { data, error } = await supabase
      .from('doc_shares')
      .select('*')
      .eq('doc_id', docId)
      .eq('shared_to', sharedTo)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async createShare({ docId, sharedBy, sharedTo }) {
    const existing = await this.findShareByDocAndRecipient(docId, sharedTo);

    if (existing?.status === 'active') {
      return existing;
    }

    if (existing) {
      const { data, error } = await supabase
        .from('doc_shares')
        .update({
          status: 'active',
          shared_by: sharedBy,
          revoked_at: null,
        })
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from('doc_shares')
      .insert([{
        doc_id: docId,
        shared_by: sharedBy,
        shared_to: sharedTo,
        status: 'active',
      }])
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  static async findSharesByDocId(docId) {
    const { data, error } = await supabase
      .from('doc_shares')
      .select('id, shared_to, shared_by, status, created_at, revoked_at')
      .eq('doc_id', docId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async revokeShare(shareId, docId) {
    const { data, error } = await supabase
      .from('doc_shares')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
      })
      .eq('id', shareId)
      .eq('doc_id', docId)
      .eq('status', 'active')
      .select('*')
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async countByUserId(userId) {
    const { count, error } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('document_scope', 'library')
      .is('deleted_at', null);

    if (error) throw error;
    return count || 0;
  }

  static async updateVisibility(id, isPublic) {
    const { data, error } = await supabase
      .from('documents')
      .update({
        is_public: isPublic,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('document_scope', 'library')
      .select(DOCUMENT_SELECT)
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
      .select(DOCUMENT_SELECT)
      .single();

    if (error) throw error;
    return data;
  }

  static async updateThumbnailsByFileId(fileId, thumbnailData) {
    const { data, error } = await supabase
      .from('documents')
      .update({
        thumbnail_path: thumbnailData.path || null,
        thumbnail_status: thumbnailData.status,
        thumbnail_error: thumbnailData.error || null,
        thumbnail_generated_at: thumbnailData.status === 'ready' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('file_id', Number(fileId))
      .eq('lifecycle_status', 'active')
      .is('deleted_at', null)
      .select(DOCUMENT_SELECT);

    if (error) throw error;
    return data || [];
  }

  static async claimSessionDocumentProcessing({ documentId, sessionId, userId, claimToken, staleSeconds = 900 }) {
    const { data, error } = await supabase.rpc('claim_session_document_processing', {
      p_document_id: Number(documentId),
      p_session_id: Number(sessionId),
      p_user_id: userId,
      p_claim_token: claimToken,
      p_stale_seconds: Number(staleSeconds),
    });
    if (error) throw error;
    return Boolean(data);
  }

  static async releaseSessionDocumentProcessing({ documentId, claimToken }) {
    const { data, error } = await supabase.rpc('release_session_document_processing', {
      p_document_id: Number(documentId),
      p_claim_token: claimToken,
    });
    if (error) throw error;
    return Boolean(data);
  }

  static async findReadyThumbnailByFileId(fileId) {
    if (!fileId) return null;
    const { data, error } = await supabase
      .from('documents')
      .select('id, file_id, thumbnail_path, thumbnail_status, thumbnail_error, thumbnail_generated_at')
      .eq('file_id', Number(fileId))
      .eq('thumbnail_status', 'ready')
      .not('thumbnail_path', 'is', null)
      .eq('lifecycle_status', 'active')
      .is('deleted_at', null)
      .order('thumbnail_generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async findThumbnailBackfillCandidates({ limit = 50, force = false } = {}) {
    let query = supabase
      .from('documents')
      .select(`
        id,
        user_id,
        title,
        thumbnail_path,
        thumbnail_status,
        thumbnail_error,
        thumbnail_generated_at,
        cloud_files!inner (storage_path, mime_type)
      `)
      .is('deleted_at', null)
      .in('cloud_files.mime_type', [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ])
      .order('created_at', { ascending: true })
      .limit(Math.min(Math.max(Number(limit) || 50, 1), 500));

    if (!force) {
      query = query.or('thumbnail_path.is.null,thumbnail_status.in.(pending,failed)');
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
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
      .is('deleted_at', null)
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
      `)
      .is('deleted_at', null);

    if (error) throw error;
    return data || [];
  }

  static async findRecentByUserId(userId, limit = 5) {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        id,
        file_id,
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
      .eq('document_scope', 'library')
      .eq('lifecycle_status', 'active')
      .is('deleted_at', null)
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
        file_id,
        title,
        created_at,
        extracted_text,
        extraction_status,
        status,
        view_count,
        thumbnail_path,
        thumbnail_status,
        thumbnail_error,
        thumbnail_generated_at,
        subjects (name, code),
        cloud_files (mime_type, size_bytes)
      `)
      .eq('is_public', true)
      .eq('document_scope', 'library')
      .eq('lifecycle_status', 'active')
      .eq('status', 'indexed')
      .eq('extraction_status', 'ready')
      .is('deleted_at', null)
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
      .eq('user_id', userId)
      .neq('document_scope', 'shared')
      .is('deleted_at', null);

    if (error) throw error;

    return (data || []).reduce((total, doc) => {
      return total + Number(doc.cloud_files?.size_bytes || 0);
    }, 0);
  }

  static async findPublicById(id) {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        subjects (id, name, code),
        cloud_files (storage_path, mime_type, size_bytes),
        users!fk_documents_users (id, email)
      `)
      .eq('id', id)
      .eq('is_public', true)
      .eq('document_scope', 'library')
      .eq('lifecycle_status', 'active')
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async searchPublic({ search, subjectId, sortBy, page, limit }) {
    let query = supabase
      .from('documents')
      .select(`
        id,
        file_id,
        title,
        created_at,
        view_count,
        download_count,
        thumbnail_path,
        thumbnail_status,
        subjects (id, name, code),
        cloud_files (mime_type, size_bytes)
      `, { count: 'exact' })
      .eq('is_public', true)
      .eq('document_scope', 'library')
      .eq('lifecycle_status', 'active')
      .eq('status', 'indexed')
      .is('deleted_at', null);

    if (subjectId) {
      query = query.eq('subject_id', subjectId);
    }

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    if (sortBy === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else if (sortBy === 'downloads') {
      query = query.order('download_count', { ascending: false });
    } else {
      query = query.order('view_count', { ascending: false });
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;
    return { documents: data || [], totalCount: count || 0 };
  }

  static async incrementViewCount(id) {
    const { data, error } = await supabase
      .from('documents')
      .select('view_count')
      .eq('id', id)
      .maybeSingle();
    
    if (error) return;
    
    const nextViews = (data?.view_count || 0) + 1;
    await supabase
      .from('documents')
      .update({ view_count: nextViews })
      .eq('id', id);
  }

  static async incrementDownloadCount(id) {
    const { data, error } = await supabase
      .from('documents')
      .select('download_count')
      .eq('id', id)
      .maybeSingle();
    
    if (error) return;
    
    const nextDownloads = (data?.download_count || 0) + 1;
    await supabase
      .from('documents')
      .update({ download_count: nextDownloads })
      .eq('id', id);
  }

  static async listComments(docId) {
    const { data, error } = await supabase
      .from('document_comments')
      .select(`
        *,
        users (id, email)
      `)
      .eq('doc_id', docId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async createComment({ docId, userId, content, rating }) {
    const { data, error } = await supabase
      .from('document_comments')
      .insert([{
        doc_id: docId,
        user_id: userId,
        content,
        rating,
      }])
      .select(`
        *,
        users (id, email)
      `)
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = DocumentModel;
