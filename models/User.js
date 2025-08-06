const mongoose = require('mongoose');
const { hash, compare } = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    lowercase: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    default: null, // Made optional
    minlength: 6,
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  currentToken: {
    type: String,
    default: null,
  },
  tokenCreatedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  if (this.password) { // Only hash if password is provided
    this.password = await hash(this.password, 10);
  }
  next();
});

// Compare password
userSchema.methods.matchPassword = function (enteredPassword) {
  if (!this.password) {
    return false; // User has no password set
  }
  return compare(enteredPassword, this.password);
};

// Method to update current token
userSchema.methods.updateToken = function (newToken) {
  this.currentToken = newToken;
  this.tokenCreatedAt = new Date();
  return this.save();
};

// Method to invalidate current token
userSchema.methods.invalidateToken = function () {
  this.currentToken = null;
  this.tokenCreatedAt = null;
  return this.save();
};

// Method to check if token is valid
userSchema.methods.isTokenValid = function (token) {
  return this.currentToken === token;
};

// Method to verify email
userSchema.methods.verifyEmail = function () {
  this.isEmailVerified = true;
  return this.save();
};

module.exports = mongoose.model('User', userSchema);
