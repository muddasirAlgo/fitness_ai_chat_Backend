const Meal = require('../models/Meal.js');

// Add a meal for a specific date and meal type
async function addMeal(req, res) {
  try {
    const userId = req.user.id;
    const { date, mealType, foodItems, notes } = req.body;

    // Validation
    if (!date || !mealType || !foodItems || !Array.isArray(foodItems) || foodItems.length === 0) {
      return res.status(400).json({
        message: 'Date, meal type, and food items are required'
      });
    }

    if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(mealType)) {
      return res.status(400).json({
        message: 'Meal type must be breakfast, lunch, dinner, or snack'
      });
    }

    // Validate each food item
    for (let i = 0; i < foodItems.length; i++) {
      const item = foodItems[i];
      if (!item.name || !item.calories || !item.quantity || 
          !item.protein || !item.carbs || !item.fat || !item.fiber) {
        return res.status(400).json({
          message: `Food item ${i + 1} is missing required fields: name, calories, quantity, protein, carbs, fat, fiber`
        });
      }

      if (item.calories < 0 || item.quantity < 0 || item.protein < 0 || 
          item.carbs < 0 || item.fat < 0 || item.fiber < 0) {
        return res.status(400).json({
          message: `Food item ${i + 1} has negative values`
        });
      }
    }

    // Parse date
    const mealDate = new Date(date);
    if (isNaN(mealDate.getTime())) {
      return res.status(400).json({
        message: 'Invalid date format'
      });
    }

    // Check if meal already exists for this date and type
    const existingMeal = await Meal.findOne({
      user: userId,
      date: {
        $gte: new Date(mealDate.getFullYear(), mealDate.getMonth(), mealDate.getDate()),
        $lt: new Date(mealDate.getFullYear(), mealDate.getMonth(), mealDate.getDate() + 1)
      },
      mealType: mealType
    });

    if (existingMeal) {
      return res.status(400).json({
        message: `A ${mealType} meal already exists for this date. Use update instead.`
      });
    }

    // Create new meal
    const meal = new Meal({
      user: userId,
      date: mealDate,
      mealType: mealType,
      foodItems: foodItems,
      notes: notes || ''
    });

    await meal.save();

    console.log(`✅ Meal added successfully for ${mealType} on ${date}`);

    res.status(201).json({
      message: `${mealType} meal added successfully`,
      meal: {
        id: meal._id,
        date: meal.date,
        mealType: meal.mealType,
        foodItems: meal.foodItems,
        totalCalories: meal.totalCalories,
        totalProtein: meal.totalProtein,
        totalCarbs: meal.totalCarbs,
        totalFat: meal.totalFat,
        totalFiber: meal.totalFiber,
        notes: meal.notes
      }
    });

  } catch (error) {
    console.error('❌ Add meal error:', error);
    res.status(500).json({
      message: 'Internal server error while adding meal'
    });
  }
}

// Update an existing meal
async function updateMeal(req, res) {
  try {
    const userId = req.user.id;
    const { mealId } = req.params;
    const { foodItems, notes } = req.body;

    if (!foodItems || !Array.isArray(foodItems) || foodItems.length === 0) {
      return res.status(400).json({
        message: 'Food items are required'
      });
    }

    // Validate each food item
    for (let i = 0; i < foodItems.length; i++) {
      const item = foodItems[i];
      if (!item.name || !item.calories || !item.quantity || 
          !item.protein || !item.carbs || !item.fat || !item.fiber) {
        return res.status(400).json({
          message: `Food item ${i + 1} is missing required fields`
        });
      }
    }

    // Find and update meal
    const meal = await Meal.findOneAndUpdate(
      { _id: mealId, user: userId },
      { foodItems: foodItems, notes: notes || '' },
      { new: true, runValidators: true }
    );

    if (!meal) {
      return res.status(404).json({
        message: 'Meal not found'
      });
    }

    console.log(`✅ Meal updated successfully: ${meal.mealType}`);

    res.json({
      message: 'Meal updated successfully',
      meal: {
        id: meal._id,
        date: meal.date,
        mealType: meal.mealType,
        foodItems: meal.foodItems,
        totalCalories: meal.totalCalories,
        totalProtein: meal.totalProtein,
        totalCarbs: meal.totalCarbs,
        totalFat: meal.totalFat,
        totalFiber: meal.totalFiber,
        notes: meal.notes
      }
    });

  } catch (error) {
    console.error('❌ Update meal error:', error);
    res.status(500).json({
      message: 'Internal server error while updating meal'
    });
  }
}

