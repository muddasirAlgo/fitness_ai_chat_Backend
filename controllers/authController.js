const User = require('../models/User.js');
const Profile = require('../models/Profile.js');
const HealthMetrics = require('../models/HealthMetrics.js');
const OTP = require('../models/OTP.js');
const generateToken = require('../utils/generateToken.js');
const { sendOTPEmail, sendMockEmail, generateOTP } = require('../utils/emailService.js');
const SessionManager = require('../utils/sessionManager.js');

// Register user
async function registerUser(req, res) {
  const { name, username, email, password, confirmPassword } = req.body;

  try {
    // Check for empty fields and collect them
    const emptyFields = [];
    if (!name) emptyFields.push('name');
    if (!username) emptyFields.push('username');
    if (!email) emptyFields.push('email');
    if (!password) emptyFields.push('password');
    if (!confirmPassword) emptyFields.push('confirmPassword');

    if (emptyFields.length > 0) {
      return res.status(400).json({
        message: `${emptyFields.join(', ')} field are required`
      });
    }

    // Validate name
    if (name.trim() === '') {
      return res.status(400).json({
        message: 'Name cannot be empty'
      });
    }

    // Validate username
    if (username.trim() === '') {
      return res.status(400).json({
        message: 'Username cannot be empty'
      });
    }

    // Username format validation
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        message: 'Username can only contain letters, numbers, and underscores'
      });
    }

    if (username.length < 3) {
      return res.status(400).json({
        message: 'Username must be at least 3 characters long'
      });
    }

    if (username.length > 30) {
      return res.status(400).json({
        message: 'Username cannot exceed 30 characters'
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: 'Please provide a valid email address'
      });
    }

    // Password validation
    if (password !== confirmPassword) {
      return res.status(400).json({
        message: 'Password and confirm password do not match'
      });
    }

    // Password strength validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message: 'Password must contain at least 8 characters including 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character'
      });
    }

    const userEmail = email.toLowerCase().trim();
    const userUsername = username.toLowerCase().trim();

    // Check if user already exists by email
    const existingUserByEmail = await User.findOne({ email: userEmail });
    
    if (existingUserByEmail) {
      // If user exists and email is verified, throw error
      if (existingUserByEmail.isEmailVerified) {
        return res.status(400).json({
          message: 'User with this email already exists'
        });
      }
      
      // If user exists but email is not verified, check username conflict
      const existingUserByUsername = await User.findOne({ username: userUsername });
      if (existingUserByUsername && existingUserByUsername._id.toString() !== existingUserByEmail._id.toString()) {
        return res.status(400).json({
          message: 'Username is already taken'
        });
      }
      
      // Update existing unverified user with new data
      existingUserByEmail.name = name.trim();
      existingUserByEmail.username = userUsername;
      existingUserByEmail.password = password; // Will be hashed by pre-save hook
      existingUserByEmail.isEmailVerified = false; // Ensure it's still false
      
      await existingUserByEmail.save();
      
      // Update or create profile
      let profile = await Profile.findOne({ user: existingUserByEmail._id });
      if (profile) {
        profile.name = name.trim();
        profile.username = userUsername;
        profile.email = userEmail;
        await profile.save();
      } else {
        await Profile.create({
          user: existingUserByEmail._id,
          name: name.trim(),
          username: userUsername,
          email: userEmail
        });
      }
      
      // Generate new email verification OTP
      const verificationOTP = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Invalidate any existing OTPs for this user
      await OTP.invalidatePreviousOTPs(existingUserByEmail._id, 'email_verification');

      // Save new OTP to database
      await OTP.create({
        user: existingUserByEmail._id,
        email: userEmail,
        otp: verificationOTP,
        purpose: 'email_verification',
        expiresAt: expiresAt
      });

      // Send verification email
      const emailResult = await sendOTPEmail(userEmail, verificationOTP, existingUserByEmail.name, 'email_verification');

      if (emailResult.success) {
        console.log(`Email verification OTP resent for existing unverified user ${userEmail}`);
        
        res.status(200).json({
          message: 'Registration updated! Please check your email for verification OTP.',
          user: {
            _id: existingUserByEmail._id,
            name: existingUserByEmail.name,
            username: existingUserByEmail.username,
            email: existingUserByEmail.email,
            isEmailVerified: false
          },
          emailSent: true,
          expiresIn: '10 minutes',
          updated: true
        });
      } else {
        // If email service fails, still save user but inform them
        console.error('Email service failed for registration update:', emailResult.error);
        
        if (process.env.NODE_ENV === 'development') {
          // In development, show OTP in response
          res.status(200).json({
            message: 'Registration updated! Email verification OTP generated but email service is unavailable.',
            user: {
              _id: existingUserByEmail._id,
              name: existingUserByEmail.name,
              username: existingUserByEmail.username,
              email: existingUserByEmail.email,
              isEmailVerified: false
            },
            otp: verificationOTP, // Only in development
            expiresIn: '10 minutes',
            warning: 'Email service unavailable - OTP shown for development purposes only',
            updated: true
          });
        } else {
          res.status(200).json({
            message: 'Registration updated! Please contact support for email verification.',
            user: {
              _id: existingUserByEmail._id,
              name: existingUserByEmail.name,
              username: existingUserByEmail.username,
              email: existingUserByEmail.email,
              isEmailVerified: false
            },
            emailSent: false,
            updated: true
          });
        }
      }
      
      return; // Exit early since we handled the existing user case
    }

    // Check if username is already taken by a different user
    const existingUserByUsername = await User.findOne({ username: userUsername });
    if (existingUserByUsername) {
      return res.status(400).json({
        message: 'Username is already taken'
      });
    }

    // Create new user (email not verified yet)
    const user = await User.create({
      name: name.trim(),
      username: userUsername,
      email: userEmail,
      password,
      isEmailVerified: false
    });

    // Create profile automatically
    await Profile.create({
      user: user._id,
      name: user.name,
      username: user.username,
      email: user.email
    });

    // Generate email verification OTP
    const verificationOTP = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP to database
    await OTP.create({
      user: user._id,
      email: userEmail,
      otp: verificationOTP,
      purpose: 'email_verification',
      expiresAt: expiresAt
    });

    // Send verification email
    const emailResult = await sendOTPEmail(userEmail, verificationOTP, user.name, 'email_verification');

    if (emailResult.success) {
      console.log(`Email verification OTP sent successfully for new user ${userEmail}`);
      
      res.status(201).json({
        message: 'Registration successful! Please check your email for verification OTP.',
        user: {
          _id: user._id,
          name: user.name,
          username: user.username,
          email: user.email,
          isEmailVerified: false
        },
        emailSent: true,
        expiresIn: '10 minutes'
      });
    } else {
      // If email service fails, still save user but inform them
      console.error('Email service failed for registration:', emailResult.error);
      
      if (process.env.NODE_ENV === 'development') {
        // In development, show OTP in response
        res.status(201).json({
          message: 'Registration successful! Email verification OTP generated but email service is unavailable.',
          user: {
            _id: user._id,
            name: user.name,
            username: user.username,
            email: user.email,
            isEmailVerified: false
          },
          otp: verificationOTP, // Only in development
          expiresIn: '10 minutes',
          warning: 'Email service unavailable - OTP shown for development purposes only'
        });
      } else {
        res.status(201).json({
          message: 'Registration successful! Please contact support for email verification.',
          user: {
            _id: user._id,
            name: user.name,
            username: user.username,
            email: user.email,
            isEmailVerified: false
          },
          emailSent: false
        });
      }
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

    // Handle duplicate key error (email or username already exists)
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const fieldName = field === 'email' ? 'email' : 'username';
      return res.status(400).json({
        message: `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is already taken`
      });
    }

    // Handle database connection errors
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
      return res.status(500).json({
        message: 'Database connection failed. Please try again later.'
      });
    }

    // Handle other errors
    console.error('Registration error:', error);
    res.status(500).json({
      message: 'Internal server error while registering user'
    });
  }
}

