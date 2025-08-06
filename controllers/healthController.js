const HealthMetrics = require('../models/HealthMetrics.js');
const User = require('../models/User.js');

// Create or update health metrics
async function createHealthMetrics(req, res) {
  const { height, weight, dob, dailyIntakeProteins, dailyIntakeCalories, fat } = req.body;

  try {
    // Check for empty fields and collect them
    const emptyFields = [];
    if (!height) emptyFields.push('height');
    if (!weight) emptyFields.push('weight');
    if (!dob) emptyFields.push('dob');
    if (!dailyIntakeProteins) emptyFields.push('dailyIntakeProteins');
    if (!dailyIntakeCalories) emptyFields.push('dailyIntakeCalories');
    if (!fat) emptyFields.push('fat');

    if (emptyFields.length > 0) {
      return res.status(400).json({ 
        message: `${emptyFields.join(', ')} field are required` 
      });
    }

    // Validate numeric fields
    if (isNaN(height) || height <= 0) {
      return res.status(400).json({ 
        message: 'Height must be a positive number' 
      });
    }

    if (isNaN(weight) || weight <= 0) {
      return res.status(400).json({ 
        message: 'Weight must be a positive number' 
      });
    }

    if (isNaN(dailyIntakeProteins) || dailyIntakeProteins < 0) {
      return res.status(400).json({ 
        message: 'Daily protein intake must be a non-negative number' 
      });
    }

    if (isNaN(dailyIntakeCalories) || dailyIntakeCalories < 0) {
      return res.status(400).json({ 
        message: 'Daily calorie intake must be a non-negative number' 
      });
    }

    if (isNaN(fat) || fat < 0) {
      return res.status(400).json({ 
        message: 'Fat intake must be a non-negative number' 
      });
    }

    // Validate DOB
    const dobDate = new Date(dob);
    if (isNaN(dobDate.getTime())) {
      return res.status(400).json({ 
        message: 'Invalid date of birth format' 
      });
    }

    // Check if DOB is in the future
    if (dobDate > new Date()) {
      return res.status(400).json({ 
        message: 'Date of birth cannot be in the future' 
      });
    }

    // Check if user exists
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        message: 'User not found' 
      });
    }

    // Check if health metrics already exist for this user
    let healthMetrics = await HealthMetrics.findOne({ user: req.user.id });

    if (healthMetrics) {
      // Update existing health metrics
      healthMetrics.height = height;
      healthMetrics.weight = weight;
      healthMetrics.dob = dobDate;
      healthMetrics.dailyIntakeProteins = dailyIntakeProteins;
      healthMetrics.dailyIntakeCalories = dailyIntakeCalories;
      healthMetrics.fat = fat;
      
      await healthMetrics.save();
      
      res.json({
        message: 'Health metrics updated successfully',
        healthMetrics: healthMetrics.getHealthSummary()
      });
    } else {
      // Create new health metrics
      healthMetrics = await HealthMetrics.create({
        user: req.user.id,
        height,
        weight,
        dob: dobDate,
        dailyIntakeProteins,
        dailyIntakeCalories,
        fat
      });

      res.status(201).json({
        message: 'Health metrics created successfully',
        healthMetrics: healthMetrics.getHealthSummary()
      });
    }

  } catch (error) {
    // Handle validation errors from mongoose
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationErrors 
      });
    }

    // Handle database connection errors
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
      return res.status(500).json({ 
        message: 'Database connection failed. Please try again later.' 
      });
    }

    // Handle other errors
    console.error('Create health metrics error:', error);
    res.status(500).json({ 
      message: 'Internal server error while creating health metrics' 
    });
  }
}

// Get health metrics for the authenticated user
async function getHealthMetrics(req, res) {
  try {
    const healthMetrics = await HealthMetrics.findOne({ user: req.user.id });

    if (!healthMetrics) {
      return res.status(404).json({ 
        message: 'Health metrics not found. Please create your health profile first.' 
      });
    }

    res.json({
      message: 'Health metrics retrieved successfully',
      healthMetrics: healthMetrics.getHealthSummary()
    });

  } catch (error) {
    console.error('Get health metrics error:', error);
    res.status(500).json({ 
      message: 'Internal server error while fetching health metrics' 
    });
  }
}

