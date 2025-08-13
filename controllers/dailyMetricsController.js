const DailyMetrics = require('../models/DailyMetrics.js');

// Add or update daily metrics
async function addDailyMetrics(req, res) {
  try {
    const userId = req.user.id;
    const { 
      date, 
      steps, 
      caloriesBurned, 
      waterIntake, 
      sleepHours, 
      weight, 
      activities, 
      howAreYouFeeling, 
      notes 
    } = req.body;

    // Validation
    if (!date || !howAreYouFeeling) {
      return res.status(400).json({
        message: 'Date and how are you feeling are required'
      });
    }

    if (!['great', 'good', 'okay', 'bad', 'terrible'].includes(howAreYouFeeling)) {
      return res.status(400).json({
        message: 'How are you feeling must be great, good, okay, bad, or terrible'
      });
    }

    // Validate optional fields if provided
    if (steps !== undefined && (steps < 0 || steps > 100000)) {
      return res.status(400).json({
        message: 'Steps must be between 0 and 100,000'
      });
    }

    if (caloriesBurned !== undefined && (caloriesBurned < 0 || caloriesBurned > 10000)) {
      return res.status(400).json({
        message: 'Calories burned must be between 0 and 10,000'
      });
    }

    if (waterIntake !== undefined && (waterIntake < 0 || waterIntake > 20)) {
      return res.status(400).json({
        message: 'Water intake must be between 0 and 20L'
      });
    }

    if (sleepHours !== undefined && (sleepHours < 0 || sleepHours > 24)) {
      return res.status(400).json({
        message: 'Sleep hours must be between 0 and 24'
      });
    }

    if (weight !== undefined && (weight < 20 || weight > 500)) {
      return res.status(400).json({
        message: 'Weight must be between 20 and 500 kg'
      });
    }



    // Validate activities array (required)
    if (!activities || !Array.isArray(activities)) {
      return res.status(400).json({
        message: 'Activities array is required and must be an array'
      });
    }
    
    console.log('📊 Received activities:', JSON.stringify(activities, null, 2));
    
    if (activities.length === 0) {
      return res.status(400).json({
        message: 'At least one activity is required'
      });
    }
    
    if (activities.length > 10) {
      return res.status(400).json({
        message: 'Maximum 10 activities allowed per day'
      });
    }
    
    for (let i = 0; i < activities.length; i++) {
      const activity = activities[i];
      
      // Validate activity object structure
      if (!activity || typeof activity !== 'object') {
        return res.status(400).json({
          message: `Activity ${i + 1}: Must be a valid object`
        });
      }
      
      if (!activity.activityType || !['walking', 'running', 'cycling', 'hiking', 'swimming', 'gym_workout', 'yoga', 'pilates', 'meditation', 'breathing', 'other'].includes(activity.activityType)) {
        return res.status(400).json({
          message: `Activity ${i + 1}: Invalid activity type`
        });
      }
      
      // Ensure duration is a number and convert if needed
      let duration = activity.duration;
      if (typeof duration === 'string') {
        // Try to extract number from string like "15 minutes"
        const durationMatch = duration.match(/(\d+)/);
        if (durationMatch) {
          duration = parseInt(durationMatch[1], 10);
        } else {
          return res.status(400).json({
            message: `Activity ${i + 1}: Duration must be a valid number`
          });
        }
      }
      
      if (!duration || duration < 1 || duration > 1440) {
        return res.status(400).json({
          message: `Activity ${i + 1}: Duration must be between 1 and 1440 minutes`
        });
      }
      
      // Update the activity object with the cleaned duration
      activities[i].duration = duration;
      
      // Ensure intensity level is valid
      if (activity.intensityLevel && !['very_low', 'low', 'moderate', 'high', 'very_high'].includes(activity.intensityLevel)) {
        return res.status(400).json({
          message: `Activity ${i + 1}: Invalid intensity level`
        });
      }
      
      // Set default intensity level if not provided
      if (!activity.intensityLevel) {
        activities[i].intensityLevel = 'moderate';
      }
    }

    // Parse date
    const metricsDate = new Date(date);
    if (isNaN(metricsDate.getTime())) {
      return res.status(400).json({
        message: 'Invalid date format'
      });
    }

    // Check if metrics already exist for this date
    let dailyMetrics = await DailyMetrics.getDailyMetrics(userId, metricsDate);

    // If metrics exist, throw error
    if (dailyMetrics) {
      return res.status(400).json({
        message: 'Daily metrics data already exists for this date.'
      });
    }

    // Create new metrics since none exist
    dailyMetrics = new DailyMetrics({
      user: userId,
      date: metricsDate,
      steps: steps || 0,
      caloriesBurned: caloriesBurned || 0,
      waterIntake: waterIntake || 0,
      sleepHours: sleepHours || 0,
      weight: weight || null,
      activities: activities,
      howAreYouFeeling: howAreYouFeeling,
      notes: notes || ''
    });

    await dailyMetrics.save();

    console.log(`✅ Daily metrics added for ${date}`);

    res.status(201).json({
      message: 'Daily metrics added successfully',
      metrics: {
        id: dailyMetrics._id,
        date: dailyMetrics.date,
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
        notes: dailyMetrics.notes,
        activityScore: dailyMetrics.activityScore,
        overallWellnessScore: dailyMetrics.overallWellnessScore
      }
    });

  } catch (error) {
    console.error('❌ Add daily metrics error:', error);
    res.status(500).json({
      message: 'Internal server error while adding daily metrics'
    });
  }
}

