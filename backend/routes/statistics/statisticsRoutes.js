const express = require('express');
const router = express.Router();

const {
  getMonthlyStatistics,
  getDashboardSummary
} = require('../../controllers/statistics/statisticsController');

const { authenticate, authorize } = require('../../middleware/auth');

// Protect all routes with Admin authorization
router.use(authenticate, authorize('Admin'));

// Get monthly statistics
router.get('/monthly', getMonthlyStatistics);

// Get dashboard summary
router.get('/dashboard', getDashboardSummary);

module.exports = router;
