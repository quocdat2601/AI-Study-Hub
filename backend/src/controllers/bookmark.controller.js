const Bookmark = require('../models/bookmark.model');

async function getAllBookmarks(req, res, next) {
  try {
    const userId = req.user.id;
    const bookmarks = await Bookmark.findByUserId(userId);
    res.json(bookmarks);
  } catch (err) {
    next(err);
  }
}

async function addBookmark(req, res, next) {
  try {
    const userId = req.user.id;
    const { docId } = req.params;
    const bookmark = await Bookmark.create(userId, docId);
    res.status(201).json(bookmark);
  } catch (err) {
    next(err);
  }
}

async function removeBookmark(req, res, next) {
  try {
    const userId = req.user.id;
    const { docId } = req.params;
    await Bookmark.delete(userId, docId);
    res.json({ message: 'Bookmark removed' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllBookmarks,
  addBookmark,
  removeBookmark
};
