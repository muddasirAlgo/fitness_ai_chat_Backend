const WaterSleep = require('../models/WaterSleep.js');

// Add water entry for a specific date
async function addWaterEntry(req, res) {
  try {
    const userId = req.user.id;
    const { date, amount, notes } = req.body;

    // Validation
    if (!date || !amount) {
      return res.status(400).json({
        message: 'Date and amount are required'
      });
    }

    if (amount < 0.1 || amount > 10) {
      return res.status(400).json({
        message: 'Water amount must be between 0.1L and 10L'
      });
    }

    // Parse date
    const waterDate = new Date(date);
    if (isNaN(waterDate.getTime())) {
      return res.status(400).json({
        message: 'Invalid date format'
      });
    }

    // Check if data already exists for this date
    const existingRecord = await WaterSleep.getDailyData(userId, waterDate);
    if (existingRecord && existingRecord.waterEntries && existingRecord.waterEntries.length > 0) {
      return res.status(400).json({
        message: 'Water data already exists for this date.'
      });
    }

    // Get or create daily record
    let dailyRecord = await WaterSleep.getDailyData(userId, waterDate);

    if (!dailyRecord) {
      dailyRecord = new WaterSleep({
        user: userId,
        date: waterDate,
        waterGoal: 2.5 // Default goal
      });
    }

    // Add water entry
    await dailyRecord.addWaterEntry(amount, notes || '');

    console.log(`✅ Water entry added: ${amount}L on ${date}`);

    res.status(201).json({
      message: 'Water entry added successfully',
      waterEntry: {
        amount: amount,
        timestamp: dailyRecord.waterEntries[dailyRecord.waterEntries.length - 1].timestamp,
        notes: notes || ''
      },
      dailySummary: {
        totalWaterIntake: dailyRecord.totalWaterIntake,
        waterGoal: dailyRecord.waterGoal,
        waterIntakePercentage: dailyRecord.waterIntakePercentage,
        waterEntriesCount: dailyRecord.waterEntries.length
      }
    });

  } catch (error) {
    console.error('❌ Add water entry error:', error);
    res.status(500).json({
      message: 'Internal server error while adding water entry'
    });
  }
}

// Add sleep data for a specific date
async function addSleepData(req, res) {
  try {
    const userId = req.user.id;
    const { 
      date, 
      sleepHours, 
      sleepQuality, 
      bedTime, 
      wakeupTime, 
      notes 
    } = req.body;

    // Validation
    if (!date || !sleepHours || !sleepQuality || !bedTime || !wakeupTime) {
      return res.status(400).json({
        message: 'Date, sleep hours, sleep quality, bed time, and wakeup time are required'
      });
    }

    if (!['poor', 'fair', 'good', 'excellent'].includes(sleepQuality)) {
      return res.status(400).json({
        message: 'Sleep quality must be poor, fair, good, or excellent'
      });
    }

    // Validate sleep hours is a valid number and within range
    if (isNaN(Number(sleepHours)) || Number(sleepHours) < 0.5 || Number(sleepHours) > 24) {
      return res.status(400).json({
        message: 'Sleep hours must be a valid number between 0.5 and 24'
      });
    }

    // Parse dates
    const sleepDate = new Date(date);
    const bedTimeDate = new Date(bedTime);
    const wakeupTimeDate = new Date(wakeupTime);

    if (isNaN(sleepDate.getTime()) || isNaN(bedTimeDate.getTime()) || isNaN(wakeupTimeDate.getTime())) {
      return res.status(400).json({
        message: 'Invalid date format'
      });
    }

    // Check if sleep data already exists for this date
    const existingRecord = await WaterSleep.getDailyData(userId, sleepDate);
    if (existingRecord && existingRecord.sleep) {
      return res.status(400).json({
        message: 'Sleep data already exists for this date.'
      });
    }

    // Get or create daily record
    let dailyRecord = await WaterSleep.getDailyData(userId, sleepDate);

    if (!dailyRecord) {
      dailyRecord = new WaterSleep({
        user: userId,
        date: sleepDate
      });
    }

    // Update sleep data
    await dailyRecord.updateSleep({
      sleepHours: Number(sleepHours),
      sleepQuality: sleepQuality,
      bedTime: bedTimeDate,
      wakeupTime: wakeupTimeDate,
      notes: notes || ''
    });

    console.log(`✅ Sleep data added: ${sleepHours} hours on ${date}`);

    res.status(201).json({
      message: 'Sleep data added successfully',
      sleepData: {
        sleepHours: dailyRecord.sleep.sleepHours,
        sleepQuality: dailyRecord.sleep.sleepQuality,
        bedTime: dailyRecord.sleep.bedTime,
        wakeupTime: dailyRecord.sleep.wakeupTime,
        notes: dailyRecord.sleep.notes
      },
      sleepAnalysis: dailyRecord.sleepAnalysis
    });

  } catch (error) {
    console.error('❌ Add sleep data error:', error);
    res.status(500).json({
      message: 'Internal server error while adding sleep data'
    });
  }
}

