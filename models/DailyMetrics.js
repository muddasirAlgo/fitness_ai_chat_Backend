const mongoose = require('mongoose');

const dailyMetricsSchema = new mongoose.Schema({
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
  // Physical Activity Metrics
  steps: {
    type: Number,
    min: 0,
    max: 100000,
    default: 0
  },
  caloriesBurned: {
    type: Number,
    min: 0,
    max: 10000,
    default: 0
  },
  // Health Metrics
  waterIntake: {
    type: Number,
    min: 0,
    max: 20, // Maximum 20L per day
    default: 0
  },
  sleepHours: {
    type: Number,
    min: 0,
    max: 24,
    default: 0
  },
  weight: {
    type: Number,
    min: 20,
    max: 500, // kg
    default: null
  },
  // Activity Details - Array of activities
  activities: [{
    activityType: {
      type: String,
      enum: ['walking', 'running', 'cycling', 'hiking', 'swimming', 'gym_workout', 'yoga', 'pilates', 'meditation', 'breathing', 'other'],
      required: true
    },
    duration: {
      type: Number,
      min: 1,
      max: 1440, // Maximum 24 hours in minutes
      required: true
    },
    intensityLevel: {
      type: String,
      enum: ['very_low', 'low', 'moderate', 'high', 'very_high'],
      default: 'moderate'
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    }
  }],
  // Legacy fields for backward compatibility (will be deprecated)
  activityType: {
    type: String,
    enum: ['walking', 'running', 'cycling', 'hiking', 'swimming', 'gym_workout', 'yoga', 'pilates', 'meditation', 'breathing', 'other'],
    default: null
  },
  duration: {
    type: Number,
    min: 0,
    max: 1440, // Maximum 24 hours in minutes
    default: 0
  },
  intensityLevel: {
    type: String,
    enum: ['very_low', 'low', 'moderate', 'high', 'very_high'],
    default: 'moderate'
  },
  // Wellness Metrics
  howAreYouFeeling: {
    type: String,
    enum: ['great', 'good', 'okay', 'bad', 'terrible'],
    required: true
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  // Calculated Metrics
  bmi: {
    type: Number,
    min: 10,
    max: 100,
    default: null
  },
  waterGoal: {
    type: Number,
    min: 0.5,
    max: 10,
    default: 2.5 // Default 2.5L daily goal
  },
  waterIntakePercentage: {
    type: Number,
    min: 0,
    max: 200,
    default: 0
  },
  sleepQuality: {
    type: String,
    enum: ['insufficient', 'adequate', 'optimal'],
    default: 'adequate'
  },
  activityScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  overallWellnessScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  }
}, {
  timestamps: true
});

// Index for faster queries
dailyMetricsSchema.index({ user: 1, date: 1 });
dailyMetricsSchema.index({ user: 1, howAreYouFeeling: 1 });