// Get daily metrics with summary and recommendations
async function getDailyMetrics(req, res) {
  try {
    const userId = req.user.id;
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({
        message: 'Date parameter is required'
      });
    }

    const metricsDate = new Date(date);
    if (isNaN(metricsDate.getTime())) {
      return res.status(400).json({
        message: 'Invalid date format'
      });
    }

    const dailySummary = await DailyMetrics.getDailyMetricsSummary(userId, metricsDate);

    console.log(`✅ Retrieved daily metrics for ${date}`);

    res.json({
      message: 'Daily metrics retrieved successfully',
      date: date,
      hasData: dailySummary.hasData,
      summary: dailySummary.summary,
      recommendations: dailySummary.recommendations
    });

  } catch (error) {
    console.error('❌ Get daily metrics error:', error);
    res.status(500).json({
      message: 'Internal server error while fetching daily metrics'
    });
  }
}

// Get metrics analytics for a date range
async function getMetricsAnalytics(req, res) {
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

    const analytics = await DailyMetrics.getMetricsAnalytics(userId, start, end);

    console.log(`✅ Retrieved metrics analytics`);

    res.json({
      message: 'Metrics analytics retrieved successfully',
      analytics: analytics
    });

  } catch (error) {
    console.error('❌ Get metrics analytics error:', error);
    res.status(500).json({
      message: 'Internal server error while fetching metrics analytics'
    });
  }
}

// Update water goal for a specific date
async function updateWaterGoal(req, res) {
  try {
    const userId = req.user.id;
    const { date, waterGoal } = req.body;

    if (!date || !waterGoal) {
      return res.status(400).json({
        message: 'Date and water goal are required'
      });
    }

    if (waterGoal < 0.5 || waterGoal > 10) {
      return res.status(400).json({
        message: 'Water goal must be between 0.5L and 10L'
      });
    }

    const goalDate = new Date(date);
    if (isNaN(goalDate.getTime())) {
      return res.status(400).json({
        message: 'Invalid date format'
      });
    }

    let dailyMetrics = await DailyMetrics.getDailyMetrics(userId, goalDate);

    if (!dailyMetrics) {
      // Create new metrics with just the water goal
      dailyMetrics = new DailyMetrics({
        user: userId,
        date: goalDate,
        howAreYouFeeling: 'good' // Required field
      });
    } else {
      // Check if water goal already exists and is not the default
      if (dailyMetrics.waterGoal && dailyMetrics.waterGoal !== 2.5) {
        return res.status(400).json({
          message: 'Water goal already exists for this date.'
        });
      }
    }

    await dailyMetrics.updateWaterGoal(waterGoal);

    console.log(`✅ Water goal updated: ${waterGoal}L for ${date}`);

    res.json({
      message: 'Water goal updated successfully',
      waterGoal: dailyMetrics.waterGoal,
      waterIntakePercentage: dailyMetrics.waterIntakePercentage
    });

  } catch (error) {
    console.error('❌ Update water goal error:', error);
    res.status(500).json({
      message: 'Internal server error while updating water goal'
    });
  }
}

