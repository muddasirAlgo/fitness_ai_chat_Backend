const mongoose = require('mongoose');

const healthMetricsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  height: {
    type: Number,
    required: [true, 'Height is required'],
    min: [50, 'Height must be at least 50 cm'],
    max: [300, 'Height cannot exceed 300 cm']
  },
  weight: {
    type: Number,
    required: [true, 'Weight is required'],
    min: [20, 'Weight must be at least 20 kg'],
    max: [500, 'Weight cannot exceed 500 kg']
  },
  dob: {
    type: Date,
    required: [true, 'Date of birth is required'],
    validate: {
      validator: function(value) {
        // Check if DOB is not in the future and reasonable (not older than 150 years)
        const now = new Date();
        const minDate = new Date(now.getFullYear() - 150, now.getMonth(), now.getDate());
        const maxDate = new Date();
        return value >= minDate && value <= maxDate;
      },
      message: 'Date of birth must be a valid date and not in the future'
    }
  },
  dailyIntakeProteins: {
    type: Number,
    required: [true, 'Daily protein intake is required'],
    min: [0, 'Protein intake cannot be negative'],
    max: [1000, 'Protein intake cannot exceed 1000g']
  },
  dailyIntakeCalories: {
    type: Number,
    required: [true, 'Daily calorie intake is required'],
    min: [0, 'Calorie intake cannot be negative'],
    max: [10000, 'Calorie intake cannot exceed 10000 calories']
  },
  fat: {
    type: Number,
    required: [true, 'Fat intake is required'],
    min: [0, 'Fat intake cannot be negative'],
    max: [500, 'Fat intake cannot exceed 500g']
  },
  bmi: {
    type: Number,
    default: null
  },
  age: {
    type: Number,
    default: null
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Calculate BMI before saving
healthMetricsSchema.pre('save', function(next) {
  if (this.height && this.weight) {
    // BMI = weight (kg) / height (m)²
    const heightInMeters = this.height / 100;
    this.bmi = Math.round((this.weight / (heightInMeters * heightInMeters)) * 10) / 10;
  }
  
  // Calculate age from DOB
  if (this.dob) {
    const today = new Date();
    const birthDate = new Date(this.dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    this.age = age;
  }
  
  this.lastUpdated = new Date();
  next();
});

// Method to get BMI category
healthMetricsSchema.methods.getBMICategory = function() {
  if (!this.bmi) return 'Not available';
  
  if (this.bmi < 18.5) return 'Underweight';
  if (this.bmi >= 18.5 && this.bmi < 25) return 'Normal weight';
  if (this.bmi >= 25 && this.bmi < 30) return 'Overweight';
  return 'Obese';
};

// Method to get health summary
healthMetricsSchema.methods.getHealthSummary = function() {
  return {
    bmi: this.bmi,
    bmiCategory: this.getBMICategory(),
    age: this.age,
    height: this.height,
    weight: this.weight,
    dailyIntake: {
      calories: this.dailyIntakeCalories,
      proteins: this.dailyIntakeProteins,
      fat: this.fat
    }
  };
};

// Static method to get average metrics for age group
healthMetricsSchema.statics.getAverageMetrics = async function(ageGroup) {
  const pipeline = [
    {
      $match: {
        age: { $gte: ageGroup.min, $lte: ageGroup.max }
      }
    },
    {
      $group: {
        _id: null,
        avgHeight: { $avg: '$height' },
        avgWeight: { $avg: '$weight' },
        avgBMI: { $avg: '$bmi' },
        avgCalories: { $avg: '$dailyIntakeCalories' },
        avgProteins: { $avg: '$dailyIntakeProteins' },
        avgFat: { $avg: '$fat' }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || null;
};

module.exports = mongoose.model('HealthMetrics', healthMetricsSchema); 