// Create profile
async function createProfile(req, res) {
  const { 
    name, 
    phoneNumber, 
    location, 
    address, 
    purposeOfJoining,
    // Health metrics fields
    height,
    weight,
    dob,
    dailyIntakeProteins,
    dailyIntakeCalories,
    fat
  } = req.body;

  try {
    // Check for empty fields and collect them
    const emptyFields = [];
    if (!name) emptyFields.push('name');
    if (!phoneNumber) emptyFields.push('phoneNumber');
    if (!location) emptyFields.push('location');
    if (!address) emptyFields.push('address');
    if (!purposeOfJoining) emptyFields.push('purposeOfJoining');

    if (emptyFields.length > 0) {
      return res.status(400).json({
        message: `${emptyFields.join(', ')} field are required`
      });
    }

    // Validate name
    if (name.trim() === '') {
      return res.status(400).json({
        message: 'Name cannot be empty'
      });
    }

    // Phone number validation
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(phoneNumber.replace(/[\s\-\(\)]/g, ''))) {
      return res.status(400).json({
        message: 'Please provide a valid phone number'
      });
    }

    // Validate other fields
    if (location.trim() === '') {
      return res.status(400).json({
        message: 'Location cannot be empty'
      });
    }

    if (address.trim() === '') {
      return res.status(400).json({
        message: 'Address cannot be empty'
      });
    }

    if (purposeOfJoining.trim() === '') {
      return res.status(400).json({
        message: 'Purpose of joining cannot be empty'
      });
    }

    // Validate health metrics if provided
    let healthMetricsData = null;
    if (height || weight || dob || dailyIntakeProteins || dailyIntakeCalories || fat) {
      // Check if all health metrics fields are provided
      const healthFields = [];
      if (!height) healthFields.push('height');
      if (!weight) healthFields.push('weight');
      if (!dob) healthFields.push('dob');
      if (!dailyIntakeProteins) healthFields.push('dailyIntakeProteins');
      if (!dailyIntakeCalories) healthFields.push('dailyIntakeCalories');
      if (!fat) healthFields.push('fat');

      if (healthFields.length > 0) {
        return res.status(400).json({
          message: `All health metrics fields are required: ${healthFields.join(', ')}`
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

      healthMetricsData = {
        height,
        weight,
        dob: dobDate,
        dailyIntakeProteins,
        dailyIntakeCalories,
        fat
      };
    }

    // Find existing profile or create new one
    let profile = await Profile.findOne({ user: req.user.id });

    if (profile) {
      // Update existing profile
      profile.name = name.trim();
      profile.phoneNumber = phoneNumber.trim();
      profile.location = location.trim();
      profile.address = address.trim();
      profile.purposeOfJoining = purposeOfJoining.trim();
      
      await profile.save();
    } else {
      // Create new profile
      profile = await Profile.create({
        user: req.user.id,
        name: name.trim(),
        username: req.user.username, // Get username from authenticated user
        email: req.user.email, // Get email from authenticated user
        phoneNumber: phoneNumber.trim(),
        location: location.trim(),
        address: address.trim(),
        purposeOfJoining: purposeOfJoining.trim()
      });
    }

    // Handle health metrics
    let healthMetrics = null;
    if (healthMetricsData) {
      const HealthMetrics = require('../models/HealthMetrics.js');
      
      // Check if health metrics already exist for this user
      healthMetrics = await HealthMetrics.findOne({ user: req.user.id });

      if (healthMetrics) {
        // Update existing health metrics
        healthMetrics.height = healthMetricsData.height;
        healthMetrics.weight = healthMetricsData.weight;
        healthMetrics.dob = healthMetricsData.dob;
        healthMetrics.dailyIntakeProteins = healthMetricsData.dailyIntakeProteins;
        healthMetrics.dailyIntakeCalories = healthMetricsData.dailyIntakeCalories;
        healthMetrics.fat = healthMetricsData.fat;
        
        await healthMetrics.save();
      } else {
        // Create new health metrics
        healthMetrics = await HealthMetrics.create({
          user: req.user.id,
          height: healthMetricsData.height,
          weight: healthMetricsData.weight,
          dob: healthMetricsData.dob,
          dailyIntakeProteins: healthMetricsData.dailyIntakeProteins,
          dailyIntakeCalories: healthMetricsData.dailyIntakeCalories,
          fat: healthMetricsData.fat
        });
      }
    }

    // Prepare response
    const response = {
      message: healthMetricsData 
        ? 'Profile and health metrics created successfully'
        : 'Profile created successfully',
      profile: profile
    };

    if (healthMetrics) {
      response.healthMetrics = healthMetrics.getHealthSummary();
    }

    res.status(201).json(response);

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
    console.error('Create profile error:', error);
    res.status(500).json({
      message: 'Internal server error during profile creation'
    });
  }
}

// Login user
async function loginUser(req, res) {
  const { emailOrUsername, email, username, password } = req.body;

  try {
    // Support both old and new field names
    let loginIdentifier = emailOrUsername || email || username;
    
    // Check for empty fields
    if (!loginIdentifier || !password) {
      const emptyFields = [];
      if (!loginIdentifier) emptyFields.push('emailOrUsername (or email/username)');
      if (!password) emptyFields.push('password');

      return res.status(400).json({
        message: `${emptyFields.join(', ')} field are required`
      });
    }

    // Determine if input is email or username
    const isEmail = loginIdentifier.includes('@');
    let user;

    if (isEmail) {
      // Login with email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(loginIdentifier)) {
        return res.status(400).json({
          message: 'Please provide a valid email address'
        });
      }
      user = await User.findOne({ email: loginIdentifier.toLowerCase().trim() });
    } else {
      // Login with username
      if (loginIdentifier.trim() === '') {
        return res.status(400).json({
          message: 'Username cannot be empty'
        });
      }
      user = await User.findOne({ username: loginIdentifier.toLowerCase().trim() });
    }

    if (!user) {
      return res.status(401).json({
        message: 'Invalid credentials'
      });
    }

    // Check if user has a password set
    if (!user.password) {
      return res.status(401).json({
        message: 'Account not set up for password login. Please use alternative login method.'
      });
    }

    // Check password first
    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Invalid credentials'
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      // If user tried to login with username instead of email
      if (!isEmail) {
        return res.status(602).json({
          message: 'Your email is not verified. You have to enter your email instead of username to verify your account.',
          emailVerificationRequired: true,
          email: user.email,
          loginMethod: 'username',
          suggestion: 'Please use your email address for login to receive verification OTP.'
        });
      }

      // User tried to login with email (correct method)
      // Invalidate any existing unused OTPs for this user
      await OTP.invalidatePreviousOTPs(user._id, 'email_verification');

      // Generate new email verification OTP
      const verificationOTP = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Save new OTP to database
      await OTP.create({
        user: user._id,
        email: user.email,
        otp: verificationOTP,
        purpose: 'email_verification',
        expiresAt: expiresAt
      });

      // Send verification email
      const emailResult = await sendOTPEmail(user.email, verificationOTP, user.name, 'email_verification');

      if (emailResult.success) {
        console.log(`Email verification OTP sent for login attempt by unverified user ${user.email}`);
        
        return res.status(601).json({
          message: 'Please verify your email address before logging in. A new verification OTP has been sent to your email.',
          emailVerificationRequired: true,
          email: user.email,
          otpSent: true,
          expiresIn: '10 minutes'
        });
      } else {
        // If email service fails, still inform user
        console.error('Email service failed for login verification:', emailResult.error);
        
        if (process.env.NODE_ENV === 'development') {
          // In development, show OTP in response
          return res.status(601).json({
            message: 'Please verify your email address before logging in. Email verification OTP generated but email service is unavailable.',
            emailVerificationRequired: true,
            email: user.email,
            otp: verificationOTP, // Only in development
            expiresIn: '10 minutes',
            warning: 'Email service unavailable - OTP shown for development purposes only'
          });
        } else {
          return res.status(601).json({
            message: 'Please verify your email address before logging in. Please contact support for email verification.',
            emailVerificationRequired: true,
            email: user.email,
            otpSent: false
          });
        }
      }
    }

    // Email is verified, proceed with login
    // Generate new token
    const token = generateToken(user._id);

    // Update user's current token (invalidate old one)
    await user.updateToken(token);

    // Get user profile
    const profile = await Profile.findOne({ user: user._id });

    res.json({
      message: 'Login successful',
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        isEmailVerified: user.isEmailVerified
      },
      profile: profile,
      token
    });

  } catch (error) {
    console.error('Login error:', error);

    // Handle database connection errors
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
      return res.status(500).json({
        message: 'Database connection failed. Please try again later.'
      });
    }

    res.status(500).json({
      message: 'Internal server error while logging in'
    });
  }
}

