const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    lowercase: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
  },
  phoneNumber: {
    type: String,
    default: null,
  },
  location: {
    type: String,
    default: null,
  },
  address: {
    type: String,
    default: null,
  },
  purposeOfJoining: {
    type: String,
    default: null,
  },
  isProfileComplete: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Method to check if profile is complete
profileSchema.methods.checkProfileComplete = function() {
  return !!(this.phoneNumber && this.location && this.address && this.purposeOfJoining);
};

// Pre-save middleware to update isProfileComplete
profileSchema.pre('save', function(next) {
  this.isProfileComplete = this.checkProfileComplete();
  next();
});

module.exports = mongoose.model('Profile', profileSchema); 