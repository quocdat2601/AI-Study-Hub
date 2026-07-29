const announcementModel = require('../models/announcement.model');

async function createAnnouncement(req, res, next) {
  try {
    const { title, message, targetRole } = req.body;
    const createdBy = req.user.id;
    const data = await announcementModel.create({ title, message, targetRole, createdBy });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

async function listAnnouncements(req, res, next) {
  try {
    const data = await announcementModel.findAll();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function deleteAnnouncement(req, res, next) {
  try {
    await announcementModel.delete(req.params.id);
    res.json({ message: 'Announcement deleted successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createAnnouncement,
  listAnnouncements,
  deleteAnnouncement,
};