// Get meals for a specific date
async function getMealsByDate(req, res) {
  try {
    const userId = req.user.id;
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({
        message: 'Date parameter is required'
      });
    }

    const mealDate = new Date(date);
    if (isNaN(mealDate.getTime())) {
      return res.status(400).json({
        message: 'Invalid date format'
      });
    }

    const meals = await Meal.getDailyMeals(userId, mealDate);

    console.log(`✅ Retrieved ${meals.length} meals for ${date}`);

    res.json({
      message: 'Meals retrieved successfully',
      date: date,
      meals: meals.map(meal => ({
        id: meal._id,
        mealType: meal.mealType,
        foodItems: meal.foodItems,
        totalCalories: meal.totalCalories,
        totalProtein: meal.totalProtein,
        totalCarbs: meal.totalCarbs,
        totalFat: meal.totalFat,
        totalFiber: meal.totalFiber,
        notes: meal.notes,
        createdAt: meal.createdAt
      }))
    });

  } catch (error) {
    console.error('❌ Get meals by date error:', error);
    res.status(500).json({
      message: 'Internal server error while fetching meals'
    });
  }
}

// Get daily nutrition summary
async function getDailyNutrition(req, res) {
  try {
    const userId = req.user.id;
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({
        message: 'Date parameter is required'
      });
    }

    const mealDate = new Date(date);
    if (isNaN(mealDate.getTime())) {
      return res.status(400).json({
        message: 'Invalid date format'
      });
    }

    const nutritionSummary = await Meal.getDailyNutrition(userId, mealDate);

    console.log(`✅ Retrieved nutrition summary for ${date}`);

    res.json({
      message: 'Daily nutrition summary retrieved successfully',
      date: date,
      summary: nutritionSummary
    });

  } catch (error) {
    console.error('❌ Get daily nutrition error:', error);
    res.status(500).json({
      message: 'Internal server error while fetching nutrition summary'
    });
  }
}

// Delete a meal
async function deleteMeal(req, res) {
  try {
    const userId = req.user.id;
    const { mealId } = req.params;

    const meal = await Meal.findOneAndDelete({ _id: mealId, user: userId });

    if (!meal) {
      return res.status(404).json({
        message: 'Meal not found'
      });
    }

    console.log(`✅ Meal deleted successfully: ${meal.mealType}`);

    res.json({
      message: 'Meal deleted successfully',
      deletedMeal: {
        id: meal._id,
        mealType: meal.mealType,
        date: meal.date
      }
    });

  } catch (error) {
    console.error('❌ Delete meal error:', error);
    res.status(500).json({
      message: 'Internal server error while deleting meal'
    });
  }
}

// Get meals for a date range
async function getMealsByDateRange(req, res) {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: 'Start date and end date are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        message: 'Invalid date format'
      });
    }

    if (start > end) {
      return res.status(400).json({
        message: 'Start date must be before end date'
      });
    }

    const meals = await Meal.find({
      user: userId,
      date: { $gte: start, $lte: end }
    }).sort({ date: 1, mealType: 1 });

    console.log(`✅ Retrieved ${meals.length} meals for date range`);

    res.json({
      message: 'Meals retrieved successfully',
      startDate: startDate,
      endDate: endDate,
      meals: meals.map(meal => ({
        id: meal._id,
        date: meal.date,
        mealType: meal.mealType,
        foodItems: meal.foodItems,
        totalCalories: meal.totalCalories,
        totalProtein: meal.totalProtein,
        totalCarbs: meal.totalCarbs,
        totalFat: meal.totalFat,
        totalFiber: meal.totalFiber,
        notes: meal.notes
      }))
    });

  } catch (error) {
    console.error('❌ Get meals by date range error:', error);
    res.status(500).json({
      message: 'Internal server error while fetching meals'
    });
  }
}

module.exports = {
  addMeal,
  updateMeal,
  getMealsByDate,
  getDailyNutrition,
  deleteMeal,
  getMealsByDateRange
}; 