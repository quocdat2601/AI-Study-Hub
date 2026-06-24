
function requireRole(...roles) {
  const allowed = new Set(roles.flatMap((role) => {
    if (role === 'student' || role === 'user') return ['user'];
    return [role];
  }));

  return function roleMiddleware(req, res, next) {
    const role = req.user?.role === 'student' ? 'user' : req.user?.role;
    if (!req.user || !allowed.has(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

const MEMBER_ROLES = ['user', 'student', 'admin'];

module.exports = requireRole;
module.exports.MEMBER_ROLES = MEMBER_ROLES;
