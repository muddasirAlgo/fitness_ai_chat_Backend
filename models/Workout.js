const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
  exerciseName: {
    type: String,
    required: true,
    trim: true
  },
  sets: {
    type: Number,
    required: true,
    min: 1
  },
  reps: {
    type: Number,
    required: true,
    min: 1
  },
  weight: {
    type: Number,
    min: 0,
    default: 0
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  }
});

const workoutSchema = new mongoose.Schema({
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
  workoutType: {
    type: String,
    enum: ['strength_training', 'cardio', 'flexibility', 'hiit', 'yoga', 'pilates'],
    required: true
  },
  workoutName: {
    type: String,
    required: true,
    trim: true
  },
  calories: {
    type: Number,
    required: true,
    min: 0
  },
  duration: {
    type: Number,
    required: true,
    min: 1
  },
  preference: {
    type: String,
    enum: ['low', 'moderate', 'high', 'very_high'],
    required: true
  },
  exercises: [exerciseSchema],
  totalSets: {
    type: Number,
    default: 0
  },
  totalReps: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  completed: {
    type: Boolean,
    default: false
  },
  completionTime: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for faster queries
workoutSchema.index({ user: 1, date: 1, workoutType: 1 });

// Pre-save middleware to calculate totals
workoutSchema.pre('save', function(next) {
  if (this.exercises && this.exercises.length > 0) {
    this.totalSets = this.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
    this.totalReps = this.exercises.reduce((sum, exercise) => sum + exercise.reps, 0);
  }
  next();
});

// Static method to get daily workouts
workoutSchema.statics.getDailyWorkouts = async function(userId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.find({
    user: userId,
    date: { $gte: startOfDay, $lte: endOfDay }
  }).sort({ workoutType: 1, createdAt: 1 });
};

// Static method to get daily workout summary
workoutSchema.statics.getDailyWorkoutSummary = async function(userId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const workouts = await this.find({
    user: userId,
    date: { $gte: startOfDay, $lte: endOfDay }
  });

  const summary = {
    totalCalories: 0,
    totalDuration: 0,
    totalSets: 0,
    totalReps: 0,
    workoutCount: workouts.length,
    completedWorkouts: 0,
    workouts: {}
  };

  workouts.forEach(workout => {
    summary.totalCalories += workout.calories;
    summary.totalDuration += workout.duration;
    summary.totalSets += workout.totalSets;
    summary.totalReps += workout.totalReps;
    
    if (workout.completed) {
      summary.completedWorkouts++;
    }
    
    if (!summary.workouts[workout.workoutType]) {
      summary.workouts[workout.workoutType] = [];
    }
    summary.workouts[workout.workoutType].push(workout);
  });

  return summary;
};

// Static method to get workout statistics
workoutSchema.statics.getWorkoutStats = async function(userId, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const stats = await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        date: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: '$workoutType',
        count: { $sum: 1 },
        totalCalories: { $sum: '$calories' },
        totalDuration: { $sum: '$duration' },
        totalSets: { $sum: '$totalSets' },
        totalReps: { $sum: '$totalReps' },
        completedCount: {
          $sum: { $cond: ['$completed', 1, 0] }
        }
      }
    }
  ]);

  return stats;
};

module.exports = mongoose.model('Workout', workoutSchema); 