async function forgotPassword(req, res) {
  const { email } = req.body;

  try {
    // Check if email is provided
    if (!email || email.trim() === '') {
      return res.status(400).json({
        message: 'Email is required'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: 'Please provide a valid email address'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({
        message: 'User not found with this email address'
      });
    }

    // Check if user has a password set
    if (!user.password) {
      return res.status(400).json({
        message: 'This account was created without a password. Please contact support.'
      });
    }

    // Invalidate any existing OTPs for this user
    await OTP.invalidatePreviousOTPs(user._id, 'password_reset');

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Save OTP to database
    const otpDocument = await OTP.create({
      user: user._id,
      email: user.email,
      otp: otp,
      purpose: 'password_reset',
      expiresAt: expiresAt
    });

    // Send OTP via email
    const emailResult = await sendOTPEmail(user.email, otp, user.name);

    if (!emailResult.success) {
      // If email fails, delete the OTP and return appropriate error
      await OTP.findByIdAndDelete(otpDocument._id);

      // Handle specific email service errors
      if (emailResult.error === 'IP_NOT_AUTHORIZED') {
        return res.status(500).json({
          message: 'Email service temporarily unavailable. Please contact support.',
          error: 'EMAIL_SERVICE_ERROR',
          details: 'IP authorization required for email service'
        });
      }

      if (emailResult.error === 'AUTH_ERROR') {
        return res.status(500).json({
          message: 'Email service configuration error. Please contact support.',
          error: 'EMAIL_SERVICE_ERROR',
          details: 'Email service authentication failed'
        });
      }

      if (emailResult.error === 'RATE_LIMIT') {
        return res.status(429).json({
          message: 'Too many password reset requests. Please try again later.',
          error: 'RATE_LIMIT',
          retryAfter: '15 minutes'
        });
      }

      // For development/testing, you can use mock email
      if (process.env.NODE_ENV === 'development') {
        console.log('Development mode: Using mock email service');
        await sendMockEmail(user.email, otp, user.name);

        res.json({
          message: 'Password reset OTP has been sent to your email address (MOCK MODE)',
          email: user.email,
          expiresIn: '10 minutes',
          otp: otp, // Only in development mode
          note: 'This is a development environment. OTP is shown in console and response.'
        });
        return;
      }

      return res.status(500).json({
        message: 'Failed to send OTP email. Please try again later.',
        error: 'EMAIL_SEND_FAILED'
      });
    }

    res.json({
      message: 'Password reset OTP has been sent to your email address',
      email: user.email,
      expiresIn: '10 minutes'
    });

  } catch (error) {
    // Handle database connection errors
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
      return res.status(500).json({
        message: 'Database connection failed. Please try again later.'
      });
    }

    // Handle other errors
    console.error('Forgot password error:', error);
    res.status(500).json({
      message: 'Internal server error during password reset request'
    });
  }
}

async function verifyOTP(req, res) {
  const { email, otp } = req.body;

  try {
    // Convert OTP to string to handle both string and number inputs
    const otpString = otp ? otp.toString() : '';

    // Check if email and OTP are provided
    if (!email || email.trim() === '') {
      return res.status(400).json({
        message: 'Email is required'
      });
    }

    if (!otpString || otpString.trim() === '') {
      return res.status(400).json({
        message: 'OTP is required'
      });
    }

    // Validate OTP format (6 digits)
    const otpRegex = /^\d{6}$/;
    if (!otpRegex.test(otpString.trim())) {
      return res.status(400).json({
        message: 'OTP must be a 6-digit number'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: 'Please provide a valid email address'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({
        message: 'User not found with this email address'
      });
    }

    // Find valid OTP for this user
    const otpDocument = await OTP.findOne({
      user: user._id,
      email: user.email,
      otp: otpString,
      purpose: 'password_reset',
      isUsed: false,
      isExpired: false
    });

    if (!otpDocument) {
      return res.status(400).json({
        message: 'Invalid or expired OTP'
      });
    }

    // Check if OTP is valid
    if (!otpDocument.isValid()) {
      await otpDocument.incrementAttempts();
      return res.status(400).json({
        message: 'Invalid or expired OTP'
      });
    }

    // Mark OTP as used
    await otpDocument.markAsUsed();

    // Generate temporary token for password reset
    const resetToken = generateToken(user._id);

    res.json({
      message: 'OTP verified successfully',
      resetToken: resetToken,
      email: user.email
    });

  } catch (error) {
    // Handle database connection errors
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
      return res.status(500).json({
        message: 'Database connection failed. Please try again later.'
      });
    }

    // Handle other errors
    console.error('OTP verification error:', error);
    res.status(500).json({
      message: 'Internal server error during OTP verification'
    });
  }
}

async function resetPassword(req, res) {
  const { email, resetToken, newPassword, confirmPassword } = req.body;

  try {
    // Check for empty fields
    const emptyFields = [];
    if (!email || email.trim() === '') emptyFields.push('email');
    if (!resetToken || resetToken.trim() === '') emptyFields.push('resetToken');
    if (!newPassword || newPassword.trim() === '') emptyFields.push('newPassword');
    if (!confirmPassword || confirmPassword.trim() === '') emptyFields.push('confirmPassword');

    if (emptyFields.length > 0) {
      return res.status(400).json({
        message: `${emptyFields.join(', ')} field are required`
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: 'Please provide a valid email address'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({
        message: 'User not found with this email address'
      });
    }

    // Verify reset token
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);

      if (decoded.id !== user._id.toString()) {
        return res.status(400).json({
          message: 'Invalid reset token'
        });
      }
    } catch (tokenError) {
      return res.status(400).json({
        message: 'Invalid or expired reset token'
      });
    }

    // New password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message: 'New password must contain at least 8 characters including: 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character (@$!%*?&)'
      });
    }

    // Check if new password and confirm password match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: 'New password and confirm password do not match'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Generate new token and invalidate old one
    const newToken = generateToken(user._id);
    await user.updateToken(newToken);

    // Invalidate all OTPs for this user
    await OTP.invalidatePreviousOTPs(user._id, 'password_reset');

    res.json({
      message: 'Password reset successfully',
      token: newToken
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
    console.error('Reset password error:', error);
    res.status(500).json({
      message: 'Internal server error during password reset'
    });
  }
}

async function changePassword(req, res) {
  const { oldPassword, newPassword, confirmPassword } = req.body;

  try {
    // Check for empty fields and collect them
    const emptyFields = [];
    if (!oldPassword || oldPassword.trim() === '') emptyFields.push('oldPassword');
    if (!newPassword || newPassword.trim() === '') emptyFields.push('newPassword');
    if (!confirmPassword || confirmPassword.trim() === '') emptyFields.push('confirmPassword');

    if (emptyFields.length > 0) {
      return res.status(400).json({
        message: `${emptyFields.join(', ')} field are required`
      });
    }

    // Find user by ID (from token)
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    // Check if user has a password set
    if (!user.password) {
      return res.status(400).json({
        message: 'This account was created without a password. Please contact support.'
      });
    }

    // Verify old password
    const isOldPasswordValid = await user.matchPassword(oldPassword);
    if (!isOldPasswordValid) {
      return res.status(400).json({
        message: 'Old password is incorrect'
      });
    }

    // New password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message: 'New password must contain at least 8 characters including: 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character (@$!%*?&)'
      });
    }

    // Check if new password and confirm password match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: 'New password and confirm password do not match'
      });
    }

    // Check if new password is same as old password
    if (oldPassword === newPassword) {
      return res.status(400).json({
        message: 'New password must be different from the old password'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Generate new token and invalidate old one
    const newToken = generateToken(user._id);
    await user.updateToken(newToken);

    res.json({
      message: 'Password changed successfully',
      token: newToken
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
    console.error('Change password error:', error);
    res.status(500).json({
      message: 'Internal server error during password change'
    });
  }
}

async function getUserProfile(req, res) {
  try {
    const user = await User.findById(req.user.id).select('-password -tokenCreatedAt -createdAt -updatedAt');

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    // Get user profile
    const profile = await Profile.findOne({ user: req.user.id }).select('-createdAt -updatedAt -_id -__v -user');

    // Get user health metrics
    const healthMetrics = await HealthMetrics.findOne({ user: req.user.id }).select('-createdAt -updatedAt -lastUpdated -_id -__v -user');

    res.json({
      user: user.id,
      profile: profile,
      healthMetrics: healthMetrics
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      message: 'Internal server error while fetching profile'
    });
  }
}

// Update user profile
async function updateUserProfile(req, res) {
  const { 
    name, username, email, phoneNumber, location, address, purposeOfJoining,
    height, weight, dailyIntakeProteins, dailyIntakeCalories, fat, dob
  } = req.body;

  try {
    // Check if at least one field is provided
    if (!name && !username && !email && !phoneNumber && !location && !address && !purposeOfJoining &&
        !height && !weight && !dailyIntakeProteins && !dailyIntakeCalories && !fat && !dob) {
      return res.status(400).json({
        message: 'At least one field is required for update'
      });
    }

    const profileUpdateData = {};
    const healthMetricsUpdateData = {};

    // Validate and prepare profile update data
    if (name !== undefined && name !== null) {
      if (!name || name.trim() === '') {
        return res.status(400).json({
          message: 'Name cannot be empty'
        });
      }
      profileUpdateData.name = name.trim();
    }

    if (username !== undefined && username !== null) {
      if (!username || username.trim() === '') {
        return res.status(400).json({
          message: 'Username cannot be empty'
        });
      }

      // Username format validation
      const usernameRegex = /^[a-zA-Z0-9_]+$/;
      if (!usernameRegex.test(username)) {
        return res.status(400).json({
          message: 'Username can only contain letters, numbers, and underscores'
        });
      }

      if (username.length < 3) {
        return res.status(400).json({
          message: 'Username must be at least 3 characters long'
        });
      }

      if (username.length > 30) {
        return res.status(400).json({
          message: 'Username cannot exceed 30 characters'
        });
      }

      const newUsername = username.toLowerCase().trim();

      // Check if username is already taken by another user
      const existingUser = await User.findOne({
        username: newUsername,
        _id: { $ne: req.user.id } // Exclude current user
      });

      if (existingUser) {
        return res.status(400).json({
          message: 'Username is already taken by another user'
        });
      }

      // Check if username is already taken by another profile
      const existingProfile = await Profile.findOne({
        username: newUsername,
        user: { $ne: req.user.id } // Exclude current user
      });

      if (existingProfile) {
        return res.status(400).json({
          message: 'Username is already taken by another user'
        });
      }

      profileUpdateData.username = newUsername;
    }

    if (email !== undefined && email !== null) {
      if (!email || email.trim() === '') {
        return res.status(400).json({
          message: 'Email cannot be empty'
        });
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          message: 'Please provide a valid email address'
        });
      }

      const newEmail = email.toLowerCase().trim();

      // Check if email is already taken by another user (in User table)
      const existingUser = await User.findOne({
        email: newEmail,
        _id: { $ne: req.user.id } // Exclude current user
      });

      if (existingUser) {
        return res.status(400).json({
          message: 'Email is already taken by another user'
        });
      }

      // Check if email is already taken by another profile
      const existingProfile = await Profile.findOne({
        email: newEmail,
        user: { $ne: req.user.id } // Exclude current user
      });

      if (existingProfile) {
        return res.status(400).json({
          message: 'Email is already taken by another user'
        });
      }

      profileUpdateData.email = newEmail;
    }

    if (phoneNumber !== undefined && phoneNumber !== null) {
      if (!phoneNumber || phoneNumber.trim() === '') {
        return res.status(400).json({
          message: 'Phone number cannot be empty'
        });
      }

      // Phone number validation
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      if (!phoneRegex.test(phoneNumber.replace(/[\s\-\(\)]/g, ''))) {
        return res.status(400).json({
          message: 'Please provide a valid phone number'
        });
      }
      profileUpdateData.phoneNumber = phoneNumber.trim();
    }

    if (location !== undefined && location !== null) {
      if (!location || location.trim() === '') {
        return res.status(400).json({
          message: 'Location cannot be empty'
        });
      }
      profileUpdateData.location = location.trim();
    }

    if (address !== undefined && address !== null) {
      if (!address || address.trim() === '') {
        return res.status(400).json({
          message: 'Address cannot be empty'
        });
      }
      profileUpdateData.address = address.trim();
    }

    if (purposeOfJoining !== undefined && purposeOfJoining !== null) {
      if (!purposeOfJoining || purposeOfJoining.trim() === '') {
        return res.status(400).json({
          message: 'Purpose of joining cannot be empty'
        });
      }
      profileUpdateData.purposeOfJoining = purposeOfJoining.trim();
    }

    // Validate and prepare health metrics update data
    if (height !== undefined && height !== null) {
      if (isNaN(height) || height <= 0) {
        return res.status(400).json({
          message: 'Height must be a positive number'
        });
      }
      healthMetricsUpdateData.height = Number(height);
    }

    if (weight !== undefined && weight !== null) {
      if (isNaN(weight) || weight <= 0) {
        return res.status(400).json({
          message: 'Weight must be a positive number'
        });
      }
      healthMetricsUpdateData.weight = Number(weight);
    }

    if (dailyIntakeProteins !== undefined && dailyIntakeProteins !== null) {
      if (isNaN(dailyIntakeProteins) || dailyIntakeProteins < 0) {
        return res.status(400).json({
          message: 'Daily protein intake must be a non-negative number'
        });
      }
      healthMetricsUpdateData.dailyIntakeProteins = Number(dailyIntakeProteins);
    }

    if (dailyIntakeCalories !== undefined && dailyIntakeCalories !== null) {
      if (isNaN(dailyIntakeCalories) || dailyIntakeCalories < 0) {
        return res.status(400).json({
          message: 'Daily calorie intake must be a non-negative number'
        });
      }
      healthMetricsUpdateData.dailyIntakeCalories = Number(dailyIntakeCalories);
    }

    if (fat !== undefined && fat !== null) {
      if (isNaN(fat) || fat < 0) {
        return res.status(400).json({
          message: 'Fat intake must be a non-negative number'
        });
      }
      healthMetricsUpdateData.fat = Number(fat);
    }

    if (dob !== undefined && dob !== null) {
      if (!dob || dob.trim() === '') {
        return res.status(400).json({
          message: 'Date of birth cannot be empty'
        });
      }
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dob)) {
        return res.status(400).json({
          message: 'Date of birth must be in YYYY-MM-DD format'
        });
      }
      healthMetricsUpdateData.dob = dob.trim();
    }

    // Update profile only
    const updatedProfile = await Profile.findOneAndUpdate(
      { user: req.user.id },
      profileUpdateData,
      {
        new: true, // Return updated document
        runValidators: true // Run mongoose validators
      }
    );

    if (!updatedProfile) {
      return res.status(404).json({
        message: 'Profile not found'
      });
    }

    // If email or username is being updated, also update it in the User table
    const userUpdateData = {};
    if (profileUpdateData.email) {
      userUpdateData.email = profileUpdateData.email;
    }
    if (profileUpdateData.username) {
      userUpdateData.username = profileUpdateData.username;
    }

    if (Object.keys(userUpdateData).length > 0) {
      try {
        await User.findByIdAndUpdate(
          req.user.id,
          userUpdateData,
          { runValidators: true }
        );
        console.log(`User table updated for user ${req.user.id}:`, userUpdateData);
      } catch (userUpdateError) {
        console.error('Error updating User table:', userUpdateError);
        // Don't fail the entire request if User update fails, but log it
      }
    }

    // Update health metrics if provided
    let updatedHealthMetrics = null;
    if (Object.keys(healthMetricsUpdateData).length > 0) {
      // Calculate BMI if both height and weight are provided
      if (healthMetricsUpdateData.height && healthMetricsUpdateData.weight) {
        const heightInMeters = healthMetricsUpdateData.height / 100;
        healthMetricsUpdateData.bmi = Number((healthMetricsUpdateData.weight / (heightInMeters * heightInMeters)).toFixed(1));
      }

      // Calculate age from DOB if provided
      if (healthMetricsUpdateData.dob) {
        const birthDate = new Date(healthMetricsUpdateData.dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        healthMetricsUpdateData.age = age;
      }

      updatedHealthMetrics = await HealthMetrics.findOneAndUpdate(
        { user: req.user.id },
        healthMetricsUpdateData,
        {
          new: true, // Return updated document
          runValidators: true, // Run mongoose validators
          upsert: true // Create if doesn't exist
        }
      );
    }

    // Get the list of updated fields for the response
    const updatedFields = Object.keys(profileUpdateData);
    const updatedHealthFields = Object.keys(healthMetricsUpdateData);
    const allUpdatedFields = [...updatedFields, ...updatedHealthFields];
    
    const updateMessage = allUpdatedFields.length === 1
      ? `${allUpdatedFields[0]} updated successfully`
      : `${allUpdatedFields.join(', ')} updated successfully`;

    res.json({
      message: updateMessage,
      updatedFields: allUpdatedFields,
      profile: updatedProfile,
      healthMetrics: updatedHealthMetrics
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

    // Handle duplicate key error (email or username already exists)
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const fieldName = field === 'email' ? 'email' : 'username';
      return res.status(400).json({
        message: `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is already taken by another user`
      });
    }

    // Handle database connection errors
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
      return res.status(500).json({
        message: 'Database connection failed. Please try again later.'
      });
    }

    // Handle other errors
    console.error('Update profile error:', error);
    res.status(500).json({
      message: 'Internal server error while updating profile'
    });
  }
}

