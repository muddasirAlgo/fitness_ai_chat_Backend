const express = require('express');
const router = express.Router();
const {
  addWaterEntry,
  addSleepData,
  getDailyData,
  updateWaterGoal,
  getWeeklySummary,
  deleteWaterEntry
} = require('../controllers/waterSleepController');
const protect = require('../middleware/authMiddleware');

// All water and sleep routes require authentication
router.use(protect);

// Water and sleep management routes
router.post('/water/add', addWaterEntry);
router.post('/sleep/add', addSleepData);
router.get('/daily/:date', getDailyData);
router.put('/water/goal', updateWaterGoal);
router.get('/weekly', getWeeklySummary);
router.delete('/water/:date/:entryIndex', deleteWaterEntry);

module.exports = router; 