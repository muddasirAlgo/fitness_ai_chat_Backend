const jwt = require('jsonwebtoken');
const User = require('../models/User.js');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Find user and check if token is still valid
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return res.status(401).json({ 
          message: 'User not found' 
        });
      }

      // Check if the token matches the stored token in database
      if (!user.isTokenValid(token)) {
        return res.status(401).json({ 
          message: 'Token is invalid or expired. Please login again.' 
        });
      }

      // Check if token is older than 7 days (optional additional check)
      if (user.tokenCreatedAt) {
        const tokenAge = Date.now() - user.tokenCreatedAt.getTime();
        const sevenDays = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        
        if (tokenAge > sevenDays) {
          // Invalidate expired token
          await user.invalidateToken();
          return res.status(401).json({ 
            message: 'Token has expired. Please login again.' 
          });
        }
      }

      req.user = user;
      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          message: 'Invalid token' 
        });
      }
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          message: 'Token has expired. Please login again.' 
        });
      }

      console.error('Auth middleware error:', error);
      res.status(401).json({ 
        message: 'Not authorized' 
      });
    }
  }

  if (!token) {
    res.status(401).json({ 
      message: 'No token, not authorized' 
    });
  }
};

module.exports = protect;