// Pre-save middleware to calculate derived metrics
dailyMetricsSchema.pre('save', function(next) {
  // Calculate water intake percentage
  if (this.waterGoal > 0) {
    this.waterIntakePercentage = Math.round((this.waterIntake / this.waterGoal) * 100);
  }

  // Analyze sleep quality
  if (this.sleepHours > 0) {
    if (this.sleepHours < 6) {
      this.sleepQuality = 'insufficient';
    } else if (this.sleepHours >= 6 && this.sleepHours <= 8) {
      this.sleepQuality = 'adequate';
    } else {
      this.sleepQuality = 'optimal';
    }
  }

  // Calculate activity score based on steps, duration, and intensity
  let activityScore = 0;
  
  // Steps contribution (0-40 points)
  if (this.steps >= 10000) {
    activityScore += 40;
  } else if (this.steps >= 8000) {
    activityScore += 30;
  } else if (this.steps >= 6000) {
    activityScore += 20;
  } else if (this.steps >= 4000) {
    activityScore += 10;
  }

  // Activities contribution (0-60 points)
  if (this.activities && this.activities.length > 0) {
    let totalDuration = 0;
    let totalIntensityScore = 0;
    
    this.activities.forEach(activity => {
      totalDuration += activity.duration || 0;
      
      // Intensity contribution per activity
      const intensityScores = {
        'very_low': 5,
        'low': 10,
        'moderate': 20,
        'high': 25,
        'very_high': 30
      };
      totalIntensityScore += intensityScores[activity.intensityLevel] || 0;
    });
    
    // Duration contribution (0-30 points)
    if (totalDuration >= 60) {
      activityScore += 30;
    } else if (totalDuration >= 45) {
      activityScore += 25;
    } else if (totalDuration >= 30) {
      activityScore += 20;
    } else if (totalDuration >= 15) {
      activityScore += 10;
    }
    
    // Average intensity contribution (0-30 points)
    const avgIntensityScore = totalIntensityScore / this.activities.length;
    activityScore += Math.min(30, avgIntensityScore);
  }

  this.activityScore = Math.min(100, activityScore);

  // Calculate overall wellness score
  let wellnessScore = 0;
  
  // Feeling contribution (0-25 points)
  const feelingScores = {
          'terrible': 0,
      'bad': 5,
      'okay': 15,
      'good': 20,
      'great': 25
  };
  wellnessScore += feelingScores[this.howAreYouFeeling] || 0;

  // Sleep contribution (0-25 points)
  if (this.sleepHours >= 7 && this.sleepHours <= 9) {
    wellnessScore += 25;
  } else if (this.sleepHours >= 6 && this.sleepHours <= 10) {
    wellnessScore += 20;
  } else if (this.sleepHours >= 5 && this.sleepHours <= 11) {
    wellnessScore += 15;
  } else if (this.sleepHours > 0) {
    wellnessScore += 10;
  }

  // Water contribution (0-25 points)
  if (this.waterIntakePercentage >= 100) {
    wellnessScore += 25;
  } else if (this.waterIntakePercentage >= 80) {
    wellnessScore += 20;
  } else if (this.waterIntakePercentage >= 60) {
    wellnessScore += 15;
  } else if (this.waterIntakePercentage >= 40) {
    wellnessScore += 10;
  } else if (this.waterIntakePercentage > 0) {
    wellnessScore += 5;
  }

  // Activity contribution (0-25 points)
  wellnessScore += Math.round((this.activityScore / 100) * 25);

  this.overallWellnessScore = Math.min(100, wellnessScore);

  next();
});

// Static method to get daily metrics
dailyMetricsSchema.statics.getDailyMetrics = async function(userId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.findOne({
    user: userId,
    date: { $gte: startOfDay, $lte: endOfDay }
  });
};

