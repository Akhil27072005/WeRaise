import nodemailer from 'nodemailer';

// =====================================================
// Email Service Configuration
// =====================================================

interface EmailConfig {
  hostService: string;
  user: string;
  pass: string;
  fromName: string;
  fromAddress: string;
}

// Get email configuration from environment variables
const getEmailConfig = (): EmailConfig => {
  return {
    hostService: process.env.EMAIL_HOST_SERVICE || 'gmail',
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
    fromName: process.env.EMAIL_FROM_NAME || 'WeRaise Platform',
    fromAddress: process.env.EMAIL_FROM_ADDRESS || 'noreply@werase.com'
  };
};

// Create Nodemailer transporter
const createTransporter = () => {
  const config = getEmailConfig();
  
  // Configure transporter based on service
  let transporterConfig: any = {
    auth: {
      user: config.user,
      pass: config.pass
    }
  };

  // Service-specific configurations
  switch (config.hostService.toLowerCase()) {
    case 'gmail':
      transporterConfig.service = 'gmail';
      break;
    case 'sendgrid':
      transporterConfig.host = 'smtp.sendgrid.net';
      transporterConfig.port = 587;
      transporterConfig.secure = false;
      break;
    case 'outlook':
      transporterConfig.host = 'smtp-mail.outlook.com';
      transporterConfig.port = 587;
      transporterConfig.secure = false;
      break;
    default:
      // Generic SMTP configuration
      transporterConfig.host = process.env.SMTP_HOST || 'smtp.gmail.com';
      transporterConfig.port = parseInt(process.env.SMTP_PORT || '587');
      transporterConfig.secure = process.env.SMTP_SECURE === 'true';
  }

  return nodemailer.createTransport(transporterConfig);
};

// =====================================================
// Email Templates
// =====================================================

