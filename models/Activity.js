const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  latitude: {
    type: Number,
    required: true,
    min: -90,
    max: 90
  },
  longitude: {
    type: Number,
    required: true,
    min: -180,
    max: 180
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  placeName: {
    type: String,
    trim: true,
    default: ''
  }
});

const activitySchema = new mongoose.Schema({
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
    enum: ['walking', 'running', 'cycling', 'hiking', 'swimming', 'gym_workout', 'yoga', 'other'],
    required: true
  },
  activityName: {
    type: String,
    required: true,
    trim: true
  },
  location: locationSchema,
  duration: {
    type: Number,
    required: true,
    min: 1, // Minimum 1 minute
    max: 1440 // Maximum 24 hours in minutes
  },
  calories: {
    type: Number,
    required: true,
    min: 0
  },
  efficiencyLevel: {
    type: String,
    enum: ['low', 'moderate', 'high', 'very_high'],
    required: true
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  distance: {
    type: Number,
    min: 0,
    default: 0
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
  }
}, {
  timestamps: true
});

// Index for faster queries
activitySchema.index({ user: 1, date: 1, activityType: 1 });
activitySchema.index({ user: 1, 'location.latitude': 1, 'location.longitude': 1 });

// Pre-save middleware to calculate end time and distance
activitySchema.pre('save', function(next) {
  if (this.startTime && this.duration) {
    this.endTime = new Date(this.startTime.getTime() + (this.duration * 60 * 1000));
  }
  next();
});

// Static method to get daily activities
activitySchema.statics.getDailyActivities = async function(userId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.find({
    user: userId,
    date: { $gte: startOfDay, $lte: endOfDay }
  }).sort({ startTime: 1 });
};

// Static method to get daily activity summary with analytics
activitySchema.statics.getDailyActivitySummary = async function(userId, date) {
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
    totalCalories: 0,
    totalDistance: 0,
    uniqueLocations: new Set(),
    activityTypeBreakdown: {},
    efficiencyBreakdown: {
      low: 0,
      moderate: 0,
      high: 0,
      very_high: 0
    },
    activities: []
  };

  activities.forEach(activity => {
    summary.totalDuration += activity.duration;
    summary.totalCalories += activity.calories;
    summary.totalDistance += activity.distance;
    
    // Count unique locations
    if (activity.location && activity.location.latitude && activity.location.longitude) {
      const locationKey = `${activity.location.latitude.toFixed(4)},${activity.location.longitude.toFixed(4)}`;
      summary.uniqueLocations.add(locationKey);
    }

    // Activity type breakdown
    if (!summary.activityTypeBreakdown[activity.activityType]) {
      summary.activityTypeBreakdown[activity.activityType] = 0;
    }
    summary.activityTypeBreakdown[activity.activityType]++;

    // Efficiency breakdown
    summary.efficiencyBreakdown[activity.efficiencyLevel]++;

    // Add activity details
    summary.activities.push({
      id: activity._id,
      activityType: activity.activityType,
      activityName: activity.activityName,
      duration: activity.duration,
      calories: activity.calories,
      efficiencyLevel: activity.efficiencyLevel,
      distance: activity.distance,
      location: activity.location,
      startTime: activity.startTime,
      endTime: activity.endTime,
      completed: activity.completed
    });
  });

  // Convert unique locations set to count
  summary.uniqueLocationsCount = summary.uniqueLocations.size;

  // Convert duration to hours and minutes
  const totalHours = Math.floor(summary.totalDuration / 60);
  const totalMinutes = summary.totalDuration % 60;
  summary.totalDurationFormatted = `${totalHours}h ${totalMinutes}m`;

  return summary;
};

// Static method to get weekly/monthly analytics
activitySchema.statics.getActivityAnalytics = async function(userId, startDate, endDate) {
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
      totalCalories: 0,
      totalDistance: 0,
      uniqueLocations: new Set(),
      completedActivities: 0
    },
    dailyBreakdown: {},
    activityTypeBreakdown: {},
    efficiencyBreakdown: {
      low: 0,
      moderate: 0,
      high: 0,
      very_high: 0
    },
    topLocations: [],
    trends: {
      averageDuration: 0,
      averageCalories: 0,
      averageDistance: 0,
      mostActiveDay: null,
      mostActiveTime: null
    }
  };

  let totalDuration = 0;
  let totalCalories = 0;
  let totalDistance = 0;
  let completedCount = 0;
  const dayActivityCount = {};
  const timeActivityCount = {};

  activities.forEach(activity => {
    totalDuration += activity.duration;
    totalCalories += activity.calories;
    totalDistance += activity.distance;
    
    if (activity.completed) completedCount++;

    // Count unique locations
    if (activity.location && activity.location.latitude && activity.location.longitude) {
      const locationKey = `${activity.location.latitude.toFixed(4)},${activity.location.longitude.toFixed(4)}`;
      analytics.summary.uniqueLocations.add(locationKey);
    }

    // Daily breakdown
    const dayKey = activity.date.toISOString().split('T')[0];
    if (!analytics.dailyBreakdown[dayKey]) {
      analytics.dailyBreakdown[dayKey] = {
        activities: 0,
        duration: 0,
        calories: 0,
        distance: 0
      };
    }
    analytics.dailyBreakdown[dayKey].activities++;
    analytics.dailyBreakdown[dayKey].duration += activity.duration;
    analytics.dailyBreakdown[dayKey].calories += activity.calories;
    analytics.dailyBreakdown[dayKey].distance += activity.distance;

    // Activity type breakdown
    if (!analytics.activityTypeBreakdown[activity.activityType]) {
      analytics.activityTypeBreakdown[activity.activityType] = 0;
    }
    analytics.activityTypeBreakdown[activity.activityType]++;

    // Efficiency breakdown
    analytics.efficiencyBreakdown[activity.efficiencyLevel]++;

    // Time breakdown (hour of day)
    const hour = activity.startTime.getHours();
    if (!timeActivityCount[hour]) {
      timeActivityCount[hour] = 0;
    }
    timeActivityCount[hour]++;
  });

  // Update summary totals
  analytics.summary.totalDuration = totalDuration;
  analytics.summary.totalCalories = totalCalories;
  analytics.summary.totalDistance = totalDistance;
  analytics.summary.completedActivities = completedCount;
  analytics.summary.uniqueLocationsCount = analytics.summary.uniqueLocations.size;

  // Calculate trends
  if (activities.length > 0) {
    analytics.trends.averageDuration = Math.round(totalDuration / activities.length);
    analytics.trends.averageCalories = Math.round(totalCalories / activities.length);
    analytics.trends.averageDistance = Number((totalDistance / activities.length).toFixed(2));
  }

  // Find most active day
  let maxActivities = 0;
  let mostActiveDay = null;
  Object.entries(analytics.dailyBreakdown).forEach(([day, data]) => {
    if (data.activities > maxActivities) {
      maxActivities = data.activities;
      mostActiveDay = day;
    }
  });
  analytics.trends.mostActiveDay = mostActiveDay;

  // Find most active time
  let maxTimeCount = 0;
  let mostActiveTime = null;
  Object.entries(timeActivityCount).forEach(([hour, count]) => {
    if (count > maxTimeCount) {
      maxTimeCount = count;
      mostActiveTime = `${hour}:00`;
    }
  });
  analytics.trends.mostActiveTime = mostActiveTime;

  return analytics;
};

// Method to calculate distance between two points (Haversine formula)
activitySchema.methods.calculateDistance = function(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

module.exports = mongoose.model('Activity', activitySchema); 