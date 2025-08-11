const mongoose = require('mongoose');

const waterEntrySchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: 0.1,
    max: 10 // Maximum 10L per entry
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  }
});

const sleepSchema = new mongoose.Schema({
  sleepHours: {
    type: Number,
    required: true,
    min: 0.5,
    max: 24
  },
  sleepQuality: {
    type: String,
    enum: ['poor', 'fair', 'good', 'excellent'],
    required: true
  },
  bedTime: {
    type: Date,
    required: true
  },
  wakeupTime: {
    type: Date,
    required: true
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  }
});

const waterSleepSchema = new mongoose.Schema({
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
  waterEntries: [waterEntrySchema],
  totalWaterIntake: {
    type: Number,
    default: 0
  },
  waterGoal: {
    type: Number,
    default: 2.5, // Default 2.5L daily goal
    min: 0.5,
    max: 10
  },
  sleep: sleepSchema,
  waterIntakePercentage: {
    type: Number,
    default: 0
  },
  sleepAnalysis: {
    type: String,
    enum: ['insufficient', 'adequate', 'optimal'],
    default: 'adequate'
  }
}, {
  timestamps: true
});

// Index for faster queries
waterSleepSchema.index({ user: 1, date: 1 });

// Pre-save middleware to calculate totals and percentages
waterSleepSchema.pre('save', function(next) {
  // Calculate total water intake
  if (this.waterEntries && this.waterEntries.length > 0) {
    this.totalWaterIntake = this.waterEntries.reduce((sum, entry) => sum + entry.amount, 0);
  }

  // Calculate water intake percentage
  if (this.waterGoal > 0) {
    this.waterIntakePercentage = Math.round((this.totalWaterIntake / this.waterGoal) * 100);
  }

  // Analyze sleep quality
  if (this.sleep && this.sleep.sleepHours) {
    if (this.sleep.sleepHours < 6) {
      this.sleepAnalysis = 'insufficient';
    } else if (this.sleep.sleepHours >= 6 && this.sleep.sleepHours <= 8) {
      this.sleepAnalysis = 'adequate';
    } else {
      this.sleepAnalysis = 'optimal';
    }
  }

  next();
});

// Static method to get daily water and sleep data
waterSleepSchema.statics.getDailyData = async function(userId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.findOne({
    user: userId,
    date: { $gte: startOfDay, $lte: endOfDay }
  });
};

// Static method to get weekly summary
waterSleepSchema.statics.getWeeklySummary = async function(userId, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const data = await this.find({
    user: userId,
    date: { $gte: start, $lte: end }
  }).sort({ date: 1 });

  const summary = {
    totalDays: data.length,
    averageWaterIntake: 0,
    averageSleepHours: 0,
    averageWaterIntakePercentage: 0,
    sleepQualityBreakdown: {
      poor: 0,
      fair: 0,
      good: 0,
      excellent: 0
    },
    sleepAnalysisBreakdown: {
      insufficient: 0,
      adequate: 0,
      optimal: 0
    },
    dailyData: []
  };

  if (data.length > 0) {
    let totalWater = 0;
    let totalSleep = 0;
    let totalWaterPercentage = 0;

    data.forEach(day => {
      totalWater += day.totalWaterIntake;
      totalSleep += day.sleep ? day.sleep.sleepHours : 0;
      totalWaterPercentage += day.waterIntakePercentage;

      if (day.sleep && day.sleep.sleepQuality) {
        summary.sleepQualityBreakdown[day.sleep.sleepQuality]++;
      }

      if (day.sleepAnalysis) {
        summary.sleepAnalysisBreakdown[day.sleepAnalysis]++;
      }

      summary.dailyData.push({
        date: day.date,
        waterIntake: day.totalWaterIntake,
        waterGoal: day.waterGoal,
        waterPercentage: day.waterIntakePercentage,
        sleepHours: day.sleep ? day.sleep.sleepHours : 0,
        sleepQuality: day.sleep ? day.sleep.sleepQuality : null,
        sleepAnalysis: day.sleepAnalysis
      });
    });

    summary.averageWaterIntake = Number((totalWater / data.length).toFixed(2));
    summary.averageSleepHours = Number((totalSleep / data.length).toFixed(2));
    summary.averageWaterIntakePercentage = Math.round(totalWaterPercentage / data.length);
  }

  return summary;
};

// Method to add water entry
waterSleepSchema.methods.addWaterEntry = function(amount, notes = '') {
  this.waterEntries.push({
    amount: Number(amount),
    notes: notes.trim()
  });
  return this.save();
};

// Method to update water goal
waterSleepSchema.methods.updateWaterGoal = function(newGoal) {
  this.waterGoal = Number(newGoal);
  return this.save();
};

// Method to add/update sleep data
waterSleepSchema.methods.updateSleep = function(sleepData) {
  this.sleep = sleepData;
  return this.save();
};

module.exports = mongoose.model('WaterSleep', waterSleepSchema); 