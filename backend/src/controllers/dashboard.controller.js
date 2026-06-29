const dashboardService = require('../services/dashboard.service');

async function getDashboardData(req, res, next) {
  try {
    res.json(await dashboardService.getDashboardData(req.user.id));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboardData
};
