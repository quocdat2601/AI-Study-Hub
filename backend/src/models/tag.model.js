const supabase = require('../config/supabase');

const DOCUMENT_TAG_SELECT = 'document_tags ( tags ( id, name ) )';

class TagModel {
  static get documentTagSelect() {
    return DOCUMENT_TAG_SELECT;
  }

  static parseNames(raw) {
    if (!raw) return [];

    const names = String(raw)
      .split(/[,\n]/)
      .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, ' '))
      .filter((tag) => tag && tag.length <= 50);

    return [...new Set(names)].slice(0, 10);
  }

  static normalizeDocumentTags(documentTags) {
    return (documentTags || [])
      .map((row) => row.tags)
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // Liệt kê tag kèm số tài liệu (từ view tag_usage) — cho Topic Picker & autocomplete
  static async list({ q, limit = 50 } = {}) {
    let query = supabase
      .from('tag_usage')
      .select('id, name, doc_count')
      .order('doc_count', { ascending: false })
      .order('name', { ascending: true })
      .limit(Math.min(Math.max(Number(limit) || 50, 1), 200));

    const search = String(q || '').trim().toLowerCase();
    if (search) {
      query = query.ilike('name', `${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // Tên các tag phổ biến nhất — truyền vào prompt auto-tag để model ưu tiên tái dùng
  static async topByUsageNames(limit = 50) {
    const rows = await this.list({ limit });
    return rows.map((row) => row.name);
  }

  static async findOrCreateByName(name) {
    const { data: existing, error: existingError } = await supabase
      .from('tags')
      .select('id, name')
      .eq('name', name)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return existing;

    const { data, error } = await supabase
      .from('tags')
      .insert([{ name }])
      .select('id, name')
      .single();

    if (error) throw error;
    return data;
  }

  static async setForDocument(docId, rawTags) {
    const tagNames = this.parseNames(rawTags);

    const { error: deleteError } = await supabase
      .from('document_tags')
      .delete()
      .eq('doc_id', docId);

    if (deleteError) throw deleteError;
    if (!tagNames.length) return [];

    const tags = [];
    for (const name of tagNames) {
      tags.push(await this.findOrCreateByName(name));
    }

    const { error: insertError } = await supabase
      .from('document_tags')
      .insert(tags.map((tag) => ({ doc_id: docId, tag_id: tag.id })));

    if (insertError) throw insertError;
    return tags;
  }
}

module.exports = TagModel;
