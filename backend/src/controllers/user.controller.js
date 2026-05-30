const userService = require('../services/user.service');

/**
 * Get all users
 */
async function getAllUsers(req, res, next) {
  try {
    res.json(await userService.listUsers());
  } catch (err) {
    next(err);
  }
}

/**
 * Get user by ID
 */
async function getUserById(req, res, next) {
  try {
    res.json(await userService.getUserById(req.params.id));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllUsers,
  getUserById,
};
