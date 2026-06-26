require('dotenv').config();
const crypto = require('crypto');
const supabase = require('../src/config/supabase');
const supabaseService = require('../src/services/supabase.service');

function parseArgs(argv) {
  const options = { dryRun: false, limit: 50 };
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    if (arg.startsWith('--limit=')) options.limit = Math.min(500, Math.max(1, Number(arg.split('=')[1]) || 50));
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { data, error } = await supabase.from('cloud_files')
    .select('id, storage_path, size_bytes').is('content_hash', null).order('id').limit(options.limit);
  if (error) throw error;
  const summary = { candidates: data?.length || 0, hashed: 0, failed: 0, dryRun: options.dryRun };
  for (const file of data || []) {
    if (options.dryRun) {
      console.log(`[content-hash] candidate ${file.id} ${file.storage_path}`);
      continue;
    }
    try {
      const buffer = await supabaseService.downloadFile(file.storage_path);
      const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');
      const { error: updateError } = await supabase.from('cloud_files')
        .update({ content_hash: contentHash }).eq('id', file.id).is('content_hash', null);
      if (updateError) throw updateError;
      summary.hashed += 1;
      console.log(`[content-hash] hashed ${file.id}`);
    } catch (hashError) {
      summary.failed += 1;
      console.error(`[content-hash] failed ${file.id}:`, hashError.message);
    }
  }
  console.log('[content-hash] summary', JSON.stringify(summary));
  if (summary.failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error('[content-hash] fatal:', error);
  process.exitCode = 1;
});
