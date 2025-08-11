const Mindfulness = require('../models/Mindfulness.js');

// Add a new mindfulness activity
async function addMindfulnessActivity(req, res) {
  try {
    const userId = req.user.id;
    const { 
      date, 
      activityType, 
      activityName, 
      duration, 
      notes,
      startTime,
      mood,
      stressLevel,
      energyLevel
    } = req.body;

    // Validation
    if (!date || !activityType || !activityName || !duration) {
      return res.status(400).json({
        message: 'Date, activity type, activity name, and duration are required'
      });
    }

    if (!['meditation', 'journaling', 'relaxation', 'mindfulness', 'yoga', 'breathing', 'other'].includes(activityType)) {
      return res.status(400).json({
        message: 'Activity type must be meditation, journaling, relaxation, mindfulness, yoga, breathing, or other'
      });
    }

    if (duration < 1 || duration > 480) {
      return res.status(400).json({
        message: 'Duration must be between 1 and 480 minutes (8 hours)'
      });
    }

    // Validate optional wellness metrics if provided
    if (mood && !['very_low', 'low', 'neutral', 'good', 'excellent'].includes(mood)) {
      return res.status(400).json({
        message: 'Mood must be very_low, low, neutral, good, or excellent'
      });
    }

    if (stressLevel && !['very_high', 'high', 'moderate', 'low', 'very_low'].includes(stressLevel)) {
      return res.status(400).json({
        message: 'Stress level must be very_high, high, moderate, low, or very_low'
      });
    }

    if (energyLevel && !['very_low', 'low', 'moderate', 'high', 'very_high'].includes(energyLevel)) {
      return res.status(400).json({
        message: 'Energy level must be very_low, low, moderate, high, or very_high'
      });
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

    // Create new mindfulness activity
    const mindfulnessActivity = new Mindfulness({
      user: userId,
      date: activityDate,
      activityType: activityType,
      activityName: activityName.trim(),
      duration: Number(duration),
      notes: notes || '',
      startTime: activityStartTime,
      mood: mood || 'neutral',
      stressLevel: stressLevel || 'moderate',
      energyLevel: energyLevel || 'moderate'
    });

    await mindfulnessActivity.save();

    console.log(`✅ Mindfulness activity added successfully: ${activityName} (${activityType}) on ${date}`);

    res.status(201).json({
      message: `${activityType} activity added successfully`,
      activity: {
        id: mindfulnessActivity._id,
        date: mindfulnessActivity.date,
        activityType: mindfulnessActivity.activityType,
        activityName: mindfulnessActivity.activityName,
        duration: mindfulnessActivity.duration,
        notes: mindfulnessActivity.notes,
        startTime: mindfulnessActivity.startTime,
        endTime: mindfulnessActivity.endTime,
        completed: mindfulnessActivity.completed,
        mood: mindfulnessActivity.mood,
        stressLevel: mindfulnessActivity.stressLevel,
        energyLevel: mindfulnessActivity.energyLevel
      }
    });

  } catch (error) {
    console.error('❌ Add mindfulness activity error:', error);
    res.status(500).json({
      message: 'Internal server error while adding mindfulness activity'
    });
  }
}

// Update an existing mindfulness activity
async function updateMindfulnessActivity(req, res) {
  try {
    const userId = req.user.id;
    const { activityId } = req.params;
    const { 
      activityName, 
      duration, 
      notes,
      startTime,
      mood,
      stressLevel,
      energyLevel
    } = req.body;

    if (!activityName && !duration && !notes && !startTime && !mood && !stressLevel && !energyLevel) {
      return res.status(400).json({
        message: 'At least one field is required for update'
      });
    }

    const updateData = {};

    if (activityName !== undefined) {
      updateData.activityName = activityName.trim();
    }

    if (duration !== undefined) {
      if (duration < 1 || duration > 480) {
        return res.status(400).json({
          message: 'Duration must be between 1 and 480 minutes'
        });
      }
      updateData.duration = Number(duration);
    }

    if (notes !== undefined) {
      updateData.notes = notes.trim();
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

    if (mood !== undefined) {
      if (!['very_low', 'low', 'neutral', 'good', 'excellent'].includes(mood)) {
        return res.status(400).json({
          message: 'Mood must be very_low, low, neutral, good, or excellent'
        });
      }
      updateData.mood = mood;
    }

    if (stressLevel !== undefined) {
      if (!['very_high', 'high', 'moderate', 'low', 'very_low'].includes(stressLevel)) {
        return res.status(400).json({
          message: 'Stress level must be very_high, high, moderate, low, or very_low'
        });
      }
      updateData.stressLevel = stressLevel;
    }

    if (energyLevel !== undefined) {
      if (!['very_low', 'low', 'moderate', 'high', 'very_high'].includes(energyLevel)) {
        return res.status(400).json({
          message: 'Energy level must be very_low, low, moderate, high, or very_high'
        });
      }
      updateData.energyLevel = energyLevel;
    }

    // Find and update activity
    const mindfulnessActivity = await Mindfulness.findOneAndUpdate(
      { _id: activityId, user: userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!mindfulnessActivity) {
      return res.status(404).json({
        message: 'Mindfulness activity not found'
      });
    }

    console.log(`✅ Mindfulness activity updated successfully: ${mindfulnessActivity.activityName}`);

    res.json({
      message: 'Mindfulness activity updated successfully',
      activity: {
        id: mindfulnessActivity._id,
        date: mindfulnessActivity.date,
        activityType: mindfulnessActivity.activityType,
        activityName: mindfulnessActivity.activityName,
        duration: mindfulnessActivity.duration,
        notes: mindfulnessActivity.notes,
        startTime: mindfulnessActivity.startTime,
        endTime: mindfulnessActivity.endTime,
        completed: mindfulnessActivity.completed,
        mood: mindfulnessActivity.mood,
        stressLevel: mindfulnessActivity.stressLevel,
        energyLevel: mindfulnessActivity.energyLevel
      }
    });

  } catch (error) {
    console.error('❌ Update mindfulness activity error:', error);
    res.status(500).json({
      message: 'Internal server error while updating mindfulness activity'
    });
  }
}

// Mark mindfulness activity as completed
async function completeMindfulnessActivity(req, res) {
  try {
    const userId = req.user.id;
    const { activityId } = req.params;

    const mindfulnessActivity = await Mindfulness.findOneAndUpdate(
      { _id: activityId, user: userId },
      { completed: true },
      { new: true }
    );

    if (!mindfulnessActivity) {
      return res.status(404).json({
        message: 'Mindfulness activity not found'
      });
    }

    console.log(`✅ Mindfulness activity marked as completed: ${mindfulnessActivity.activityName}`);

    res.json({
      message: 'Mindfulness activity marked as completed',
      activity: {
        id: mindfulnessActivity._id,
        activityName: mindfulnessActivity.activityName,
        completed: mindfulnessActivity.completed
      }
    });

  } catch (error) {
    console.error('❌ Complete mindfulness activity error:', error);
    res.status(500).json({
      message: 'Internal server error while completing mindfulness activity'
    });
  }
}

// Get daily mindfulness activities with analytics
async function getDailyMindfulnessActivities(req, res) {
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

    const dailySummary = await Mindfulness.getDailyMindfulnessSummary(userId, activityDate);

    console.log(`✅ Retrieved daily mindfulness activities for ${date}`);

    res.json({
      message: 'Daily mindfulness activities retrieved successfully',
      date: date,
      analytics: {
        totalActivities: dailySummary.totalActivities,
        totalDuration: dailySummary.totalDuration,
        totalDurationFormatted: dailySummary.totalDurationFormatted,
        completedActivities: dailySummary.completedActivities,
        activityTypeBreakdown: dailySummary.activityTypeBreakdown,
        moodBreakdown: dailySummary.moodBreakdown,
        stressLevelBreakdown: dailySummary.stressLevelBreakdown,
        energyLevelBreakdown: dailySummary.energyLevelBreakdown
      },
      activities: dailySummary.activities
    });

  } catch (error) {
    console.error('❌ Get daily mindfulness activities error:', error);
    res.status(500).json({
      message: 'Internal server error while fetching daily mindfulness activities'
    });
  }
}

// Get mindfulness analytics for a date range
async function getMindfulnessAnalytics(req, res) {
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

    const analytics = await Mindfulness.getMindfulnessAnalytics(userId, start, end);

    console.log(`✅ Retrieved mindfulness analytics`);

    res.json({
      message: 'Mindfulness analytics retrieved successfully',
      analytics: analytics
    });

  } catch (error) {
    console.error('❌ Get mindfulness analytics error:', error);
    res.status(500).json({
      message: 'Internal server error while fetching mindfulness analytics'
    });
  }
}

// Delete a mindfulness activity
async function deleteMindfulnessActivity(req, res) {
  try {
    const userId = req.user.id;
    const { activityId } = req.params;

    const mindfulnessActivity = await Mindfulness.findOneAndDelete({ _id: activityId, user: userId });

    if (!mindfulnessActivity) {
      return res.status(404).json({
        message: 'Mindfulness activity not found'
      });
    }

    console.log(`✅ Mindfulness activity deleted successfully: ${mindfulnessActivity.activityName}`);

    res.json({
      message: 'Mindfulness activity deleted successfully',
      deletedActivity: {
        id: mindfulnessActivity._id,
        activityName: mindfulnessActivity.activityName,
        activityType: mindfulnessActivity.activityType,
        date: mindfulnessActivity.date
      }
    });

  } catch (error) {
    console.error('❌ Delete mindfulness activity error:', error);
    res.status(500).json({
      message: 'Internal server error while deleting mindfulness activity'
    });
  }
}

// Get mindfulness activities by type
async function getMindfulnessActivitiesByType(req, res) {
  try {
    const userId = req.user.id;
    const { activityType } = req.params;
    const { startDate, endDate } = req.query;

    if (!['meditation', 'journaling', 'relaxation', 'mindfulness', 'yoga', 'breathing', 'other'].includes(activityType)) {
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

    const activities = await Mindfulness.find(query).sort({ date: -1, startTime: -1 });

    console.log(`✅ Retrieved ${activities.length} ${activityType} activities`);

    res.json({
      message: `${activityType} activities retrieved successfully`,
      activityType: activityType,
      count: activities.length,
      activities: activities.map(activity => ({
        id: activity._id,
        date: activity.date,
        activityName: activity.activityName,
        duration: activity.duration,
        notes: activity.notes,
        startTime: activity.startTime,
        endTime: activity.endTime,
        completed: activity.completed,
        mood: activity.mood,
        stressLevel: activity.stressLevel,
        energyLevel: activity.energyLevel
      }))
    });

  } catch (error) {
    console.error('❌ Get mindfulness activities by type error:', error);
    res.status(500).json({
      message: 'Internal server error while fetching mindfulness activities by type'
    });
  }
}

// Update wellness metrics for an activity
async function updateWellnessMetrics(req, res) {
  try {
    const userId = req.user.id;
    const { activityId } = req.params;
    const { mood, stressLevel, energyLevel } = req.body;

    if (!mood && !stressLevel && !energyLevel) {
      return res.status(400).json({
        message: 'At least one wellness metric is required'
      });
    }

    // Validate metrics if provided
    if (mood && !['very_low', 'low', 'neutral', 'good', 'excellent'].includes(mood)) {
      return res.status(400).json({
        message: 'Mood must be very_low, low, neutral, good, or excellent'
      });
    }

    if (stressLevel && !['very_high', 'high', 'moderate', 'low', 'very_low'].includes(stressLevel)) {
      return res.status(400).json({
        message: 'Stress level must be very_high, high, moderate, low, or very_low'
      });
    }

    if (energyLevel && !['very_low', 'low', 'moderate', 'high', 'very_high'].includes(energyLevel)) {
      return res.status(400).json({
        message: 'Energy level must be very_low, low, moderate, high, or very_high'
      });
    }

    const mindfulnessActivity = await Mindfulness.findOne({ _id: activityId, user: userId });

    if (!mindfulnessActivity) {
      return res.status(404).json({
        message: 'Mindfulness activity not found'
      });
    }

    await mindfulnessActivity.updateWellnessMetrics(mood, stressLevel, energyLevel);

    console.log(`✅ Wellness metrics updated for: ${mindfulnessActivity.activityName}`);

    res.json({
      message: 'Wellness metrics updated successfully',
      activity: {
        id: mindfulnessActivity._id,
        activityName: mindfulnessActivity.activityName,
        mood: mindfulnessActivity.mood,
        stressLevel: mindfulnessActivity.stressLevel,
        energyLevel: mindfulnessActivity.energyLevel
      }
    });

  } catch (error) {
    console.error('❌ Update wellness metrics error:', error);
    res.status(500).json({
      message: 'Internal server error while updating wellness metrics'
    });
  }
}

module.exports = {
  addMindfulnessActivity,
  updateMindfulnessActivity,
  completeMindfulnessActivity,
  getDailyMindfulnessActivities,
  getMindfulnessAnalytics,
  deleteMindfulnessActivity,
  getMindfulnessActivitiesByType,
  updateWellnessMetrics
}; 