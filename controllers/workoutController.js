const Workout = require('../models/Workout.js');

// Add a workout for a specific date and workout type
async function addWorkout(req, res) {
  try {
    const userId = req.user.id;
    const { 
      date, 
      workoutType, 
      workoutName, 
      calories, 
      duration, 
      preference, 
      exercises, 
      notes 
    } = req.body;

    // Validation
    if (!date || !workoutType || !workoutName || !calories || !duration || !preference) {
      return res.status(400).json({
        message: 'Date, workout type, workout name, calories, duration, and preference are required'
      });
    }

    if (!['strength_training', 'cardio', 'flexibility', 'hiit', 'yoga', 'pilates'].includes(workoutType)) {
      return res.status(400).json({
        message: 'Workout type must be strength_training, cardio, flexibility, hiit, yoga, or pilates'
      });
    }

    if (!['low', 'moderate', 'high', 'very_high'].includes(preference)) {
      return res.status(400).json({
        message: 'Preference must be low, moderate, high, or very_high'
      });
    }

    // Validate calories is a valid number and non-negative
    if (isNaN(Number(calories)) || Number(calories) < 0) {
      return res.status(400).json({
        message: 'Calories must be a valid non-negative number'
      });
    }

    // Validate duration is a valid number and positive
    if (isNaN(Number(duration)) || Number(duration) <= 0) {
      return res.status(400).json({
        message: 'Duration must be a valid positive number'
      });
    }

    // Validate exercises if provided
    if (exercises && Array.isArray(exercises)) {
      for (let i = 0; i < exercises.length; i++) {
        const exercise = exercises[i];
        if (!exercise.exerciseName || !exercise.sets || !exercise.reps) {
          return res.status(400).json({
            message: `Exercise ${i + 1} is missing required fields: exerciseName, sets, reps`
          });
        }

        if (isNaN(Number(exercise.sets)) || Number(exercise.sets) < 1 || 
            isNaN(Number(exercise.reps)) || Number(exercise.reps) < 1) {
          return res.status(400).json({
            message: `Exercise ${i + 1} has invalid sets or reps - must be valid positive numbers`
          });
        }

        if (exercise.weight !== undefined && exercise.weight !== null) {
          if (isNaN(Number(exercise.weight)) || Number(exercise.weight) < 0) {
            return res.status(400).json({
              message: `Exercise ${i + 1} has invalid weight - must be a valid non-negative number`
            });
          }
        }
      }
    }

    // Parse date
    const workoutDate = new Date(date);
    if (isNaN(workoutDate.getTime())) {
      return res.status(400).json({
        message: 'Invalid date format'
      });
    }

    // Check if workout already exists for this date and type
    const existingWorkout = await Workout.findOne({
      user: userId,
      date: {
        $gte: new Date(workoutDate.getFullYear(), workoutDate.getMonth(), workoutDate.getDate()),
        $lt: new Date(workoutDate.getFullYear(), workoutDate.getMonth(), workoutDate.getDate() + 1)
      },
      workoutType: workoutType
    });

    if (existingWorkout) {
      return res.status(400).json({
        message: `A ${workoutType} workout already exists for this date.`
      });
    }

    // Create new workout
    const workout = new Workout({
      user: userId,
      date: workoutDate,
      workoutType: workoutType,
      workoutName: workoutName.trim(),
      calories: Number(calories),
      duration: Number(duration),
      preference: preference,
      exercises: exercises || [],
      notes: notes || ''
    });

    await workout.save();

    console.log(`✅ Workout added successfully: ${workoutName} (${workoutType}) on ${date}`);

    res.status(201).json({
      message: `${workoutType} workout added successfully`,
      workout: {
        id: workout._id,
        date: workout.date,
        workoutType: workout.workoutType,
        workoutName: workout.workoutName,
        calories: workout.calories,
        duration: workout.duration,
        preference: workout.preference,
        exercises: workout.exercises,
        totalSets: workout.totalSets,
        totalReps: workout.totalReps,
        notes: workout.notes,
        completed: workout.completed
      }
    });

  } catch (error) {
    console.error('❌ Add workout error:', error);
    res.status(500).json({
      message: 'Internal server error while adding workout'
    });
  }
}

