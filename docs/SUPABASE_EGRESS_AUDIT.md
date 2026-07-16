# Supabase Storage Egress Checks

Use these queries before deleting anything from Storage. Cached egress is caused by files being served from Supabase Storage/CDN; deleting rows without checking references can break previews, downloads, chat snapshots, or saved documents.

## Largest Physical Files

```sql
select
  id,
  storage_path,
  mime_type,
  round(size_bytes / 1024.0 / 1024.0, 2) as size_mb,
  created_at
from cloud_files
order by size_bytes desc
limit 50;
```

## Public Documents That Can Drive Egress

```sql
select
  d.id,
  d.title,
  d.view_count,
  d.download_count,
  cf.storage_path,
  cf.mime_type,
  round(cf.size_bytes / 1024.0 / 1024.0, 2) as size_mb
from documents d
join cloud_files cf on cf.id = d.file_id
where d.is_public = true
  and d.document_scope = 'library'
  and d.lifecycle_status = 'active'
  and d.deleted_at is null
order by cf.size_bytes desc, d.view_count desc
limit 50;
```

## Files With No Active Document References

```sql
select
  cf.id,
  cf.storage_path,
  cf.mime_type,
  round(cf.size_bytes / 1024.0 / 1024.0, 2) as size_mb,
  count(d.id) filter (
    where d.deleted_at is null
      and d.lifecycle_status = 'active'
  ) as active_document_count
from cloud_files cf
left join documents d on d.file_id = cf.id
group by cf.id
having count(d.id) filter (
  where d.deleted_at is null
    and d.lifecycle_status = 'active'
) = 0
order by cf.size_bytes desc;
```

Only delete the Storage object after confirming no active document, saved library document, shared snapshot, or lifecycle reference still needs that `file_id`.
