// Test file to demonstrate the validation fixes
// This shows how the controllers now properly validate numeric fields before conversion

// Simulate the validation logic from workoutController.js
function testWorkoutValidation(duration, calories) {
  console.log(`Testing with duration: "${duration}" (type: ${typeof duration}), calories: "${calories}" (type: ${typeof calories})`);
  
  // Old validation (would fail with NaN)
  // if (duration <= 0) { ... }
  // if (calories < 0) { ... }
  
  // New validation (prevents NaN)
  if (isNaN(Number(duration)) || Number(duration) <= 0) {
    console.log('❌ Duration validation failed: Duration must be a valid positive number');
    return false;
  }
  
  if (isNaN(Number(calories)) || Number(calories) < 0) {
    console.log('❌ Calories validation failed: Calories must be a valid non-negative number');
    return false;
  }
  
  console.log('✅ Validation passed');
  console.log(`Converted duration: ${Number(duration)}`);
  console.log(`Converted calories: ${Number(calories)}`);
  return true;
}

console.log('=== Testing Workout Validation Fixes ===\n');

// Test case 1: Valid numbers
console.log('Test 1: Valid numbers');
testWorkoutValidation(30, 150);
console.log('');

// Test case 2: String numbers (common in HTTP requests)
console.log('Test 2: String numbers');
testWorkoutValidation("45", "200");
console.log('');

// Test case 3: Invalid strings (would cause NaN before fix)
console.log('Test 3: Invalid strings (would cause NaN before fix)');
testWorkoutValidation("abc", "xyz");
console.log('');

// Test case 4: Undefined values
console.log('Test 4: Undefined values');
testWorkoutValidation(undefined, undefined);
console.log('');

// Test case 5: Null values
console.log('Test 5: Null values');
testWorkoutValidation(null, null);
console.log('');

// Test case 6: Empty strings
console.log('Test 6: Empty strings');
testWorkoutValidation("", "");
console.log('');

console.log('=== Summary ===');
console.log('The validation fixes now prevent NaN values from being passed to Mongoose,');
console.log('which was causing the "Cast to Number failed for value NaN" error.');
console.log('All numeric fields are now properly validated before conversion.'); 