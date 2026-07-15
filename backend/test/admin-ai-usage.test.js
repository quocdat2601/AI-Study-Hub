const assert = require('node:assert/strict');
const test = require('node:test');

process.env.SUPABASE_URL ||= 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

const aiUsageModel = require('../src/models/ai-usage.model');
const adminService = require('../src/services/admin.service');
const aiUsageService = require('../src/services/ai-usage.service');
const supabase = require('../src/config/supabase');

test('Admin AI Usage & Cost Monitoring — aggregations and service overview', async (t) => {
  // Mock data for logs
  const mockLogs = [
    {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      request_count: 5,
      total_tokens: 5000,
      success: true,
      user_id: 'user-1',
      created_at: new Date().toISOString(),
      users: { email: 'student1@test.com' }
    },
    {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      request_count: 2,
      total_tokens: 2000,
      success: false,
      user_id: 'user-1',
      created_at: new Date().toISOString(),
      users: { email: 'student1@test.com' }
    },
    {
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
      request_count: 10,
      total_tokens: 8000,
      success: true,
      user_id: 'user-2',
      created_at: new Date().toISOString(),
      users: { email: 'student2@test.com' }
    }
  ];

  // Mock supabase requests
  t.mock.method(supabase, 'from', () => {
    return {
      select: () => {
        return {
          gte: () => {
            return Promise.resolve({ data: mockLogs, error: null });
          }
        };
      }
    };
  });

  // Mock aiUsageService.getUsage
  t.mock.method(aiUsageService, 'getUsage', async ({ model }) => {
    return {
      model,
      provider: 'gemini',
      limits: { rpm: 15, tpm: 1000000, rpd: 1500 },
      used: { requestsThisMinute: 0, tokensThisMinute: 0, requestsToday: 12 },
      remaining: { requestsThisMinute: 15, tokensThisMinute: 1000000, requestsToday: 1488 }
    };
  });

  // 1. Check aggregateByModel
  const byModel = await aiUsageModel.aggregateByModel({ since: new Date() });
  assert.equal(byModel.length, 2);

  const geminiFlash = byModel.find(g => g.model === 'gemini-2.5-flash');
  assert.ok(geminiFlash);
  assert.equal(geminiFlash.total_requests, 7);
  assert.equal(geminiFlash.total_tokens, 7000);
  assert.equal(geminiFlash.error_count, 1);

  const geminiLite = byModel.find(g => g.model === 'gemini-2.5-flash-lite');
  assert.ok(geminiLite);
  assert.equal(geminiLite.total_requests, 10);
  assert.equal(geminiLite.total_tokens, 8000);
  assert.equal(geminiLite.error_count, 0);

  // 2. Check topUsersToday
  const topUsers = await aiUsageModel.topUsersToday(10);
  assert.equal(topUsers.length, 2);
  assert.equal(topUsers[0].user_id, 'user-2'); // student2 has 10 requests, student1 has 7
  assert.equal(topUsers[0].request_count, 10);
  assert.equal(topUsers[0].email, 'student2@test.com');

  assert.equal(topUsers[1].user_id, 'user-1');
  assert.equal(topUsers[1].request_count, 7);
  assert.equal(topUsers[1].email, 'student1@test.com');

  // 3. Check getAiUsageOverview
  const overview = await adminService.getAiUsageOverview();
  assert.ok(overview.byModel);
  assert.ok(overview.topUsers);
  assert.ok(overview.requestsPerDay);
  assert.ok(overview.liveQuota);
  assert.equal(overview.liveQuota.length > 0, true);
  assert.equal(overview.liveQuota[0].model, 'gemini-2.5-flash');
});