// Static method to get daily metrics summary
dailyMetricsSchema.statics.getDailyMetricsSummary = async function(userId, date) {
  const dailyMetrics = await this.getDailyMetrics(userId, date);

  if (!dailyMetrics) {
    return {
      date: date,
      hasData: false,
      summary: {
        steps: 0,
        caloriesBurned: 0,
        waterIntake: 0,
        waterGoal: 2.5,
        waterIntakePercentage: 0,
        sleepHours: 0,
        sleepQuality: 'adequate',
        weight: null,
        activities: [],
        howAreYouFeeling: null,
        activityScore: 0,
        overallWellnessScore: 0
      },
      recommendations: [
        'Start tracking your daily metrics',
        'Set a daily step goal',
        'Establish a water intake routine',
        'Track your sleep patterns',
        'Monitor your mood and energy levels'
      ]
    };
  }

  // Generate personalized recommendations
  const recommendations = [];
  
  if (dailyMetrics.steps < 8000) {
    recommendations.push('Try to increase your daily steps to 8,000-10,000 for better health');
  } else if (dailyMetrics.steps >= 10000) {
    recommendations.push('Great job! You\'ve exceeded the daily step goal');
  }

  if (dailyMetrics.waterIntakePercentage < 80) {
    recommendations.push('Increase your water intake to meet your daily goal');
  } else if (dailyMetrics.waterIntakePercentage >= 100) {
    recommendations.push('Excellent! You\'ve met your water intake goal');
  }

  if (dailyMetrics.sleepHours < 6) {
    recommendations.push('Consider getting more sleep for better recovery and health');
  } else if (dailyMetrics.sleepHours > 9) {
    recommendations.push('You\'re getting plenty of sleep, which is great!');
  }

  if (dailyMetrics.howAreYouFeeling === 'terrible' || dailyMetrics.howAreYouFeeling === 'bad') {
    recommendations.push('Consider practicing mindfulness or talking to someone about how you\'re feeling');
  }

  if (dailyMetrics.activityScore < 50) {
    recommendations.push('Try to increase your daily physical activity');
  }

  return {
    date: date,
    hasData: true,
    summary: {
      steps: dailyMetrics.steps,
      caloriesBurned: dailyMetrics.caloriesBurned,
      waterIntake: dailyMetrics.waterIntake,
      waterGoal: dailyMetrics.waterGoal,
      waterIntakePercentage: dailyMetrics.waterIntakePercentage,
      sleepHours: dailyMetrics.sleepHours,
      sleepQuality: dailyMetrics.sleepQuality,
      weight: dailyMetrics.weight,
      activities: dailyMetrics.activities,
      howAreYouFeeling: dailyMetrics.howAreYouFeeling,
      activityScore: dailyMetrics.activityScore,
      overallWellnessScore: dailyMetrics.overallWellnessScore
    },
    recommendations: recommendations
  };
};

