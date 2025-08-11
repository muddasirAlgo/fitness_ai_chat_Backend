const express = require('express');
const router = express.Router();
const {
  addMeal,
  updateMeal,
  getMealsByDate,
  getDailyNutrition,
  deleteMeal,
  getMealsByDateRange
} = require('../controllers/mealController');
const protect = require('../middleware/authMiddleware');

// All meal routes require authentication
router.use(protect);

// Meal management routes
router.post('/add', addMeal);
router.put('/update/:mealId', updateMeal);
router.get('/date/:date', getMealsByDate);
router.get('/nutrition/:date', getDailyNutrition);
router.delete('/:mealId', deleteMeal);
router.get('/range', getMealsByDateRange);

module.exports = router; 