// Update specific health metrics fields
async function updateHealthMetrics(req, res) {
  const { height, weight, dob, dailyIntakeProteins, dailyIntakeCalories, fat } = req.body;

  try {
    // Check if at least one field is provided
    if (!height && !weight && !dob && !dailyIntakeProteins && !dailyIntakeCalories && !fat) {
      return res.status(400).json({ 
        message: 'At least one field is required for update' 
      });
    }

    // Find existing health metrics
    let healthMetrics = await HealthMetrics.findOne({ user: req.user.id });

    if (!healthMetrics) {
      return res.status(404).json({ 
        message: 'Health metrics not found. Please create your health profile first.' 
      });
    }

    const updateData = {};

    // Validate and prepare update data
    if (height !== undefined && height !== null) {
      if (isNaN(height) || height <= 0) {
        return res.status(400).json({ 
          message: 'Height must be a positive number' 
        });
      }
      updateData.height = height;
    }

    if (weight !== undefined && weight !== null) {
      if (isNaN(weight) || weight <= 0) {
        return res.status(400).json({ 
          message: 'Weight must be a positive number' 
        });
      }
      updateData.weight = weight;
    }

    if (dob !== undefined && dob !== null) {
      const dobDate = new Date(dob);
      if (isNaN(dobDate.getTime())) {
        return res.status(400).json({ 
          message: 'Invalid date of birth format' 
        });
      }
      if (dobDate > new Date()) {
        return res.status(400).json({ 
          message: 'Date of birth cannot be in the future' 
        });
      }
      updateData.dob = dobDate;
    }

    if (dailyIntakeProteins !== undefined && dailyIntakeProteins !== null) {
      if (isNaN(dailyIntakeProteins) || dailyIntakeProteins < 0) {
        return res.status(400).json({ 
          message: 'Daily protein intake must be a non-negative number' 
        });
      }
      updateData.dailyIntakeProteins = dailyIntakeProteins;
    }

    if (dailyIntakeCalories !== undefined && dailyIntakeCalories !== null) {
      if (isNaN(dailyIntakeCalories) || dailyIntakeCalories < 0) {
        return res.status(400).json({ 
          message: 'Daily calorie intake must be a non-negative number' 
        });
      }
      updateData.dailyIntakeCalories = dailyIntakeCalories;
    }

    if (fat !== undefined && fat !== null) {
      if (isNaN(fat) || fat < 0) {
        return res.status(400).json({ 
          message: 'Fat intake must be a non-negative number' 
        });
      }
      updateData.fat = fat;
    }

    // Update health metrics
    const updatedHealthMetrics = await HealthMetrics.findOneAndUpdate(
      { user: req.user.id },
      updateData,
      { 
        new: true, // Return updated document
        runValidators: true // Run mongoose validators
      }
    );

    // Get the list of updated fields for the response
    const updatedFields = Object.keys(updateData);
    const updateMessage = updatedFields.length === 1 
      ? `${updatedFields[0]} updated successfully`
      : `${updatedFields.join(', ')} updated successfully`;

    res.json({
      message: updateMessage,
      updatedFields: updatedFields,
      healthMetrics: updatedHealthMetrics.getHealthSummary()
    });

  } catch (error) {
    // Handle validation errors from mongoose
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationErrors 
      });
    }

    // Handle database connection errors
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
      return res.status(500).json({ 
        message: 'Database connection failed. Please try again later.' 
      });
    }

    // Handle other errors
    console.error('Update health metrics error:', error);
    res.status(500).json({ 
      message: 'Internal server error while updating health metrics' 
    });
  }
}

// Delete health metrics
async function deleteHealthMetrics(req, res) {
  try {
    const healthMetrics = await HealthMetrics.findOneAndDelete({ user: req.user.id });

    if (!healthMetrics) {
      return res.status(404).json({ 
        message: 'Health metrics not found' 
      });
    }

    res.json({
      message: 'Health metrics deleted successfully'
    });

  } catch (error) {
    console.error('Delete health metrics error:', error);
    res.status(500).json({ 
      message: 'Internal server error while deleting health metrics' 
    });
  }
}

// Get health insights and recommendations
async function getHealthInsights(req, res) {
  try {
    const healthMetrics = await HealthMetrics.findOne({ user: req.user.id });

    if (!healthMetrics) {
      return res.status(404).json({ 
        message: 'Health metrics not found. Please create your health profile first.' 
      });
    }

    const insights = {
      bmi: {
        value: healthMetrics.bmi,
        category: healthMetrics.getBMICategory(),
        recommendation: getBMIRecommendation(healthMetrics.bmi)
      },
      age: healthMetrics.age,
      nutrition: {
        calories: {
          value: healthMetrics.dailyIntakeCalories,
          recommendation: getCalorieRecommendation(healthMetrics.age, healthMetrics.weight, healthMetrics.height)
        },
        proteins: {
          value: healthMetrics.dailyIntakeProteins,
          recommendation: getProteinRecommendation(healthMetrics.weight)
        },
        fat: {
          value: healthMetrics.fat,
          recommendation: getFatRecommendation(healthMetrics.dailyIntakeCalories)
        }
      }
    };

    res.json({
      message: 'Health insights retrieved successfully',
      insights
    });

  } catch (error) {
    console.error('Get health insights error:', error);
    res.status(500).json({ 
      message: 'Internal server error while fetching health insights' 
    });
  }
}

// Helper functions for recommendations
function getBMIRecommendation(bmi) {
  if (!bmi) return 'BMI not available';
  
  if (bmi < 18.5) {
    return 'Consider increasing your caloric intake and protein consumption to gain healthy weight.';
  } else if (bmi >= 18.5 && bmi < 25) {
    return 'Your BMI is in the healthy range. Maintain a balanced diet and regular exercise.';
  } else if (bmi >= 25 && bmi < 30) {
    return 'Consider reducing caloric intake and increasing physical activity to reach a healthy weight.';
  } else {
    return 'Consult with a healthcare provider for a personalized weight management plan.';
  }
}

function getCalorieRecommendation(age, weight, height) {
  // Basic BMR calculation using Mifflin-St Jeor Equation
  const bmr = 10 * weight + 6.25 * height - 5 * age + 5; // For males
  const tdee = bmr * 1.2; // Sedentary lifestyle multiplier
  
  return {
    recommended: Math.round(tdee),
    current: weight * 30, // Rough estimate
    status: 'maintain' // or 'increase', 'decrease'
  };
}

function getProteinRecommendation(weight) {
  const recommended = weight * 1.6; // 1.6g per kg body weight
  return {
    recommended: Math.round(recommended),
    unit: 'g/day'
  };
}

function getFatRecommendation(calories) {
  const recommended = (calories * 0.25) / 9; // 25% of calories from fat
  return {
    recommended: Math.round(recommended),
    unit: 'g/day'
  };
}

module.exports = {
  createHealthMetrics,
  getHealthMetrics,
  updateHealthMetrics,
  deleteHealthMetrics,
  getHealthInsights
}; 