// Static method to get weekly/monthly metrics analytics
dailyMetricsSchema.statics.getMetricsAnalytics = async function(userId, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const metrics = await this.find({
    user: userId,
    date: { $gte: start, $lte: end }
  }).sort({ date: 1 });

  const analytics = {
    period: {
      startDate: startDate,
      endDate: endDate,
      totalDays: Math.ceil((end - start) / (1000 * 60 * 60 * 24))
    },
    summary: {
      totalDays: metrics.length,
      averageSteps: 0,
      averageCaloriesBurned: 0,
      averageWaterIntake: 0,
      averageSleepHours: 0,
      averageActivityScore: 0,
      averageWellnessScore: 0
    },
    dailyBreakdown: {},
    trends: {
      stepsTrend: 'stable',
      waterTrend: 'stable',
      sleepTrend: 'stable',
      wellnessTrend: 'stable',
      mostActiveDay: null,
      bestFeelingDay: null
    },
    insights: {
      consistencyScore: 0,
      improvementAreas: [],
      strengths: [],
      recommendations: []
    }
  };

  if (metrics.length > 0) {
    let totalSteps = 0;
    let totalCalories = 0;
    let totalWater = 0;
    let totalSleep = 0;
    let totalActivityScore = 0;
    let totalWellnessScore = 0;
    const dayMetrics = {};

    metrics.forEach(metric => {
      totalSteps += metric.steps;
      totalCalories += metric.caloriesBurned;
      totalWater += metric.waterIntake;
      totalSleep += metric.sleepHours;
      totalActivityScore += metric.activityScore;
      totalWellnessScore += metric.overallWellnessScore;

      // Daily breakdown
      const dayKey = metric.date.toISOString().split('T')[0];
      if (!dayMetrics[dayKey]) {
        dayMetrics[dayKey] = {
          steps: 0,
          caloriesBurned: 0,
          waterIntake: 0,
          sleepHours: 0,
          activityScore: 0,
          wellnessScore: 0,
          feeling: metric.howAreYouFeeling
        };
      }
      dayMetrics[dayKey].steps += metric.steps;
      dayMetrics[dayKey].caloriesBurned += metric.caloriesBurned;
      dayMetrics[dayKey].waterIntake += metric.waterIntake;
      dayMetrics[dayKey].sleepHours += metric.sleepHours;
      dayMetrics[dayKey].activityScore += metric.activityScore;
      dayMetrics[dayKey].wellnessScore += metric.overallWellnessScore;
    });

    // Calculate averages
    analytics.summary.averageSteps = Math.round(totalSteps / metrics.length);
    analytics.summary.averageCaloriesBurned = Math.round(totalCalories / metrics.length);
    analytics.summary.averageWaterIntake = Number((totalWater / metrics.length).toFixed(2));
    analytics.summary.averageSleepHours = Number((totalSleep / metrics.length).toFixed(2));
    analytics.summary.averageActivityScore = Math.round(totalActivityScore / metrics.length);
    analytics.summary.averageWellnessScore = Math.round(totalWellnessScore / metrics.length);

    // Daily breakdown
    analytics.dailyBreakdown = dayMetrics;

    // Find trends
    const firstHalf = metrics.slice(0, Math.ceil(metrics.length / 2));
    const secondHalf = metrics.slice(Math.ceil(metrics.length / 2));

    const firstHalfAvgSteps = firstHalf.reduce((sum, m) => sum + m.steps, 0) / firstHalf.length;
    const secondHalfAvgSteps = secondHalf.reduce((sum, m) => sum + m.steps, 0) / secondHalf.length;
    
    if (secondHalfAvgSteps > firstHalfAvgSteps * 1.1) {
      analytics.trends.stepsTrend = 'improving';
    } else if (secondHalfAvgSteps < firstHalfAvgSteps * 0.9) {
      analytics.trends.stepsTrend = 'declining';
    }

    // Find most active and best feeling days
    let maxSteps = 0;
    let maxWellness = 0;
    let mostActiveDay = null;
    let bestFeelingDay = null;

    Object.entries(dayMetrics).forEach(([day, data]) => {
      if (data.steps > maxSteps) {
        maxSteps = data.steps;
        mostActiveDay = day;
      }
      if (data.wellnessScore > maxWellness) {
        maxWellness = data.wellnessScore;
        bestFeelingDay = day;
      }
    });

    analytics.trends.mostActiveDay = mostActiveDay;
    analytics.trends.bestFeelingDay = bestFeelingDay;

    // Calculate consistency score
    const totalPeriodDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    analytics.insights.consistencyScore = Math.round((metrics.length / totalPeriodDays) * 100);

    // Generate insights
    if (analytics.summary.averageSteps < 6000) {
      analytics.insights.improvementAreas.push('Increase daily step count');
    }
    if (analytics.summary.averageWaterIntake < 2.0) {
      analytics.insights.improvementAreas.push('Improve water intake');
    }
    if (analytics.summary.averageSleepHours < 7) {
      analytics.insights.improvementAreas.push('Get more sleep');
    }

    if (analytics.summary.averageSteps >= 8000) {
      analytics.insights.strengths.push('Good physical activity level');
    }
    if (analytics.summary.averageWaterIntake >= 2.5) {
      analytics.insights.strengths.push('Good hydration habits');
    }
    if (analytics.summary.averageSleepHours >= 7) {
      analytics.insights.strengths.push('Good sleep habits');
    }

    // Generate recommendations
    if (analytics.insights.improvementAreas.length > 0) {
      analytics.insights.recommendations.push('Focus on: ' + analytics.insights.improvementAreas.join(', '));
    }
    if (analytics.insights.strengths.length > 0) {
      analytics.insights.recommendations.push('Maintain: ' + analytics.insights.strengths.join(', '));
    }
    analytics.insights.recommendations.push(`Your consistency score is ${analytics.insights.consistencyScore}% - keep up the good work!`);
  }

  return analytics;
};

// Method to update water goal
dailyMetricsSchema.methods.updateWaterGoal = function(newGoal) {
  this.waterGoal = Number(newGoal);
  return this.save();
};

module.exports = mongoose.model('DailyMetrics', dailyMetricsSchema); 