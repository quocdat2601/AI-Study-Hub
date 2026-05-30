const bookmarkService = require('../services/bookmark.service');

async function getAllBookmarks(req, res, next) {
  try {
    res.json(await bookmarkService.listBookmarks(req.user.id));
  } catch (err) {
    next(err);
  }
}

async function addBookmark(req, res, next) {
  try {
    res.status(201).json(await bookmarkService.addBookmark({
      userId: req.user.id,
      docId: req.params.docId,
    }));
  } catch (err) {
    next(err);
  }
}

async function removeBookmark(req, res, next) {
  try {
    res.json(await bookmarkService.removeBookmark({
      userId: req.user.id,
      docId: req.params.docId,
    }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllBookmarks,
  addBookmark,
  removeBookmark
};
