const express = require('express');
const router = express.Router();
const {
  addMindfulnessActivity,
  updateMindfulnessActivity,
  completeMindfulnessActivity,
  getDailyMindfulnessActivities,
  getMindfulnessAnalytics,
  deleteMindfulnessActivity,
  getMindfulnessActivitiesByType,
  updateWellnessMetrics
} = require('../controllers/mindfulnessController');
const protect = require('../middleware/authMiddleware');

// All mindfulness routes require authentication
router.use(protect);

// Mindfulness activity management routes
router.post('/add', addMindfulnessActivity);
router.put('/update/:activityId', updateMindfulnessActivity);
router.put('/complete/:activityId', completeMindfulnessActivity);
router.get('/daily/:date', getDailyMindfulnessActivities);
router.get('/analytics', getMindfulnessAnalytics);
router.get('/type/:activityType', getMindfulnessActivitiesByType);
router.put('/wellness/:activityId', updateWellnessMetrics);
router.delete('/:activityId', deleteMindfulnessActivity);

module.exports = router; 