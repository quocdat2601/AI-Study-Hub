const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('../models/user.model');
const activityService = require('./activity.service');
const createError = require('../utils/createError');
const { publicUser } = require('./user.service');

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function register({ email, password }) {
  const normalizedEmail = normalizeEmail(email);

  if (!validateEmail(normalizedEmail)) {
    throw createError(400, 'Please enter a valid email address');
  }

  if (!password || password.length < 8) {
    throw createError(400, 'Password must be at least 8 characters');
  }

  const existingUser = await userModel.findByEmail(normalizedEmail);
  if (existingUser) {
    throw createError(409, 'Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await userModel.create({
    email: normalizedEmail,
    password_hash: passwordHash,
    role: 'student',
  });
  activityService.log({
    userId: user.id,
    action: 'auth.register',
    targetType: 'user',
    targetId: user.id,
  });

  return publicUser(user);
}

async function login({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const user = await userModel.findByEmail(normalizedEmail);

  if (!user) {
    throw createError(401, 'Invalid email or password');
  }

  if (user.status === 'disabled') {
    throw createError(403, 'Account suspended');
  }

  const isValidPassword = await bcrypt.compare(password || '', user.password_hash);
  if (!isValidPassword) {
    throw createError(401, 'Invalid email or password');
  }

  await userModel.updateLastLogin(user.id);
  activityService.log({
    userId: user.id,
    action: 'auth.login',
    targetType: 'user',
    targetId: user.id,
  });

  return {
    token: signToken(user),
    user: publicUser(user),
  };
}

async function getCurrentUser(id) {
  const user = await userModel.findById(id);

  if (!user || user.status === 'disabled') {
    throw createError(401, 'Invalid or expired token');
  }

  return publicUser(user);
}

module.exports = {
  register,
  login,
  getCurrentUser,
};
