const mongoose = require('mongoose');

const mindfulnessActivitySchema = new mongoose.Schema({
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
  activityType: {
    type: String,
    enum: ['meditation', 'journaling', 'relaxation', 'mindfulness', 'yoga', 'breathing', 'other'],
    required: true
  },
  activityName: {
    type: String,
    required: true,
    trim: true
  },
  duration: {
    type: Number,
    required: true,
    min: 1, // Minimum 1 minute
    max: 480 // Maximum 8 hours in minutes
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date,
    default: Date.now
  },
  completed: {
    type: Boolean,
    default: false
  },
  mood: {
    type: String,
    enum: ['very_low', 'low', 'neutral', 'good', 'excellent'],
    default: 'neutral'
  },
  stressLevel: {
    type: String,
    enum: ['very_high', 'high', 'moderate', 'low', 'very_low'],
    default: 'moderate'
  },
  energyLevel: {
    type: String,
    enum: ['very_low', 'low', 'moderate', 'high', 'very_high'],
    default: 'moderate'
  }
}, {
  timestamps: true
});

// Index for faster queries
mindfulnessActivitySchema.index({ user: 1, date: 1, activityType: 1 });
mindfulnessActivitySchema.index({ user: 1, startTime: 1 });

// Pre-save middleware to calculate end time
mindfulnessActivitySchema.pre('save', function(next) {
  if (this.startTime && this.duration) {
    this.endTime = new Date(this.startTime.getTime() + (this.duration * 60 * 1000));
  }
  next();
});

// Static method to get daily mindfulness activities
mindfulnessActivitySchema.statics.getDailyActivities = async function(userId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.find({
    user: userId,
    date: { $gte: startOfDay, $lte: endOfDay }
  }).sort({ startTime: 1 });
};

// Static method to get daily mindfulness summary with analytics
mindfulnessActivitySchema.statics.getDailyMindfulnessSummary = async function(userId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const activities = await this.find({
    user: userId,
    date: { $gte: startOfDay, $lte: endOfDay }
  });

  const summary = {
    totalActivities: activities.length,
    totalDuration: 0,
    totalDurationFormatted: '0m',
    activityTypeBreakdown: {},
    moodBreakdown: {
      very_low: 0,
      low: 0,
      neutral: 0,
      good: 0,
      excellent: 0
    },
    stressLevelBreakdown: {
      very_high: 0,
      high: 0,
      moderate: 0,
      low: 0,
      very_low: 0
    },
    energyLevelBreakdown: {
      very_low: 0,
      low: 0,
      moderate: 0,
      high: 0,
      very_high: 0
    },
    completedActivities: 0,
    activities: []
  };

  activities.forEach(activity => {
    summary.totalDuration += activity.duration;
    
    // Activity type breakdown
    if (!summary.activityTypeBreakdown[activity.activityType]) {
      summary.activityTypeBreakdown[activity.activityType] = 0;
    }
    summary.activityTypeBreakdown[activity.activityType]++;

    // Mood breakdown
    summary.moodBreakdown[activity.mood]++;

    // Stress level breakdown
    summary.stressLevelBreakdown[activity.stressLevel]++;

    // Energy level breakdown
    summary.energyLevelBreakdown[activity.energyLevel]++;

    // Count completed activities
    if (activity.completed) {
      summary.completedActivities++;
    }

    // Add activity details
    summary.activities.push({
      id: activity._id,
      activityType: activity.activityType,
      activityName: activity.activityName,
      duration: activity.duration,
      notes: activity.notes,
      startTime: activity.startTime,
      endTime: activity.endTime,
      completed: activity.completed,
      mood: activity.mood,
      stressLevel: activity.stressLevel,
      energyLevel: activity.energyLevel
    });
  });

  // Convert duration to hours and minutes
  const totalHours = Math.floor(summary.totalDuration / 60);
  const totalMinutes = summary.totalDuration % 60;
  if (totalHours > 0) {
    summary.totalDurationFormatted = `${totalHours}h ${totalMinutes}m`;
  } else {
    summary.totalDurationFormatted = `${totalMinutes}m`;
  }

  return summary;
};

