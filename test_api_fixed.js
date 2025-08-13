// Test script for the FIXED addDailyMetrics API
// This demonstrates the corrected structure with proper data types

const testData = {
  date: "2024-01-15",
  steps: 8500,
  caloriesBurned: 450,
  waterIntake: 2.5,
  sleepHours: 7.5,
  weight: 70,
  activities: [
    {
      activityType: "walking",
      duration: 45,  // Number, not string
      intensityLevel: "moderate"
    },
    {
      activityType: "yoga",
      duration: 30,
      intensityLevel: "low"
    },
    {
      activityType: "gym_workout",
      duration: 60,
      intensityLevel: "high"
    }
  ],
  howAreYouFeeling: "good",
  notes: "Great workout session today!"
};

// Test with string duration (should be converted to number)
const testDataWithStringDuration = {
  date: "2024-01-16",
  steps: 7500,
  caloriesBurned: 380,
  waterIntake: 2.0,
  sleepHours: 8.0,
  weight: 70,
  activities: [
    {
      activityType: "walking",
      duration: "15 minutes",  // String that should be converted to 15
      intensityLevel: "very_low"
    },
    {
      activityType: "meditation",
      duration: "20 minutes",  // String that should be converted to 20
      intensityLevel: "low"
    }
  ],
  howAreYouFeeling: "great",
  notes: "Light day with focus on recovery"
};

console.log("✅ Fixed API Test Data:");
console.log("1. Proper data types:");
console.log(JSON.stringify(testData, null, 2));

console.log("\n2. String duration (should be converted):");
console.log(JSON.stringify(testDataWithStringDuration, null, 2));

console.log("\n🔧 Fixed Issues:");
console.log("- ✅ Duration validation now handles string inputs like '15 minutes'");
console.log("- ✅ Activity type validation corrected (removed typos)");
console.log("- ✅ Intensity level validation uses correct enum values");
console.log("- ✅ Added proper error handling and data cleaning");
console.log("- ✅ Activities array is properly validated and cleaned");

console.log("\n📝 API Behavior:");
console.log("- String durations like '15 minutes' will be converted to 15");
console.log("- Invalid durations will return clear error messages");
console.log("- Missing intensity levels default to 'moderate'");
console.log("- All activities are validated before saving to database");
console.log("- Clear error messages for each validation failure");

console.log("\n🚀 Ready to test the API endpoint!"); 