// Delete daily metrics
async function deleteDailyMetrics(req, res) {
  try {
    const userId = req.user.id;
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({
        message: 'Date parameter is required'
      });
    }

    const metricsDate = new Date(date);
    if (isNaN(metricsDate.getTime())) {
      return res.status(400).json({
        message: 'Invalid date format'
      });
    }

    const dailyMetrics = await DailyMetrics.findOneAndDelete({
      user: userId,
      date: { 
        $gte: new Date(metricsDate.setHours(0, 0, 0, 0)),
        $lte: new Date(metricsDate.setHours(23, 59, 59, 999))
      }
    });

    if (!dailyMetrics) {
      return res.status(404).json({
        message: 'Daily metrics not found for this date'
      });
    }

    console.log(`✅ Daily metrics deleted for ${date}`);

    res.json({
      message: 'Daily metrics deleted successfully',
      deletedMetrics: {
        date: dailyMetrics.date,
        steps: dailyMetrics.steps,
        caloriesBurned: dailyMetrics.caloriesBurned,
        waterIntake: dailyMetrics.waterIntake,
        sleepHours: dailyMetrics.sleepHours,
        howAreYouFeeling: dailyMetrics.howAreYouFeeling
      }
    });

  } catch (error) {
    console.error('❌ Delete daily metrics error:', error);
    res.status(500).json({
      message: 'Internal server error while deleting daily metrics'
    });
  }
}

// Get metrics by feeling for a date range
async function getMetricsByFeeling(req, res) {
  try {
    const userId = req.user.id;
    const { feeling } = req.params;
    const { startDate, endDate } = req.query;

    if (!['great', 'good', 'okay', 'bad', 'terrible'].includes(feeling)) {
      return res.status(500).json({
        message: 'Invalid feeling parameter. Must be one of: great, good, okay, bad, terrible'
      });
    }

    let query = { user: userId, howAreYouFeeling: feeling };

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

    const metrics = await DailyMetrics.find(query).sort({ date: -1 });

    console.log(`✅ Retrieved ${metrics.length} metrics with feeling: ${feeling}`);

    res.json({
      message: `Metrics with feeling '${feeling}' retrieved successfully`,
      feeling: feeling,
      count: metrics.length,
      metrics: metrics.map(metric => ({
        id: metric._id,
        date: metric.date,
        steps: metric.steps,
        caloriesBurned: metric.caloriesBurned,
        waterIntake: metric.waterIntake,
        sleepHours: metric.sleepHours,
        weight: metric.weight,
        activities: metric.activities,
        notes: metric.notes,
        activityScore: metric.activityScore,
        overallWellnessScore: metric.overallWellnessScore
      }))
    });

  } catch (error) {
    console.error('❌ Get metrics by feeling error:', error);
    res.status(500).json({
      message: 'Internal server error while fetching metrics by feeling'
    });
  }
}

module.exports = {
  addDailyMetrics,
  getDailyMetrics,
  getMetricsAnalytics,
  updateWaterGoal,
  deleteDailyMetrics,
  getMetricsByFeeling
}; 