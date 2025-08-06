const User = require('../models/User.js');
const OTP = require('../models/OTP.js');

class SessionManager {
  /**
   * Logout user from current session
   * @param {string} userId - User ID
   * @param {string} token - Current token to invalidate
   * @returns {Object} - Logout result
   */
  static async logoutUser(userId, token = null) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      // Invalidate current token
      await user.invalidateToken();

      // Clean up OTPs
      await this.cleanupOTPs(userId);

      // Log the logout
      console.log(`User ${user.email} logged out successfully`);

      return {
        success: true,
        message: 'Logged out successfully',
        user: {
          _id: user._id,
          name: user.name,
          email: user.email
        }
      };

    } catch (error) {
      console.error('SessionManager logoutUser error:', error);
      return {
        success: false,
        message: 'Logout failed',
        error: error.message
      };
    }
  }

  /**
   * Logout user from all devices/sessions
   * @param {string} userId - User ID
   * @returns {Object} - Logout result
   */
  static async logoutAllDevices(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      // Invalidate current token
      await user.invalidateToken();

      // Clean up all OTPs
      await this.cleanupOTPs(userId);

      // Log the logout
      console.log(`User ${user.email} logged out from all devices`);

      return {
        success: true,
        message: 'Logged out from all devices successfully',
        user: {
          _id: user._id,
          name: user.name,
          email: user.email
        }
      };

    } catch (error) {
      console.error('SessionManager logoutAllDevices error:', error);
      return {
        success: false,
        message: 'Logout failed',
        error: error.message
      };
    }
  }

  /**
   * Get user session status
   * @param {string} userId - User ID
   * @param {string} token - Current token
   * @returns {Object} - Session status
   */
  static async getSessionStatus(userId, token) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      const isTokenValid = user.isTokenValid(token);
      const hasActiveToken = !!user.currentToken;
      const tokenAge = user.tokenCreatedAt ? Date.now() - user.tokenCreatedAt.getTime() : null;

      return {
        success: true,
        isActive: isTokenValid && hasActiveToken,
        hasToken: hasActiveToken,
        tokenAge: tokenAge,
        tokenAgeFormatted: tokenAge ? this.formatTokenAge(tokenAge) : null,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email
        }
      };

    } catch (error) {
      console.error('SessionManager getSessionStatus error:', error);
      return {
        success: false,
        message: 'Failed to get session status',
        error: error.message
      };
    }
  }

  /**
   * Clean up OTPs for a user
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  static async cleanupOTPs(userId) {
    try {
      await OTP.invalidatePreviousOTPs(userId, 'password_reset');
      console.log(`OTPs cleaned up for user ${userId}`);
    } catch (error) {
      console.log('OTP cleanup error:', error.message);
      // Don't throw error, just log it
    }
  }

  /**
   * Format token age for display
   * @param {number} ageInMs - Age in milliseconds
   * @returns {string} - Formatted age
   */
  static formatTokenAge(ageInMs) {
    const seconds = Math.floor(ageInMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
      return `${seconds} second${seconds > 1 ? 's' : ''}`;
    }
  }

  /**
   * Force logout user by admin (for security purposes)
   * @param {string} userId - User ID
   * @param {string} adminId - Admin user ID
   * @returns {Object} - Logout result
   */
  static async forceLogout(userId, adminId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      // Invalidate current token
      await user.invalidateToken();

      // Clean up OTPs
      await this.cleanupOTPs(userId);

      // Log the force logout
      console.log(`User ${user.email} force logged out by admin ${adminId}`);

      return {
        success: true,
        message: 'User force logged out successfully',
        user: {
          _id: user._id,
          name: user.name,
          email: user.email
        }
      };

    } catch (error) {
      console.error('SessionManager forceLogout error:', error);
      return {
        success: false,
        message: 'Force logout failed',
        error: error.message
      };
    }
  }
}

module.exports = SessionManager; 