async function logoutUser(req, res) {
  try {
    // Get user from the request (set by protect middleware)
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    // Invalidate the current token
    await user.invalidateToken();

    // Invalidate all OTPs for this user (optional - for security)
    try {
      await OTP.invalidatePreviousOTPs(user._id, 'password_reset');
    } catch (otpError) {
      console.log('OTP cleanup during logout:', otpError.message);
      // Don't fail logout if OTP cleanup fails
    }

    // Log the logout event
    console.log(`User ${user.email} logged out successfully`);

    res.json({
      message: 'Logged out successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    // Handle database connection errors
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
      return res.status(500).json({
        message: 'Database connection failed. Please try again later.'
      });
    }

    // Handle other errors
    console.error('Logout error:', error);
    res.status(500).json({
      message: 'Internal server error during logout'
    });
  }
}

// async function logoutAllDevices(req, res) {
//   try {
//     // Get user from the request (set by protect middleware)
//     const user = await User.findById(req.user.id);

//     if (!user) {
//       return res.status(404).json({
//         message: 'User not found'
//       });
//     }

//     // Invalidate the current token
//     await user.invalidateToken();

//     // Invalidate all OTPs for this user
//     try {
//       await OTP.invalidatePreviousOTPs(user._id, 'password_reset');
//     } catch (otpError) {
//       console.log('OTP cleanup during logout all devices:', otpError.message);
//     }

//     // Log the logout event
//     console.log(`User ${user.email} logged out from all devices`);

//     res.json({
//       message: 'Logged out from all devices successfully',
//       user: {
//         _id: user._id,
//         name: user.name,
//         email: user.email
//       }
//     });

//   } catch (error) {
//     // Handle database connection errors
//     if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
//       return res.status(500).json({
//         message: 'Database connection failed. Please try again later.'
//       });
//     }

//     // Handle other errors
//     console.error('Logout all devices error:', error);
//     res.status(500).json({
//       message: 'Internal server error during logout'
//     });
//   }
// }

async function getSessionStatus(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        message: 'No token provided'
      });
    }

    const sessionStatus = await SessionManager.getSessionStatus(req.user.id, token);

    if (!sessionStatus.success) {
      return res.status(404).json({
        message: sessionStatus.message
      });
    }

    res.json({
      message: 'Session status retrieved successfully',
      ...sessionStatus
    });

  } catch (error) {
    console.error('Get session status error:', error);
    res.status(500).json({
      message: 'Internal server error while getting session status'
    });
  }
}

