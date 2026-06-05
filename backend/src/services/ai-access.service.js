const { createUserScopedClient } = require('../config/supabase');
const createError = require('../utils/createError');

function getAccessTokenFromAuthHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError(401, 'Missing or invalid token');
  }

  return authHeader.split(' ')[1];
}

function createAiCallerContext({ authHeader, userId }) {
  if (!userId) {
    throw createError(401, 'Missing authenticated user context');
  }

  const accessToken = getAccessTokenFromAuthHeader(authHeader);

  return {
    userId,
    accessToken,
    supabase: createUserScopedClient(accessToken),
  };
}

module.exports = {
  getAccessTokenFromAuthHeader,
  createAiCallerContext,
};
