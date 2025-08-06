const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  otp: {
    type: String,
    required: true,
    length: 6
  },
  purpose: {
    type: String,
    enum: ['password_reset', 'email_verification'],
    default: 'password_reset'
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  isExpired: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    required: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 3
  }
}, {
  timestamps: true
});

// Index for faster queries
otpSchema.index({ email: 1, purpose: 1, isUsed: 1, isExpired: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Method to check if OTP is valid
otpSchema.methods.isValid = function() {
  return !this.isUsed && !this.isExpired && this.attempts < this.maxAttempts && new Date() < this.expiresAt;
};

// Method to mark OTP as used
otpSchema.methods.markAsUsed = function() {
  this.isUsed = true;
  return this.save();
};

// Method to increment attempts
otpSchema.methods.incrementAttempts = function() {
  this.attempts += 1;
  if (this.attempts >= this.maxAttempts) {
    this.isExpired = true;
  }
  return this.save();
};

// Method to mark OTP as expired
otpSchema.methods.markAsExpired = function() {
  this.isExpired = true;
  return this.save();
};

// Static method to invalidate previous OTPs for a user
otpSchema.statics.invalidatePreviousOTPs = async function(userId, purpose = 'password_reset') {
  return this.updateMany(
    { 
      user: userId, 
      purpose: purpose,
      isUsed: false,
      isExpired: false
    },
    { 
      isExpired: true 
    }
  );
};

module.exports = mongoose.model('OTP', otpSchema); 