// Resend OTP for password reset
async function resendOTP(req, res) {
  const { email } = req.body;

  try {
    // Check if email is provided
    if (!email || email.trim() === '') {
      return res.status(400).json({
        message: 'Email is required'
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: 'Please provide a valid email address'
      });
    }

    const userEmail = email.toLowerCase().trim();

    // Check if user exists
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({
        message: 'No user found with this email address'
      });
    }

    // Check if there's a recent OTP request (within last 2 minutes)
    const recentOTP = await OTP.findOne({
      user: user._id,
      purpose: 'password_reset',
      isUsed: false,
      isExpired: false,
      createdAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) } // Last 2 minutes
    });

    if (recentOTP) {
      const timeRemaining = Math.ceil((recentOTP.createdAt.getTime() + 2 * 60 * 1000 - Date.now()) / 1000);
      return res.status(429).json({
        message: `Please wait ${timeRemaining} seconds before requesting another OTP`,
        timeRemaining: timeRemaining
      });
    }

    // Invalidate any existing unused OTPs for this user
    await OTP.invalidatePreviousOTPs(user._id, 'password_reset');

    // Generate new OTP
    const newOTP = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Save new OTP to database
    const otpRecord = await OTP.create({
      user: user._id,
      email: userEmail,
      otp: newOTP,
      purpose: 'password_reset',
      expiresAt: expiresAt
    });

    // Send OTP via email
    const emailResult = await sendOTPEmail(userEmail, newOTP, user.name);

    if (emailResult.success) {
      console.log(`OTP resent successfully for user ${userEmail}`);

      res.json({
        message: 'OTP has been resent to your email address',
        expiresIn: '10 minutes',
        email: userEmail
      });
    } else {
      // If email service fails, still save OTP but inform user
      console.error('Email service failed for OTP resend:', emailResult.error);

      if (process.env.NODE_ENV === 'development') {
        // In development, show OTP in response
        res.json({
          message: 'OTP has been generated but email service is unavailable. Check console for OTP.',
          otp: newOTP, // Only in development
          expiresIn: '10 minutes',
          email: userEmail,
          warning: 'Email service unavailable - OTP shown for development purposes only'
        });
      } else {
        res.status(500).json({
          message: 'OTP generated but email delivery failed. Please try again later.',
          email: userEmail
        });
      }
    }

  } catch (error) {
    console.error('Resend OTP error:', error);

    // Handle database connection errors
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
      return res.status(500).json({
        message: 'Database connection failed. Please try again later.'
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      message: 'Internal server error while resending OTP'
    });
  }
}

