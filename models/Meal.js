const mongoose = require('mongoose');

const foodItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  calories: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  protein: {
    type: Number,
    required: true,
    min: 0
  },
  carbs: {
    type: Number,
    required: true,
    min: 0
  },
  fat: {
    type: Number,
    required: true,
    min: 0
  },
  fiber: {
    type: Number,
    required: true,
    min: 0
  }
});

const mealSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  mealType: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner', 'snack'],
    required: true
  },
  foodItems: [foodItemSchema],
  totalCalories: {
    type: Number,
    default: 0
  },
  totalProtein: {
    type: Number,
    default: 0
  },
  totalCarbs: {
    type: Number,
    default: 0
  },
  totalFat: {
    type: Number,
    default: 0
  },
  totalFiber: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

// Index for faster queries
mealSchema.index({ user: 1, date: 1, mealType: 1 });

// Pre-save middleware to calculate totals
mealSchema.pre('save', function(next) {
  if (this.foodItems && this.foodItems.length > 0) {
    this.totalCalories = this.foodItems.reduce((sum, item) => sum + item.calories, 0);
    this.totalProtein = this.foodItems.reduce((sum, item) => sum + item.protein, 0);
    this.totalCarbs = this.foodItems.reduce((sum, item) => sum + item.carbs, 0);
    this.totalFat = this.foodItems.reduce((sum, item) => sum + item.fat, 0);
    this.totalFiber = this.foodItems.reduce((sum, item) => sum + item.fiber, 0);
  }
  next();
});

// Static method to get daily meals summary
mealSchema.statics.getDailyMeals = async function(userId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.find({
    user: userId,
    date: { $gte: startOfDay, $lte: endOfDay }
  }).sort({ mealType: 1, createdAt: 1 });
};

// Static method to get daily nutrition summary
mealSchema.statics.getDailyNutrition = async function(userId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const meals = await this.find({
    user: userId,
    date: { $gte: startOfDay, $lte: endOfDay }
  });

  const summary = {
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    totalFiber: 0,
    mealCount: meals.length,
    meals: {}
  };

  meals.forEach(meal => {
    summary.totalCalories += meal.totalCalories;
    summary.totalProtein += meal.totalProtein;
    summary.totalCarbs += meal.totalCarbs;
    summary.totalFat += meal.totalFat;
    summary.totalFiber += meal.totalFiber;
    
    if (!summary.meals[meal.mealType]) {
      summary.meals[meal.mealType] = [];
    }
    summary.meals[meal.mealType].push(meal);
  });

  return summary;
};

module.exports = mongoose.model('Meal', mealSchema); 