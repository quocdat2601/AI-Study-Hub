function resolveRole(role) {
  if (role === 'user') return 'student';
  return role;
}

function requireRole(...roles) {
  return function roleMiddleware(req, res, next) {
    const role = resolveRole(req.user?.role);
    if (!req.user || !roles.includes(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

module.exports = requireRole;
