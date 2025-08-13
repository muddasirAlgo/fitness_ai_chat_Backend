const Activity = require('../models/Activity.js');

// Add a new activity
async function addActivity(req, res) {
  try {
    const userId = req.user.id;
    const { 
      date, 
      activityType, 
      activityName, 
      location, 
      duration, 
      calories, 
      efficiencyLevel, 
      notes,
      distance,
      startTime
    } = req.body;

    // Validation
    if (!date || !activityType || !activityName || !duration || !calories || !efficiencyLevel) {
      return res.status(400).json({
        message: 'Date, activity type, activity name, duration, calories, and efficiency level are required'
      });
    }

    if (!['walking', 'running', 'cycling', 'hiking', 'swimming', 'gym_workout', 'yoga', 'other'].includes(activityType)) {
      return res.status(400).json({
        message: 'Activity type must be walking, running, cycling, hiking, swimming, gym_workout, yoga, or other'
      });
    }

    if (!['low', 'moderate', 'high', 'very_high'].includes(efficiencyLevel)) {
      return res.status(400).json({
        message: 'Efficiency level must be low, moderate, high, or very_high'
      });
    }

    // Validate duration is a valid number and within range
    if (isNaN(Number(duration)) || Number(duration) < 1 || Number(duration) > 1440) {
      return res.status(400).json({
        message: 'Duration must be a valid number between 1 and 1440 minutes (24 hours)'
      });
    }

    // Validate calories is a valid number and non-negative
    if (isNaN(Number(calories)) || Number(calories) < 0) {
      return res.status(400).json({
        message: 'Calories must be a valid non-negative number'
      });
    }

    // Validate location if provided
    if (location) {
      if (location.latitude === undefined || location.longitude === undefined) {
        return res.status(400).json({
          message: 'Location must include latitude and longitude'
        });
      }

      if (location.latitude < -90 || location.latitude > 90) {
        return res.status(400).json({
          message: 'Latitude must be between -90 and 90'
        });
      }

      if (location.longitude < -180 || location.longitude > 180) {
        return res.status(400).json({
          message: 'Longitude must be between -180 and 180'
        });
      }
    }

    // Parse date and start time
    const activityDate = new Date(date);
    const activityStartTime = startTime ? new Date(startTime) : new Date();
    
    if (isNaN(activityDate.getTime())) {
      return res.status(400).json({
        message: 'Invalid date format'
      });
    }

    if (isNaN(activityStartTime.getTime())) {
      return res.status(400).json({
        message: 'Invalid start time format'
      });
    }

    // Check if activity data already exists for this date
    const existingActivity = await Activity.getDailyActivities(userId, activityDate);
    if (existingActivity && existingActivity.length > 0) {
      return res.status(400).json({
        message: 'Activity data already exists for this date.'
      });
    }

    // Create new activity
    const activity = new Activity({
      user: userId,
      date: activityDate,
      activityType: activityType,
      activityName: activityName.trim(),
      location: location || null,
      duration: Number(duration),
      calories: Number(calories),
      efficiencyLevel: efficiencyLevel,
      notes: notes || '',
      distance: distance || 0,
      startTime: activityStartTime
    });

    await activity.save();

    console.log(`✅ Activity added successfully: ${activityName} (${activityType}) on ${date}`);

    res.status(201).json({
      message: `${activityType} activity added successfully`,
      activity: {
        id: activity._id,
        date: activity.date,
        activityType: activity.activityType,
        activityName: activity.activityName,
        location: activity.location,
        duration: activity.duration,
        calories: activity.calories,
        efficiencyLevel: activity.efficiencyLevel,
        distance: activity.distance,
        startTime: activity.startTime,
        endTime: activity.endTime,
        notes: activity.notes,
        completed: activity.completed
      }
    });

  } catch (error) {
    console.error('❌ Add activity error:', error);
    res.status(500).json({
      message: 'Internal server error while adding activity'
    });
  }
}

