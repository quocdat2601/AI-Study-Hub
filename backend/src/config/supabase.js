const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.warn('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

function buildClientOptions(headers = {}) {
  return {
    global: {
      headers,
    },
    realtime: {
      transport: WebSocket,
    },
  };
}

const supabase = createClient(supabaseUrl, serviceRoleKey, buildClientOptions());

function createUserScopedClient(accessToken) {
  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }

  return createClient(supabaseUrl, anonKey, buildClientOptions({
    Authorization: `Bearer ${accessToken}`,
  }));
}

module.exports = supabase;
module.exports.createUserScopedClient = createUserScopedClient;
