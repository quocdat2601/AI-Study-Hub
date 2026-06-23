const crypto = require('crypto');
const supabase = require('../config/supabase');
const decodeJwtPayload = require('./decodeJwt');

async function buildOptionalViewerContext(req) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const payload = decodeJwtPayload(token);

    if (payload && payload.exp && Date.now() < payload.exp * 1000) {
      try {
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data?.user?.id) {
          return {
            userId: data.user.id,
            viewerKey: `user:${data.user.id}`,
          };
        }
      } catch (_) {
        // Fall through to guest fingerprinting.
      }
    }
  }

  const forwardedFor = Array.isArray(req.headers['x-forwarded-for'])
    ? req.headers['x-forwarded-for'][0]
    : String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwardedFor || req.ip || req.socket?.remoteAddress || 'unknown';
  const userAgent = String(req.headers['user-agent'] || 'unknown');
  const acceptLanguage = String(req.headers['accept-language'] || '');
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${ip}|${userAgent}|${acceptLanguage}`)
    .digest('hex');

  return { viewerKey: `guest:${fingerprint}` };
}

module.exports = buildOptionalViewerContext;