const getBaseTemplate = (title: string, content: string): string => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8f9fa;
        }
        .container {
          background-color: white;
          border-radius: 8px;
          padding: 30px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e9ecef;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #2563eb;
          margin-bottom: 10px;
        }
        .title {
          font-size: 20px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 20px;
        }
        .content {
          margin-bottom: 30px;
        }
        .button {
          display: inline-block;
          background-color: #2563eb;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 500;
          margin: 20px 0;
        }
        .button:hover {
          background-color: #1d4ed8;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e9ecef;
          font-size: 14px;
          color: #6b7280;
          text-align: center;
        }
        .highlight {
          background-color: #f3f4f6;
          padding: 15px;
          border-radius: 6px;
          margin: 15px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">WeRaise</div>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>This email was sent by WeRaise Platform. If you didn't request this email, please ignore it.</p>
          <p>© 2024 WeRaise. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Password Reset Template
const getPasswordResetTemplate = (resetLink: string): string => {
  const content = `
    <h1 class="title">Reset Your Password</h1>
    <p>We received a request to reset your password for your WeRaise account.</p>
    <p>Click the button below to reset your password:</p>
    <div style="text-align: center;">
      <a href="${resetLink}" class="button">Reset Password</a>
    </div>
    <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
    <div class="highlight">
      <a href="${resetLink}">${resetLink}</a>
    </div>
    <p><strong>Important:</strong> This link will expire in 1 hour for security reasons.</p>
    <p>If you didn't request a password reset, please ignore this email.</p>
  `;
  return getBaseTemplate('Password Reset - WeRaise', content);
};

// Email Verification Template
const getEmailVerificationTemplate = (verificationLink: string): string => {
  const content = `
    <h1 class="title">Verify Your Email Address</h1>
    <p>Welcome to WeRaise! To complete your account setup, please verify your email address.</p>
    <p>Click the button below to verify your email:</p>
    <div style="text-align: center;">
      <a href="${verificationLink}" class="button">Verify Email</a>
    </div>
    <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
    <div class="highlight">
      <a href="${verificationLink}">${verificationLink}</a>
    </div>
    <p>Once verified, you'll be able to create campaigns, make pledges, and access all WeRaise features.</p>
  `;
  return getBaseTemplate('Email Verification - WeRaise', content);
};

// Pledge Confirmation Template
const getPledgeConfirmationTemplate = (receiptDetails: {
  campaignTitle: string;
  amount: number;
  date: string;
  pledgeId: string;
  backerName: string;
}): string => {
  const content = `
    <h1 class="title">Pledge Confirmed!</h1>
    <p>Hi ${receiptDetails.backerName},</p>
    <p>Thank you for supporting <strong>"${receiptDetails.campaignTitle}"</strong>!</p>
    <div class="highlight">
      <h3>Receipt Details</h3>
      <p><strong>Campaign:</strong> ${receiptDetails.campaignTitle}</p>
      <p><strong>Amount Pledged:</strong> ₹${receiptDetails.amount.toLocaleString()}</p>
      <p><strong>Date:</strong> ${receiptDetails.date}</p>
      <p><strong>Pledge ID:</strong> ${receiptDetails.pledgeId}</p>
    </div>
    <p>Your pledge has been successfully processed. You'll receive updates about the campaign's progress and be notified when rewards are ready to ship.</p>
    <p>Thank you for being part of the WeRaise community!</p>
  `;
  return getBaseTemplate('Pledge Confirmation - WeRaise', content);
};

// Reward Tracking Template
const getRewardTrackingTemplate = (trackingDetails: {
  campaignTitle: string;
  trackingNumber: string;
  carrierName: string;
  trackingUrl: string;
  backerName: string;
}): string => {
  const content = `
    <h1 class="title">Your Reward is on the Way!</h1>
    <p>Hi ${trackingDetails.backerName},</p>
    <p>Great news! Your reward from <strong>"${trackingDetails.campaignTitle}"</strong> has been shipped.</p>
    <div class="highlight">
      <h3>Tracking Information</h3>
      <p><strong>Campaign:</strong> ${trackingDetails.campaignTitle}</p>
      <p><strong>Tracking Number:</strong> ${trackingDetails.trackingNumber}</p>
      <p><strong>Carrier:</strong> ${trackingDetails.carrierName}</p>
    </div>
    <div style="text-align: center;">
      <a href="${trackingDetails.trackingUrl}" class="button">Track Package</a>
    </div>
    <p>You can track your package using the tracking number above or by clicking the button.</p>
    <p>If you have any questions about your shipment, please contact the campaign creator.</p>
  `;
  return getBaseTemplate('Reward Tracking - WeRaise', content);
};

// =====================================================
// Email Sending Functions
// =====================================================

/**
 * Send password reset email
 */
export const sendPasswordReset = async (recipientEmail: string, resetLink: string): Promise<void> => {
  try {
    const config = getEmailConfig();
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${config.fromName}" <${config.fromAddress}>`,
      to: recipientEmail,
      subject: 'Reset Your Password - WeRaise',
      html: getPasswordResetTemplate(resetLink)
    };

    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to: ${recipientEmail}`);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

/**
 * Send email verification email
 */
export const sendEmailVerification = async (recipientEmail: string, verificationLink: string): Promise<void> => {
  try {
    const config = getEmailConfig();
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${config.fromName}" <${config.fromAddress}>`,
      to: recipientEmail,
      subject: 'Verify Your Email - WeRaise',
      html: getEmailVerificationTemplate(verificationLink)
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email verification sent to: ${recipientEmail}`);
  } catch (error) {
    console.error('Error sending email verification:', error);
    throw new Error('Failed to send email verification');
  }
};

/**
 * Send pledge confirmation email
 */
export const sendPledgeConfirmation = async (
  recipientEmail: string, 
  receiptDetails: {
    campaignTitle: string;
    amount: number;
    date: string;
    pledgeId: string;
    backerName: string;
  }
): Promise<void> => {
  try {
    const config = getEmailConfig();
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${config.fromName}" <${config.fromAddress}>`,
      to: recipientEmail,
      subject: `Pledge Confirmed - ${receiptDetails.campaignTitle}`,
      html: getPledgeConfirmationTemplate(receiptDetails)
    };

    await transporter.sendMail(mailOptions);
    console.log(`Pledge confirmation sent to: ${recipientEmail}`);
  } catch (error) {
    console.error('Error sending pledge confirmation:', error);
    throw new Error('Failed to send pledge confirmation');
  }
};

/**
 * Send reward tracking email
 */
export const sendRewardTracking = async (
  recipientEmail: string,
  trackingDetails: {
    campaignTitle: string;
    trackingNumber: string;
    carrierName: string;
    trackingUrl: string;
    backerName: string;
  }
): Promise<void> => {
  try {
    const config = getEmailConfig();
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${config.fromName}" <${config.fromAddress}>`,
      to: recipientEmail,
      subject: `Your Reward is Shipped - ${trackingDetails.campaignTitle}`,
      html: getRewardTrackingTemplate(trackingDetails)
    };

    await transporter.sendMail(mailOptions);
    console.log(`Reward tracking email sent to: ${recipientEmail}`);
  } catch (error) {
    console.error('Error sending reward tracking email:', error);
    throw new Error('Failed to send reward tracking email');
  }
};

// =====================================================
// Utility Functions
// =====================================================

/**
 * Test email configuration
 */
export const testEmailConfiguration = async (): Promise<boolean> => {
  try {
    const config = getEmailConfig();
    const transporter = createTransporter();
    
    await transporter.verify();
    console.log('Email configuration is valid');
    return true;
  } catch (error) {
    console.error('Email configuration test failed:', error);
    return false;
  }
};

/**
 * Generate secure reset token
 */
export const generateResetToken = (): string => {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generate verification token
 */
export const generateVerificationToken = (): string => {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
};
