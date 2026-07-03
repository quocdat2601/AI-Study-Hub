const roadMapService = require('../services/roadmap.service');

async function getRoadMap(req, res, next) {
  try {
    res.json(await roadMapService.getRoadMap({
      userId: req.user.id,
      docId: req.params.id,
    }));
  } catch (err) {
    next(err);
  }
}

async function generateRoadMap(req, res, next) {
  try {
    res.status(201).json(await roadMapService.generateRoadMap({
      userId: req.user.id,
      docId: req.params.id,
      goal: req.body?.goal,
    }));
  } catch (err) {
    next(err);
  }
}

async function updateTaskStatus(req, res, next) {
  try {
    res.json(await roadMapService.updateTaskStatus({
      userId: req.user.id,
      docId: req.params.id,
      taskId: req.params.taskId,
      status: req.body?.status,
    }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getRoadMap,
  generateRoadMap,
  updateTaskStatus,
};