// Update an existing workout
async function updateWorkout(req, res) {
  try {
    const userId = req.user.id;
    const { workoutId } = req.params;
    const { 
      workoutName, 
      calories, 
      duration, 
      preference, 
      exercises, 
      notes 
    } = req.body;

    if (!workoutName && !calories && !duration && !preference && !exercises && !notes) {
      return res.status(400).json({
        message: 'At least one field is required for update'
      });
    }

    const updateData = {};

    if (workoutName !== undefined) {
      updateData.workoutName = workoutName.trim();
    }

    if (calories !== undefined) {
      if (isNaN(Number(calories)) || Number(calories) < 0) {
        return res.status(400).json({
          message: 'Calories must be a valid non-negative number'
        });
      }
      updateData.calories = Number(calories);
    }

    if (duration !== undefined) {
      if (isNaN(Number(duration)) || Number(duration) <= 0) {
        return res.status(400).json({
          message: 'Duration must be a valid positive number'
        });
      }
      updateData.duration = Number(duration);
    }

    if (preference !== undefined) {
      if (!['low', 'moderate', 'high', 'very_high'].includes(preference)) {
        return res.status(400).json({
          message: 'Preference must be low, moderate, high, or very_high'
        });
      }
      updateData.preference = preference;
    }

    if (exercises !== undefined) {
      if (Array.isArray(exercises)) {
        // Validate exercises
        for (let i = 0; i < exercises.length; i++) {
          const exercise = exercises[i];
          if (!exercise.exerciseName || !exercise.sets || !exercise.reps) {
            return res.status(400).json({
              message: `Exercise ${i + 1} is missing required fields: exerciseName, sets, reps`
            });
          }
          
          // Validate sets and reps are valid numbers
          if (isNaN(Number(exercise.sets)) || Number(exercise.sets) < 1 || 
              isNaN(Number(exercise.reps)) || Number(exercise.reps) < 1) {
            return res.status(400).json({
              message: `Exercise ${i + 1} has invalid sets or reps - must be valid positive numbers`
            });
          }
          
          // Validate weight if provided
          if (exercise.weight !== undefined && exercise.weight !== null) {
            if (isNaN(Number(exercise.weight)) || Number(exercise.weight) < 0) {
              return res.status(400).json({
                message: `Exercise ${i + 1} has invalid weight - must be a valid non-negative number`
              });
            }
          }
        }
        updateData.exercises = exercises;
      }
    }

    if (notes !== undefined) {
      updateData.notes = notes.trim();
    }

    // Find and update workout
    const workout = await Workout.findOneAndUpdate(
      { _id: workoutId, user: userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!workout) {
      return res.status(404).json({
        message: 'Workout not found'
      });
    }

    console.log(`✅ Workout updated successfully: ${workout.workoutName}`);

    res.json({
      message: 'Workout updated successfully',
      workout: {
        id: workout._id,
        date: workout.date,
        workoutType: workout.workoutType,
        workoutName: workout.workoutName,
        calories: workout.calories,
        duration: workout.duration,
        preference: workout.preference,
        exercises: workout.exercises,
        totalSets: workout.totalSets,
        totalReps: workout.totalReps,
        notes: workout.notes,
        completed: workout.completed
      }
    });

  } catch (error) {
    console.error('❌ Update workout error:', error);
    res.status(500).json({
      message: 'Internal server error while updating workout'
    });
  }
}

// Mark workout as completed
async function completeWorkout(req, res) {
  try {
    const userId = req.user.id;
    const { workoutId } = req.params;

    const workout = await Workout.findOneAndUpdate(
      { _id: workoutId, user: userId },
      { 
        completed: true, 
        completionTime: new Date() 
      },
      { new: true }
    );

    if (!workout) {
      return res.status(404).json({
        message: 'Workout not found'
      });
    }

    console.log(`✅ Workout marked as completed: ${workout.workoutName}`);

    res.json({
      message: 'Workout marked as completed',
      workout: {
        id: workout._id,
        workoutName: workout.workoutName,
        completed: workout.completed,
        completionTime: workout.completionTime
      }
    });

  } catch (error) {
    console.error('❌ Complete workout error:', error);
    res.status(500).json({
      message: 'Internal server error while completing workout'
    });
  }
}

// Get workouts for a specific date
async function getWorkoutsByDate(req, res) {
  try {
    const userId = req.user.id;
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({
        message: 'Date parameter is required'
      });
    }

    const workoutDate = new Date(date);
    if (isNaN(workoutDate.getTime())) {
      return res.status(400).json({
        message: 'Invalid date format'
      });
    }

    const workouts = await Workout.getDailyWorkouts(userId, workoutDate);

    console.log(`✅ Retrieved ${workouts.length} workouts for ${date}`);

    res.json({
      message: 'Workouts retrieved successfully',
      date: date,
      workouts: workouts.map(workout => ({
        id: workout._id,
        workoutType: workout.workoutType,
        workoutName: workout.workoutName,
        calories: workout.calories,
        duration: workout.duration,
        preference: workout.preference,
        exercises: workout.exercises,
        totalSets: workout.totalSets,
        totalReps: workout.totalReps,
        notes: workout.notes,
        completed: workout.completed,
        completionTime: workout.completionTime,
        createdAt: workout.createdAt
      }))
    });

  } catch (error) {
    console.error('❌ Get workouts by date error:', error);
    res.status(500).json({
      message: 'Internal server error while fetching workouts'
    });
  }
}