// Verify email OTP
async function verifyEmailOTP(req, res) {
  const { email, otp } = req.body;

  try {
    // Check for empty fields
    if (!email || !otp) {
      const emptyFields = [];
      if (!email) emptyFields.push('email');
      if (!otp) emptyFields.push('otp');

      return res.status(400).json({
        message: `${emptyFields.join(', ')} field are required`
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: 'Please provide a valid email address'
      });
    }

    // OTP format validation
    const otpRegex = /^\d{6}$/;
    if (!otpRegex.test(otp.toString())) {
      return res.status(400).json({
        message: 'OTP must be a 6-digit number'
      });
    }

    const userEmail = email.toLowerCase().trim();
    const otpString = otp.toString().trim();

    // Find user
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    // Check if email is already verified
    if (user.isEmailVerified) {
      return res.status(400).json({
        message: 'Email is already verified'
      });
    }

    // Find valid OTP
    const otpRecord = await OTP.findOne({
      user: user._id,
      email: userEmail,
      otp: otpString,
      purpose: 'email_verification',
      isUsed: false,
      isExpired: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      // Check if OTP exists but is invalid
      const invalidOTP = await OTP.findOne({
        user: user._id,
        email: userEmail,
        purpose: 'email_verification'
      });

      if (invalidOTP) {
        // Increment attempts
        await invalidOTP.incrementAttempts();
        
        if (invalidOTP.attempts >= invalidOTP.maxAttempts) {
          return res.status(400).json({
            message: 'OTP has expired due to too many failed attempts. Please request a new OTP.'
          });
        }
      }

      return res.status(400).json({
        message: 'Invalid or expired OTP'
      });
    }

    // Mark OTP as used
    await otpRecord.markAsUsed();

    // Verify user's email
    await user.verifyEmail();

    // Generate login token
    const token = generateToken(user._id);
    await user.updateToken(token);

    // Get user profile
    const profile = await Profile.findOne({ user: user._id });

    console.log(`Email verified successfully for user ${userEmail}`);

    res.json({
      message: 'Email verified successfully! You can now login to your account.',
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        isEmailVerified: true
      },
      profile: profile,
      token
    });

  } catch (error) {
    console.error('Email verification error:', error);

    // Handle database connection errors
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
      return res.status(500).json({
        message: 'Database connection failed. Please try again later.'
      });
    }

    res.status(500).json({
      message: 'Internal server error while verifying email'
    });
  }
}

