const express = require('express');
const router = express.Router();
const {
  addDailyMetrics,
  getDailyMetrics,
  getMetricsAnalytics,
  updateWaterGoal,
  deleteDailyMetrics,
  getMetricsByFeeling
} = require('../controllers/dailyMetricsController');
const protect = require('../middleware/authMiddleware');

// All daily metrics routes require authentication
router.use(protect);

// Daily metrics management routes
router.post('/add', addDailyMetrics);
router.get('/daily/:date', getDailyMetrics);
router.get('/analytics', getMetricsAnalytics);
router.put('/water-goal', updateWaterGoal);
router.get('/feeling/:feeling', getMetricsByFeeling);
router.delete('/:date', deleteDailyMetrics);

module.exports = router; 