// Get daily water and sleep data with analysis
async function getDailyData(req, res) {
  try {
    const userId = req.user.id;
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({
        message: 'Date parameter is required'
      });
    }

    const dataDate = new Date(date);
    if (isNaN(dataDate.getTime())) {
      return res.status(400).json({
        message: 'Invalid date format'
      });
    }

    const dailyRecord = await WaterSleep.getDailyData(userId, dataDate);

    if (!dailyRecord) {
      return res.json({
        message: 'No data found for this date',
        date: date,
        data: {
          waterEntries: [],
          totalWaterIntake: 0,
          waterGoal: 2.5,
          waterIntakePercentage: 0,
          sleep: null,
          sleepAnalysis: 'adequate'
        },
        analysis: {
          waterIntakePercentage: 0,
          sleepHours: 0,
          waterEntries: 0,
          sleepQuality: null,
          recommendations: [
            'Start tracking your water intake',
            'Begin monitoring your sleep patterns'
          ]
        }
      });
    }

    // Generate recommendations based on data
    const recommendations = [];
    
    if (dailyRecord.waterIntakePercentage < 80) {
      recommendations.push('Increase your water intake to meet your daily goal');
    } else if (dailyRecord.waterIntakePercentage >= 100) {
      recommendations.push('Great job! You\'ve met your water intake goal');
    }

    if (dailyRecord.sleep) {
      if (dailyRecord.sleep.sleepHours < 6) {
        recommendations.push('Consider getting more sleep for better health');
      } else if (dailyRecord.sleep.sleepHours > 9) {
        recommendations.push('You\'re getting plenty of sleep, which is great!');
      }

      if (dailyRecord.sleep.sleepQuality === 'poor' || dailyRecord.sleep.sleepQuality === 'fair') {
        recommendations.push('Try to improve your sleep quality with better sleep hygiene');
      }
    } else {
      recommendations.push('Start tracking your sleep patterns');
    }

    console.log(`✅ Retrieved daily data for ${date}`);

    res.json({
      message: 'Daily data retrieved successfully',
      date: date,
      data: {
        waterEntries: dailyRecord.waterEntries.map(entry => ({
          amount: entry.amount,
          timestamp: entry.timestamp,
          notes: entry.notes
        })),
        totalWaterIntake: dailyRecord.totalWaterIntake,
        waterGoal: dailyRecord.waterGoal,
        waterIntakePercentage: dailyRecord.waterIntakePercentage,
        sleep: dailyRecord.sleep ? {
          sleepHours: dailyRecord.sleep.sleepHours,
          sleepQuality: dailyRecord.sleep.sleepQuality,
          bedTime: dailyRecord.sleep.bedTime,
          wakeupTime: dailyRecord.sleep.wakeupTime,
          notes: dailyRecord.sleep.notes
        } : null,
        sleepAnalysis: dailyRecord.sleepAnalysis
      },
      analysis: {
        waterIntakePercentage: dailyRecord.waterIntakePercentage,
        sleepHours: dailyRecord.sleep ? dailyRecord.sleep.sleepHours : 0,
        waterEntries: dailyRecord.waterEntries.length,
        sleepQuality: dailyRecord.sleep ? dailyRecord.sleep.sleepQuality : null,
        recommendations: recommendations
      }
    });

  } catch (error) {
    console.error('❌ Get daily data error:', error);
    res.status(500).json({
      message: 'Internal server error while fetching daily data'
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

    let dailyRecord = await WaterSleep.getDailyData(userId, goalDate);

    if (!dailyRecord) {
      dailyRecord = new WaterSleep({
        user: userId,
        date: goalDate
      });
    }

    await dailyRecord.updateWaterGoal(waterGoal);

    console.log(`✅ Water goal updated: ${waterGoal}L for ${date}`);

    res.json({
      message: 'Water goal updated successfully',
      waterGoal: dailyRecord.waterGoal,
      waterIntakePercentage: dailyRecord.waterIntakePercentage
    });

  } catch (error) {
    console.error('❌ Update water goal error:', error);
    res.status(500).json({
      message: 'Internal server error while updating water goal'
    });
  }
}

// Get weekly summary
async function getWeeklySummary(req, res) {
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

    const weeklySummary = await WaterSleep.getWeeklySummary(userId, start, end);

    console.log(`✅ Retrieved weekly summary`);

    res.json({
      message: 'Weekly summary retrieved successfully',
      startDate: startDate,
      endDate: endDate,
      summary: weeklySummary
    });

  } catch (error) {
    console.error('❌ Get weekly summary error:', error);
    res.status(500).json({
      message: 'Internal server error while fetching weekly summary'
    });
  }
}

// Delete water entry
async function deleteWaterEntry(req, res) {
  try {
    const userId = req.user.id;
    const { date, entryIndex } = req.params;

    if (!date || entryIndex === undefined) {
      return res.status(400).json({
        message: 'Date and entry index are required'
      });
    }

    const dataDate = new Date(date);
    if (isNaN(dataDate.getTime())) {
      return res.status(400).json({
        message: 'Invalid date format'
      });
    }

    const dailyRecord = await WaterSleep.getDailyData(userId, dataDate);

    if (!dailyRecord) {
      return res.status(404).json({
        message: 'No data found for this date'
      });
    }

    const index = parseInt(entryIndex);
    if (index < 0 || index >= dailyRecord.waterEntries.length) {
      return res.status(400).json({
        message: 'Invalid entry index'
      });
    }

    const deletedEntry = dailyRecord.waterEntries[index];
    dailyRecord.waterEntries.splice(index, 1);
    await dailyRecord.save();

    console.log(`✅ Water entry deleted: ${deletedEntry.amount}L`);

    res.json({
      message: 'Water entry deleted successfully',
      deletedEntry: {
        amount: deletedEntry.amount,
        timestamp: deletedEntry.timestamp
      },
      updatedSummary: {
        totalWaterIntake: dailyRecord.totalWaterIntake,
        waterIntakePercentage: dailyRecord.waterIntakePercentage,
        waterEntriesCount: dailyRecord.waterEntries.length
      }
    });

  } catch (error) {
    console.error('❌ Delete water entry error:', error);
    res.status(500).json({
      message: 'Internal server error while deleting water entry'
    });
  }
}

module.exports = {
  addWaterEntry,
  addSleepData,
  getDailyData,
  updateWaterGoal,
  getWeeklySummary,
  deleteWaterEntry
}; 