const SibApiV3Sdk = require('@getbrevo/brevo');

// Configure Brevo API
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

// Email templates
const emailTemplates = {
  passwordReset: {
    subject: 'Password Reset OTP',
    html: (otp, userName) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center;">
          <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>
          <p style="color: #666; font-size: 16px; margin-bottom: 20px;">
            Hello ${userName || 'User'},
          </p>
          <p style="color: #666; font-size: 16px; margin-bottom: 30px;">
            You have requested to reset your password. Please use the following OTP to complete the process:
          </p>
          <div style="background-color: #007bff; color: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h1 style="font-size: 32px; margin: 0; letter-spacing: 5px;">${otp}</h1>
          </div>
          <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
            This OTP is valid for 10 minutes and can only be used once.
          </p>
          <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
            If you didn't request this password reset, please ignore this email.
          </p>
          <div style="border-top: 1px solid #ddd; padding-top: 20px; margin-top: 30px;">
            <p style="color: #999; font-size: 12px;">
              This is an automated email. Please do not reply to this message.
            </p>
          </div>
        </div>
      </div>
    `
  },
  emailVerification: {
    subject: 'Email Verification OTP',
    html: (otp, userName) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center;">
          <h2 style="color: #333; margin-bottom: 20px;">Email Verification</h2>
          <p style="color: #666; font-size: 16px; margin-bottom: 20px;">
            Hello ${userName || 'User'},
          </p>
          <p style="color: #666; font-size: 16px; margin-bottom: 30px;">
            Thank you for registering! Please verify your email address using the following OTP:
          </p>
          <div style="background-color: #28a745; color: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h1 style="font-size: 32px; margin: 0; letter-spacing: 5px;">${otp}</h1>
          </div>
          <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
            This OTP is valid for 10 minutes and can only be used once.
          </p>
          <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
            After verification, you'll be able to login to your account.
          </p>
          <div style="border-top: 1px solid #ddd; padding-top: 20px; margin-top: 30px;">
            <p style="color: #999; font-size: 12px;">
              This is an automated email. Please do not reply to this message.
            </p>
          </div>
        </div>
      </div>
    `
  }
};

// Send OTP email
const sendOTPEmail = async (email, otp, userName = 'User', purpose = 'password_reset') => {
  try {
    // Check if Brevo API key is configured
    if (!process.env.BREVO_API_KEY) {
      console.warn('BREVO_API_KEY not configured. Email sending disabled.');
      return { success: false, error: 'Email service not configured' };
    }

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    // Choose template based on purpose
    const template = purpose === 'email_verification' ? emailTemplates.emailVerification : emailTemplates.passwordReset;
    
    sendSmtpEmail.subject = template.subject;
    sendSmtpEmail.htmlContent = template.html(otp, userName);
    sendSmtpEmail.sender = {
      name: process.env.EMAIL_SENDER_NAME || 'Your App',
      email: process.env.EMAIL_SENDER_EMAIL || 'noreply@yourapp.com'
    };
    sendSmtpEmail.to = [
      {
        email: email,
        name: userName
      }
    ];

    const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Email sent successfully:', response);
    return { success: true, messageId: response.messageId };

  } catch (error) {
    console.error('Error sending email:', error);

    // Handle specific Brevo errors
    if (error.statusCode === 401) {
      if (error.body && error.body.message && error.body.message.includes('unrecognised IP address')) {
        console.error('Brevo IP Authorization Error:', error.body.message);
        return {
          success: false,
          error: 'IP_NOT_AUTHORIZED',
          message: 'Email service IP not authorized. Please add your IP to Brevo authorized IPs.',
          details: error.body.message
        };
      } else {
        console.error('Brevo Authentication Error:', error.body);
        return {
          success: false,
          error: 'AUTH_ERROR',
          message: 'Email service authentication failed. Please check your API key.',
          details: error.body
        };
      }
    }

    if (error.statusCode === 400) {
      console.error('Brevo Bad Request Error:', error.body);
      return {
        success: false,
        error: 'BAD_REQUEST',
        message: 'Invalid email request. Please check email format and sender configuration.',
        details: error.body
      };
    }

    if (error.statusCode === 429) {
      console.error('Brevo Rate Limit Error:', error.body);
      return {
        success: false,
        error: 'RATE_LIMIT',
        message: 'Email service rate limit exceeded. Please try again later.',
        details: error.body
      };
    }

    // Generic error
    return {
      success: false,
      error: 'SEND_FAILED',
      message: 'Failed to send email. Please try again later.',
      details: error.message
    };
  }
};

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Mock email service for development/testing
const sendMockEmail = async (email, otp, userName = 'User') => {
  console.log('=== MOCK EMAIL SENT ===');
  console.log('To:', email);
  console.log('Name:', userName);
  console.log('OTP:', otp);
  console.log('Subject: Password Reset OTP');
  console.log('=== END MOCK EMAIL ===');
  
  return { success: true, messageId: 'mock-message-id' };
};

module.exports = {
  sendOTPEmail,
  sendMockEmail,
  generateOTP
}; 