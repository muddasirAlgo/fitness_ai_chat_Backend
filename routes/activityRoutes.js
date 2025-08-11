const express = require('express');
const router = express.Router();
const {
  addActivity,
  updateActivity,
  completeActivity,
  getDailyActivities,
  getActivityAnalytics,
  deleteActivity,
  getActivitiesByType
} = require('../controllers/activityController');
const protect = require('../middleware/authMiddleware');

// All activity routes require authentication
router.use(protect);
 
// Activity management routes
router.post('/add', addActivity);
router.put('/update/:activityId', updateActivity);
router.put('/complete/:activityId', completeActivity);
router.get('/daily/:date', getDailyActivities);
router.get('/analytics', getActivityAnalytics);
router.get('/type/:activityType', getActivitiesByType);
router.delete('/:activityId', deleteActivity);

module.exports = router; 