// Resend email verification OTP
async function resendEmailVerification(req, res) {
  const { email } = req.body;

  try {
    // Check if email is provided
    if (!email || email.trim() === '') {
      return res.status(400).json({
        message: 'Email is required'
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: 'Please provide a valid email address'
      });
    }

    const userEmail = email.toLowerCase().trim();

    // Check if user exists
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({
        message: 'No user found with this email address'
      });
    }

    // Check if email is already verified
    if (user.isEmailVerified) {
      return res.status(400).json({
        message: 'Email is already verified'
      });
    }

    // Check if there's a recent OTP request (within last 2 minutes)
    const recentOTP = await OTP.findOne({
      user: user._id,
      purpose: 'email_verification',
      isUsed: false,
      isExpired: false,
      createdAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) } // Last 2 minutes
    });

    if (recentOTP) {
      const timeRemaining = Math.ceil((recentOTP.createdAt.getTime() + 2 * 60 * 1000 - Date.now()) / 1000);
      return res.status(429).json({
        message: `Please wait ${timeRemaining} seconds before requesting another verification OTP`,
        timeRemaining: timeRemaining
      });
    }

    // Invalidate any existing unused OTPs for this user
    await OTP.invalidatePreviousOTPs(user._id, 'email_verification');

    // Generate new OTP
    const newOTP = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Save new OTP to database
    const otpRecord = await OTP.create({
      user: user._id,
      email: userEmail,
      otp: newOTP,
      purpose: 'email_verification',
      expiresAt: expiresAt
    });

    // Send OTP via email
    const emailResult = await sendOTPEmail(userEmail, newOTP, user.name, 'email_verification');

    if (emailResult.success) {
      console.log(`Email verification OTP resent successfully for user ${userEmail}`);
      
      res.json({
        message: 'Email verification OTP has been resent to your email address',
        expiresIn: '10 minutes',
        email: userEmail
      });
    } else {
      // If email service fails, still save OTP but inform user
      console.error('Email service failed for email verification resend:', emailResult.error);
      
      if (process.env.NODE_ENV === 'development') {
        // In development, show OTP in response
        res.json({
          message: 'Email verification OTP has been generated but email service is unavailable.',
          otp: newOTP, // Only in development
          expiresIn: '10 minutes',
          email: userEmail,
          warning: 'Email service unavailable - OTP shown for development purposes only'
        });
      } else {
        res.status(500).json({
          message: 'OTP generated but email delivery failed. Please try again later.',
          email: userEmail
        });
      }
    }

  } catch (error) {
    console.error('Resend email verification error:', error);

    // Handle database connection errors
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
      return res.status(500).json({
        message: 'Database connection failed. Please try again later.'
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      message: 'Internal server error while resending email verification OTP'
    });
  }
}

module.exports = {
  registerUser,
  createProfile,
  loginUser,
  logoutUser,
  // logoutAllDevices,
  getSessionStatus,
  forgotPassword,
  verifyOTP,
  resetPassword,
  resendOTP,
  verifyEmailOTP,
  resendEmailVerification,
  changePassword,
  getUserProfile,
  updateUserProfile
};