// Static method to get mindfulness analytics for a date range
mindfulnessActivitySchema.statics.getMindfulnessAnalytics = async function(userId, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const activities = await this.find({
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
      totalActivities: activities.length,
      totalDuration: 0,
      completedActivities: 0,
      averageDuration: 0
    },
    dailyBreakdown: {},
    activityTypeBreakdown: {},
    moodTrends: {
      very_low: 0,
      low: 0,
      neutral: 0,
      good: 0,
      excellent: 0
    },
    stressTrends: {
      very_high: 0,
      high: 0,
      moderate: 0,
      low: 0,
      very_low: 0
    },
    energyTrends: {
      very_low: 0,
      low: 0,
      moderate: 0,
      high: 0,
      very_high: 0
    },
    insights: {
      mostPracticedType: null,
      averageDailyDuration: 0,
      moodImprovement: null,
      stressReduction: null,
      consistencyScore: 0
    }
  };

  let totalDuration = 0;
  let completedCount = 0;
  const dayActivityCount = {};
  const dayDurationCount = {};

  activities.forEach(activity => {
    totalDuration += activity.duration;
    
    if (activity.completed) completedCount++;

    // Daily breakdown
    const dayKey = activity.date.toISOString().split('T')[0];
    if (!analytics.dailyBreakdown[dayKey]) {
      analytics.dailyBreakdown[dayKey] = {
        activities: 0,
        duration: 0,
        completed: 0
      };
    }
    analytics.dailyBreakdown[dayKey].activities++;
    analytics.dailyBreakdown[dayKey].duration += activity.duration;
    if (activity.completed) analytics.dailyBreakdown[dayKey].completed++;

    // Activity type breakdown
    if (!analytics.activityTypeBreakdown[activity.activityType]) {
      analytics.activityTypeBreakdown[activity.activityType] = 0;
    }
    analytics.activityTypeBreakdown[activity.activityType]++;

    // Mood trends
    analytics.moodTrends[activity.mood]++;

    // Stress trends
    analytics.stressTrends[activity.stressLevel]++;

    // Energy trends
    analytics.energyTrends[activity.energyLevel]++;

    // Count activities per day
    if (!dayActivityCount[dayKey]) {
      dayActivityCount[dayKey] = 0;
    }
    dayActivityCount[dayKey]++;

    // Count duration per day
    if (!dayDurationCount[dayKey]) {
      dayDurationCount[dayKey] = 0;
    }
    dayDurationCount[dayKey] += activity.duration;
  });

  // Update summary totals
  analytics.summary.totalDuration = totalDuration;
  analytics.summary.completedActivities = completedCount;
  analytics.summary.averageDuration = activities.length > 0 ? Math.round(totalDuration / activities.length) : 0;

  // Calculate insights
  if (activities.length > 0) {
    // Most practiced type
    let maxCount = 0;
    let mostPracticed = null;
    Object.entries(analytics.activityTypeBreakdown).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostPracticed = type;
      }
    });
    analytics.insights.mostPracticedType = mostPracticed;

    // Average daily duration
    const totalDays = Object.keys(analytics.dailyBreakdown).length;
    analytics.insights.averageDailyDuration = totalDays > 0 ? Math.round(totalDuration / totalDays) : 0;

    // Consistency score (percentage of days with activities)
    const totalPeriodDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    analytics.insights.consistencyScore = Math.round((totalDays / totalPeriodDays) * 100);

    // Mood improvement analysis
    const positiveMoods = analytics.moodTrends.good + analytics.moodTrends.excellent;
    const negativeMoods = analytics.moodTrends.very_low + analytics.moodTrends.low;
    if (positiveMoods > negativeMoods) {
      analytics.insights.moodImprovement = 'positive';
    } else if (negativeMoods > positiveMoods) {
      analytics.insights.moodImprovement = 'negative';
    } else {
      analytics.insights.moodImprovement = 'neutral';
    }

    // Stress reduction analysis
    const lowStress = analytics.stressTrends.low + analytics.stressTrends.very_low;
    const highStress = analytics.stressTrends.high + analytics.stressTrends.very_high;
    if (lowStress > highStress) {
      analytics.insights.stressReduction = 'effective';
    } else if (highStress > lowStress) {
      analytics.insights.stressReduction = 'needs_improvement';
    } else {
      analytics.insights.stressReduction = 'moderate';
    }
  }

  return analytics;
};

// Method to mark activity as completed
mindfulnessActivitySchema.methods.markCompleted = function() {
  this.completed = true;
  return this.save();
};

// Method to update mood and stress levels
mindfulnessActivitySchema.methods.updateWellnessMetrics = function(mood, stressLevel, energyLevel) {
  if (mood) this.mood = mood;
  if (stressLevel) this.stressLevel = stressLevel;
  if (energyLevel) this.energyLevel = energyLevel;
  return this.save();
};

module.exports = mongoose.model('Mindfulness', mindfulnessActivitySchema); 