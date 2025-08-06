const express = require('express');
const router = express.Router();
const {
  createHealthMetrics,
  getHealthMetrics,
  updateHealthMetrics,
  deleteHealthMetrics,
  getHealthInsights
} = require('../controllers/healthController');
const protect = require('../middleware/authMiddleware');

// All health routes require authentication
router.use(protect);

// Health metrics CRUD operations
router.post('/metrics', createHealthMetrics);
router.get('/metrics', getHealthMetrics);
router.put('/metrics', updateHealthMetrics);
router.delete('/metrics', deleteHealthMetrics);

// Health insights and recommendations
router.get('/insights', getHealthInsights);

module.exports = router; 