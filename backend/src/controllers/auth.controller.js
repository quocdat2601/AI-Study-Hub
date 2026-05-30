const authService = require('../services/auth.service');

async function register(req, res, next) {
  try {
    const user = await authService.register(req.body);
    res.status(201).json({
      message: 'User registered successfully',
      user,
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    res.json(await authService.login(req.body));
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    res.json(await authService.getCurrentUser(req.user.id));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  getMe
};