// Update an existing activity
async function updateActivity(req, res) {
  try {
    const userId = req.user.id;
    const { activityId } = req.params;
    const { 
      activityName, 
      location, 
      duration, 
      calories, 
      efficiencyLevel, 
      notes,
      distance,
      startTime
    } = req.body;

    if (!activityName && !location && !duration && !calories && !efficiencyLevel && !notes && !distance && !startTime) {
      return res.status(400).json({
        message: 'At least one field is required for update'
      });
    }

    const updateData = {};

    if (activityName !== undefined) {
      updateData.activityName = activityName.trim();
    }

    if (location !== undefined) {
      if (location.latitude === undefined || location.longitude === undefined) {
        return res.status(400).json({
          message: 'Location must include latitude and longitude'
        });
      }
      updateData.location = location;
    }

    if (duration !== undefined) {
      if (isNaN(Number(duration)) || Number(duration) < 1 || Number(duration) > 1440) {
        return res.status(400).json({
          message: 'Duration must be a valid number between 1 and 1440 minutes'
        });
      }
      updateData.duration = Number(duration);
    }

    if (calories !== undefined) {
      if (isNaN(Number(calories)) || Number(calories) < 0) {
        return res.status(400).json({
          message: 'Calories must be a valid non-negative number'
        });
      }
      updateData.calories = Number(calories);
    }

    if (efficiencyLevel !== undefined) {
      if (!['low', 'moderate', 'high', 'very_high'].includes(efficiencyLevel)) {
        return res.status(400).json({
          message: 'Efficiency level must be low, moderate, high, or very_high'
        });
      }
      updateData.efficiencyLevel = efficiencyLevel;
    }

    if (notes !== undefined) {
      updateData.notes = notes.trim();
    }

    if (distance !== undefined) {
      if (isNaN(Number(distance)) || Number(distance) < 0) {
        return res.status(400).json({
          message: 'Distance must be a valid non-negative number'
        });
      }
      updateData.distance = Number(distance);
    }

    if (startTime !== undefined) {
      const newStartTime = new Date(startTime);
      if (isNaN(newStartTime.getTime())) {
        return res.status(400).json({
          message: 'Invalid start time format'
        });
      }
      updateData.startTime = newStartTime;
    }

    // Find and update activity
    const activity = await Activity.findOneAndUpdate(
      { _id: activityId, user: userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!activity) {
      return res.status(404).json({
        message: 'Activity not found'
      });
    }

    console.log(`✅ Activity updated successfully: ${activity.activityName}`);

    res.json({
      message: 'Activity updated successfully',
      activity: {
        id: activity._id,
        date: activity.date,
        activityType: activity.activityType,
        activityName: activity.activityName,
        location: activity.location,
        duration: activity.duration,
        calories: activity.calories,
        efficiencyLevel: activity.efficiencyLevel,
        distance: activity.distance,
        startTime: activity.startTime,
        endTime: activity.endTime,
        notes: activity.notes,
        completed: activity.completed
      }
    });

  } catch (error) {
    console.error('❌ Update activity error:', error);
    res.status(500).json({
      message: 'Internal server error while updating activity'
    });
  }
}

// Mark activity as completed
async function completeActivity(req, res) {
  try {
    const userId = req.user.id;
    const { activityId } = req.params;

    const activity = await Activity.findOneAndUpdate(
      { _id: activityId, user: userId },
      { completed: true },
      { new: true }
    );

    if (!activity) {
      return res.status(404).json({
        message: 'Activity not found'
      });
    }

    console.log(`✅ Activity marked as completed: ${activity.activityName}`);

    res.json({
      message: 'Activity marked as completed',
      activity: {
        id: activity._id,
        activityName: activity.activityName,
        completed: activity.completed
      }
    });

  } catch (error) {
    console.error('❌ Complete activity error:', error);
    res.status(500).json({
      message: 'Internal server error while completing activity'
    });
  }
}

// Get daily activities with analytics
async function getDailyActivities(req, res) {
  try {
    const userId = req.user.id;
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({
        message: 'Date parameter is required'
      });
    }

    const activityDate = new Date(date);
    if (isNaN(activityDate.getTime())) {
      return res.status(400).json({
        message: 'Invalid date format'
      });
    }

    const dailySummary = await Activity.getDailyActivitySummary(userId, activityDate);

    console.log(`✅ Retrieved daily activities for ${date}`);

    res.json({
      message: 'Daily activities retrieved successfully',
      date: date,
      analytics: {
        totalActivities: dailySummary.totalActivities,
        totalDuration: dailySummary.totalDuration,
        totalDurationFormatted: dailySummary.totalDurationFormatted,
        totalCalories: dailySummary.totalCalories,
        totalDistance: dailySummary.totalDistance,
        uniqueLocationsCount: dailySummary.uniqueLocationsCount,
        activityTypeBreakdown: dailySummary.activityTypeBreakdown,
        efficiencyBreakdown: dailySummary.efficiencyBreakdown
      },
      activities: dailySummary.activities
    });

  } catch (error) {
    console.error('❌ Get daily activities error:', error);
    res.status(500).json({
      message: 'Internal server error while fetching daily activities'
    });
  }
}

