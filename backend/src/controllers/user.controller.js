const User = require('../models/user.model');

/**
 * Get all users
 */
async function getAllUsers(req, res, next) {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (err) {
    next(err);
  }
}

/**
 * Get user by ID
 */
async function getUserById(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllUsers,
  getUserById,
};
