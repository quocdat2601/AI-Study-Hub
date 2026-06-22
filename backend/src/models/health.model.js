const supabase = require('../config/supabase');

async function getDatabaseTime() {
  // Using Supabase client to check connection by querying a table
  // Since we can't easily run SELECT NOW() without RPC, we check connection health
  const { error } = await supabase.from('users').select('count', { count: 'exact', head: true });
  
  if (error) {
    throw new Error(`Supabase connection error: ${error.message}`);
  }
  
  return new Date().toISOString();
}

module.exports = { getDatabaseTime };