// Get daily workout summary
async function getDailyWorkoutSummary(req, res) {
  try {
    const userId = req.user.id;
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({
        message: 'Date parameter is required'
      });
    }

    const workoutDate = new Date(date);
    if (isNaN(workoutDate.getTime())) {
      return res.status(400).json({
        message: 'Invalid date format'
      });
    }

    const workoutSummary = await Workout.getDailyWorkoutSummary(userId, workoutDate);

    console.log(`✅ Retrieved workout summary for ${date}`);

    res.json({
      message: 'Daily workout summary retrieved successfully',
      date: date,
      summary: workoutSummary
    });

  } catch (error) {
    console.error('❌ Get daily workout summary error:', error);
    res.status(500).json({
      message: 'Internal server error while fetching workout summary'
    });
  }
}

// Delete a workout
async function deleteWorkout(req, res) {
  try {
    const userId = req.user.id;
    const { workoutId } = req.params;

    const workout = await Workout.findOneAndDelete({ _id: workoutId, user: userId });

    if (!workout) {
      return res.status(404).json({
        message: 'Workout not found'
      });
    }

    console.log(`✅ Workout deleted successfully: ${workout.workoutName}`);

    res.json({
      message: 'Workout deleted successfully',
      deletedWorkout: {
        id: workout._id,
        workoutName: workout.workoutName,
        workoutType: workout.workoutType,
        date: workout.date
      }
    });

  } catch (error) {
    console.error('❌ Delete workout error:', error);
    res.status(500).json({
      message: 'Internal server error while deleting workout'
    });
  }
}

// Get workout statistics for a date range
async function getWorkoutStats(req, res) {
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

    const stats = await Workout.getWorkoutStats(userId, start, end);

    console.log(`✅ Retrieved workout stats for date range`);

    res.json({
      message: 'Workout statistics retrieved successfully',
      startDate: startDate,
      endDate: endDate,
      stats: stats
    });

  } catch (error) {
    console.error('❌ Get workout stats error:', error);
    res.status(500).json({
      message: 'Internal server error while fetching workout statistics'
    });
  }
}

module.exports = {
  addWorkout,
  updateWorkout,
  completeWorkout,
  getWorkoutsByDate,
  getDailyWorkoutSummary,
  deleteWorkout,
  getWorkoutStats
}; 