const express = require('express');
const router = express.Router();
const {
  addWorkout,
  updateWorkout,
  completeWorkout,
  getWorkoutsByDate,
  getDailyWorkoutSummary,
  deleteWorkout,
  getWorkoutStats
} = require('../controllers/workoutController');
const protect = require('../middleware/authMiddleware');

// All workout routes require authentication
router.use(protect);

// Workout management routes
router.post('/add', addWorkout);
router.put('/update/:workoutId', updateWorkout);
router.put('/complete/:workoutId', completeWorkout);
router.get('/date/:date', getWorkoutsByDate);
router.get('/summary/:date', getDailyWorkoutSummary);
router.delete('/:workoutId', deleteWorkout);
router.get('/stats', getWorkoutStats);

module.exports = router; 