// Get activity analytics for a date range
async function getActivityAnalytics(req, res) {
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

    const analytics = await Activity.getActivityAnalytics(userId, start, end);

    console.log(`✅ Retrieved activity analytics`);

    res.json({
      message: 'Activity analytics retrieved successfully',
      analytics: analytics
    });

  } catch (error) {
    console.error('❌ Get activity analytics error:', error);
    res.status(500).json({
      message: 'Internal server error while fetching activity analytics'
    });
  }
}

// Delete an activity
async function deleteActivity(req, res) {
  try {
    const userId = req.user.id;
    const { activityId } = req.params;

    const activity = await Activity.findOneAndDelete({ _id: activityId, user: userId });

    if (!activity) {
      return res.status(404).json({
        message: 'Activity not found'
      });
    }

    console.log(`✅ Activity deleted successfully: ${activity.activityName}`);

    res.json({
      message: 'Activity deleted successfully',
      deletedActivity: {
        id: activity._id,
        activityName: activity.activityName,
        activityType: activity.activityType,
        date: activity.date
      }
    });

  } catch (error) {
    console.error('❌ Delete activity error:', error);
    res.status(500).json({
      message: 'Internal server error while deleting activity'
    });
  }
}

// Get activities by type
async function getActivitiesByType(req, res) {
  try {
    const userId = req.user.id;
    const { activityType } = req.params;
    const { startDate, endDate } = req.query;

    if (!['walking', 'running', 'cycling', 'hiking', 'swimming', 'gym_workout', 'yoga', 'other'].includes(activityType)) {
      return res.status(400).json({
        message: 'Invalid activity type'
      });
    }

    let query = { user: userId, activityType: activityType };

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          message: 'Invalid date format'
        });
      }

      query.date = { $gte: start, $lte: end };
    }

    const activities = await Activity.find(query).sort({ date: -1, startTime: -1 });

    console.log(`✅ Retrieved ${activities.length} ${activityType} activities`);

    res.json({
      message: `${activityType} activities retrieved successfully`,
      activityType: activityType,
      count: activities.length,
      activities: activities.map(activity => ({
        id: activity._id,
        date: activity.date,
        activityName: activity.activityName,
        location: activity.location,
        duration: activity.duration,
        calories: activity.calories,
        efficiencyLevel: activity.efficiencyLevel,
        distance: activity.distance,
        startTime: activity.startTime,
        endTime: activity.endTime,
        notes: activity.notes,
        completed: activity.completed
      }))
    });

  } catch (error) {
    console.error('❌ Get activities by type error:', error);
    res.status(500).json({
      message: 'Internal server error while fetching activities by type'
    });
  }
}

module.exports = {
  addActivity,
  updateActivity,
  completeActivity,
  getDailyActivities,
  getActivityAnalytics,
  deleteActivity,
  getActivitiesByType
}; 