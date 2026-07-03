const supabase = require('../config/supabase');
const authService = require('../services/auth.service');
const decodeJwtPayload = require('../utils/decodeJwt');


/**
 * Authentication Middleware
 * Intercepts Bearer tokens, decrypts/decodes JWTs locally as a fast exp check DoS guard,
 * then validates against Supabase and synchronizes the caller's profile.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {Function} next - Express next middleware.
 */
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing or invalid token',
      code: 'AUTH_MISSING_TOKEN',
    });
  }

  const token = authHeader.split(' ')[1];

  // Fast exp check local base64 JWT decode.
  // Acts as a DoS guard preventing unnecessary remote calls to Supabase API.
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp || Date.now() >= payload.exp * 1000) {
    return res.status(401).json({
      error: 'Invalid or expired token',
      code: 'AUTH_INVALID_OR_EXPIRED_TOKEN',
    });
  }

  try {
    // Validate session token cryptographically via Supabase Auth service.
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({
        error: 'Invalid or expired token',
        code: 'AUTH_INVALID_OR_EXPIRED_TOKEN',
      });
    }

    // Sync remote auth user info with the local DB users profile mapping.
    req.user = await authService.syncUserProfile(data.user);
    next();
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      error: err.publicMessage || err.message || 'Authentication failed',
      code: err.code || 'AUTH_FAILED',
    });
  }
}

module.exports = verifyToken;
