import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import passport from 'passport';
import { supabase } from '../db';
import { authenticateToken, createRateLimit } from '../middleware/authMiddleware';
import { authenticateUser, registerUser, refreshTokenPair, JWTPayload } from '../utils/auth';
import { sendPasswordReset, sendEmailVerification, generateResetToken, generateVerificationToken } from '../utils/emailService';
import { generateOAuthTokens } from '../config/passport';

// Extend Request interface for this file
interface AuthenticatedRequest extends Request {
  user: JWTPayload;
}

// =====================================================
// User Routes
// =====================================================
// Handles user authentication, registration, profile management,
// and payment/payout account management.
// =====================================================

const router = Router();

// Rate limiting for authentication endpoints
const authRateLimit = createRateLimit(5, 15 * 60 * 1000); // 5 attempts per 15 minutes

// =====================================================
// AUTHENTICATION ROUTES (PUBLIC)
// =====================================================

/**
 * POST /api/user/register
 * Creates a new user account and returns access & refresh tokens
 * PUBLIC ACCESS - No authentication required
 */
router.post('/register', 
  authRateLimit,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('firstName').trim().isLength({ min: 1 }).withMessage('First name is required'),
    body('lastName').trim().isLength({ min: 1 }).withMessage('Last name is required'),
    body('displayName').optional().trim().isLength({ min: 1 }),
    body('isCreator').optional().isBoolean()
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: errors.array()
        });
        return;
      }

      const { email, password, firstName, lastName, displayName, isCreator = false } = req.body;

      // Register user and get tokens
      const tokens = await registerUser(email, password, firstName, lastName, displayName, isCreator);

      res.status(201).json({
        message: 'User registered successfully',
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken
        }
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      
      if (message.includes('Email already exists')) {
        res.status(409).json({
          error: 'Conflict',
          message: 'Email already exists'
        });
      } else {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Registration failed'
        });
      }
      return;
    }
  }
);

/**
 * POST /api/user/login
 * Authenticates user credentials and returns access & refresh tokens
 * PUBLIC ACCESS - No authentication required
 */
router.post('/login',
  authRateLimit,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: errors.array()
        });
        return;
      }

      const { email, password } = req.body;

      // Authenticate user and get tokens
      const tokens = await authenticateUser(email, password);

      res.json({
        message: 'Login successful',
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken
        }
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
      return;
    }
  }
);

/**
 * POST /api/user/refresh-token
 * Refreshes access token using refresh token
 * PUBLIC ACCESS - No authentication required
 */
router.post('/refresh-token',
  [
    body('refreshToken').notEmpty().withMessage('Refresh token is required')
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Refresh token is required',
          details: errors.array()
        });
        return;
      }

      const { refreshToken } = req.body;

      // Refresh tokens
      const newTokens = await refreshTokenPair(refreshToken);

      res.json({
        message: 'Tokens refreshed successfully',
        tokens: {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken
        }
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token refresh failed';
      
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token'
      });
      return;
    }
  }
);

// =====================================================
// USER PROFILE ROUTES (PROTECTED)
// =====================================================

/**
 * GET /api/user/me
 * Retrieves current user's profile data
 * PROTECTED ACCESS - Requires authentication
 */
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as JWTPayload).userId;

    // Get user profile data
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        first_name,
        last_name,
        display_name,
        bio,
        avatar_url,
        location,
        is_creator,
        is_verified,
        email_verified,
        google_id,
        password_hash,
        created_at,
        updated_at,
        last_login
      `)
      .eq('id', userId)
      .single();

    if (error || !user) {
      res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
      return;
    }

    res.json({
      user: {
        ...user,
        // Add OAuth information
        isGoogleConnected: !!user.google_id,
        hasPassword: !!user.password_hash,
        // Remove sensitive data
        password_hash: undefined,
        google_id: undefined
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve user profile'
    });
    return;
  }
});

/**
 * PUT /api/user/me
 * Updates user's personal information
 * PROTECTED ACCESS - Requires authentication
 */
router.put('/me', 
  authenticateToken,
  [
    body('firstName').optional().trim().isLength({ min: 1 }),
    body('lastName').optional().trim().isLength({ min: 1 }),
    body('displayName').optional().trim().isLength({ min: 1 }),
    body('bio').optional().trim().isLength({ max: 1000 }),
    body('location').optional().trim().isLength({ max: 255 }),
    body('avatarUrl').optional().isURL()
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: errors.array()
        });
        return;
      }

      const userId = (req.user as JWTPayload).userId;
      const { firstName, lastName, displayName, bio, location, avatarUrl } = req.body;

      // Build update object
      const updateData: any = {};
      if (firstName !== undefined) updateData.first_name = firstName;
      if (lastName !== undefined) updateData.last_name = lastName;
      if (displayName !== undefined) updateData.display_name = displayName;
      if (bio !== undefined) updateData.bio = bio;
      if (location !== undefined) updateData.location = location;
      if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl;

      // Update user
      const { data: user, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select(`
          id,
          email,
          first_name,
          last_name,
          display_name,
          bio,
          avatar_url,
          location,
          is_creator,
          is_verified,
          email_verified,
          updated_at
        `)
        .single();

      if (error) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to update user profile'
        });
        return;
      }

      res.json({
        message: 'Profile updated successfully',
        user
      });

    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update profile'
      });
      return;
    }
  }
);

// =====================================================
// PAYMENT METHODS ROUTES (PROTECTED)
// =====================================================

/**
 * PUT /api/user/me/payment-methods
 * Adds or updates saved payment methods
 * PROTECTED ACCESS - Requires authentication
 */
router.put('/me/payment-methods',
  authenticateToken,
  [
    body('type').isIn(['card', 'paypal', 'apple_pay', 'google_pay']).withMessage('Invalid payment type'),
    body('provider').notEmpty().withMessage('Provider is required'),
    body('lastFourDigits').isLength({ min: 4, max: 4 }).withMessage('Last four digits must be 4 characters'),
    body('expiryMonth').optional().isInt({ min: 1, max: 12 }),
    body('expiryYear').optional().isInt({ min: new Date().getFullYear() }),
    body('cardholderName').optional().trim().isLength({ min: 1 }),
    body('isDefault').optional().isBoolean()
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: errors.array()
        });
        return;
      }

      const userId = (req.user as JWTPayload).userId;
      const { 
        type, 
        provider, 
        lastFourDigits, 
        expiryMonth, 
        expiryYear, 
        cardholderName, 
        isDefault = false 
      } = req.body;

      // If setting as default, unset other defaults
      if (isDefault) {
        await supabase
          .from('payment_methods')
          .update({ is_default: false })
          .eq('user_id', userId);
      }

      // Insert new payment method
      const { data: paymentMethod, error } = await supabase
        .from('payment_methods')
        .insert({
          user_id: userId,
          type,
          provider,
          last_four_digits: lastFourDigits,
          expiry_month: expiryMonth,
          expiry_year: expiryYear,
          cardholder_name: cardholderName,
          is_default: isDefault,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to add payment method'
        });
        return;
      }

      res.status(201).json({
        message: 'Payment method added successfully',
        paymentMethod
      });

    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to add payment method'
      });
      return;
    }
  }
);

/**
 * DELETE /api/user/me/payment-methods/:id
 * Removes a payment method
 * PROTECTED ACCESS - Requires authentication
 */
router.delete('/me/payment-methods/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as JWTPayload).userId;
    const paymentMethodId = req.params.id;

    // Verify ownership and delete
    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', paymentMethodId)
      .eq('user_id', userId);

    if (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete payment method'
      });
      return;
    }

    res.json({
      message: 'Payment method deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete payment method'
    });
    return;
  }
});

// =====================================================
// PAYOUT ACCOUNTS ROUTES (PROTECTED)
// =====================================================

/**
 * PUT /api/user/me/payout-accounts
 * Adds or updates bank payout accounts
 * PROTECTED ACCESS - Requires authentication
 */
router.put('/me/payout-accounts',
  authenticateToken,
  [
    body('type').isIn(['bank_account', 'paypal']).withMessage('Invalid payout type'),
    body('bankName').optional().trim().isLength({ min: 1 }),
    body('accountHolderName').notEmpty().withMessage('Account holder name is required'),
    body('isDefault').optional().isBoolean()
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: errors.array()
        });
        return;
      }

      const userId = (req.user as JWTPayload).userId;
      const { type, bankName, accountHolderName, isDefault = false } = req.body;

      // If setting as default, unset other defaults
      if (isDefault) {
        await supabase
          .from('payout_accounts')
          .update({ is_default: false })
          .eq('user_id', userId);
      }

      // Insert new payout account
      const { data: payoutAccount, error } = await supabase
        .from('payout_accounts')
        .insert({
          user_id: userId,
          type,
          bank_name: bankName,
          account_holder_name: accountHolderName,
          is_default: isDefault,
          is_active: true,
          is_verified: false // Requires verification process
        })
        .select()
        .single();

      if (error) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to add payout account'
        });
        return;
      }

      res.status(201).json({
        message: 'Payout account added successfully',
        payoutAccount
      });

    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to add payout account'
      });
      return;
    }
  }
);

/**
 * PUT /api/user/me/password
 * Changes the user's password
 * PROTECTED - Requires authentication
 */
router.put('/me/password',
  authenticateToken,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: errors.array()
        });
        return;
      }

      const userId = (req.user as JWTPayload).userId;
      const { currentPassword, newPassword } = req.body;

      // Get current user data
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('password_hash, google_id')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        res.status(404).json({
          error: 'Not Found',
          message: 'User not found'
        });
        return;
      }

      // Check if user is OAuth-only (no password set)
      if (!user.password_hash && user.google_id) {
        res.status(400).json({
          error: 'Invalid Request',
          message: 'Cannot change password for Google OAuth accounts. Please set a password first.'
        });
        return;
      }

      // Verify current password
      const bcrypt = require('bcrypt');
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
      
      if (!isCurrentPasswordValid) {
        res.status(400).json({
          error: 'Invalid Password',
          message: 'Current password is incorrect'
        });
        return;
      }

      // Hash new password
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          password_hash: newPasswordHash,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to update password'
        });
        return;
      }

      res.json({
        message: 'Password updated successfully'
      });

    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to change password'
      });
      return;
    }
  }
);

/**
 * POST /api/user/forgot-password
 * Sends password reset email to user
 * PUBLIC ACCESS - No authentication required
 */
router.post('/forgot-password',
  authRateLimit,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid email address',
          details: errors.array()
        });
        return;
      }

      const { email } = req.body;

      // Check if user exists
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, first_name')
        .eq('email', email)
        .single();

      if (userError || !user) {
        // Don't reveal if email exists or not for security
        res.json({
          message: 'If an account with that email exists, a password reset link has been sent.'
        });
        return;
      }

      // Generate reset token
      const resetToken = generateResetToken();
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Store reset token in database (you might want to create a password_reset_tokens table)
      // For now, we'll use a simple approach with user table
      const { error: updateError } = await supabase
        .from('users')
        .update({
          password_reset_token: resetToken,
          password_reset_expires: resetExpiry.toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to process password reset request'
        });
        return;
      }

      // Generate reset link
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

      // Send password reset email
      await sendPasswordReset(email, resetLink);

      res.json({
        message: 'If an account with that email exists, a password reset link has been sent.'
      });

    } catch (error) {
      console.error('Error processing forgot password:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to process password reset request'
      });
      return;
    }
  }
);

/**
 * POST /api/user/resend-verification
 * Resends email verification link
 * PUBLIC ACCESS - No authentication required
 */
router.post('/resend-verification',
  authRateLimit,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid email address',
          details: errors.array()
        });
        return;
      }

      const { email } = req.body;

      // Check if user exists and is not verified
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, email_verified, first_name')
        .eq('email', email)
        .single();

      if (userError || !user) {
        res.status(404).json({
          error: 'Not Found',
          message: 'User not found'
        });
        return;
      }

      if (user.email_verified) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Email is already verified'
        });
        return;
      }

      // Generate verification token
      const verificationToken = generateVerificationToken();
      const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      // Store verification token in database
      const { error: updateError } = await supabase
        .from('users')
        .update({
          email_verification_token: verificationToken,
          email_verification_expires: verificationExpiry.toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to process verification request'
        });
        return;
      }

      // Generate verification link
      const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

      // Send verification email
      await sendEmailVerification(email, verificationLink);

      res.json({
        message: 'Verification email has been sent'
      });

    } catch (error) {
      console.error('Error processing resend verification:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to process verification request'
      });
      return;
    }
  }
);

/**
 * POST /api/user/reset-password
 * Resets user password using token
 * PUBLIC ACCESS - No authentication required
 */
router.post('/reset-password',
  authRateLimit,
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: errors.array()
        });
        return;
      }

      const { token, newPassword } = req.body;

      // Find user with valid reset token
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, password_reset_token, password_reset_expires')
        .eq('password_reset_token', token)
        .single();

      if (userError || !user) {
        res.status(400).json({
          error: 'Invalid Token',
          message: 'Invalid or expired reset token'
        });
        return;
      }

      // Check if token is expired
      if (new Date() > new Date(user.password_reset_expires)) {
        res.status(400).json({
          error: 'Expired Token',
          message: 'Reset token has expired'
        });
        return;
      }

      // Hash new password
      const bcrypt = require('bcrypt');
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password and clear reset token
      const { error: updateError } = await supabase
        .from('users')
        .update({
          password_hash: hashedPassword,
          password_reset_token: null,
          password_reset_expires: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to reset password'
        });
        return;
      }

      res.json({
        message: 'Password has been reset successfully'
      });

    } catch (error) {
      console.error('Error resetting password:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to reset password'
      });
      return;
    }
  }
);

/**
 * GET /auth/google
 * Initiates Google OAuth login flow
 * PUBLIC ACCESS - No authentication required
 */
router.get('/auth/google', (req: Request, res: Response) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Google OAuth is not configured. Please contact the administrator.'
    });
    return;
  }
  
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })(req, res);
});

/**
 * GET /auth/google/callback
 * Google OAuth callback endpoint
 * PUBLIC ACCESS - No authentication required
 */
router.get('/auth/google/callback', (req: Request, res: Response) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_not_configured`);
    return;
  }
  
  passport.authenticate('google', { failureRedirect: '/login?error=oauth_failed' })(req, res, async () => {
    try {
      const user = req.user as any;
      
      if (!user) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_failed`);
      }

      // Generate JWT tokens
      const { accessToken, refreshToken } = await generateOAuthTokens(user);

      // Redirect to frontend with tokens
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectUrl = `${frontendUrl}/login?access_token=${accessToken}&refresh_token=${refreshToken}&oauth_success=true`;
      
      res.redirect(redirectUrl);

    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_failed`);
    }
  });
});

/**
 * PUT /api/user/me/set-password
 * Sets a password for OAuth users (Google accounts without passwords)
 * PROTECTED - Requires authentication
 */
router.put('/me/set-password',
  authenticateToken,
  [
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: errors.array()
        });
        return;
      }

      const userId = (req.user as JWTPayload).userId;
      const { newPassword } = req.body;

      // Get current user data
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('password_hash, google_id')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        res.status(404).json({
          error: 'Not Found',
          message: 'User not found'
        });
        return;
      }

      // Check if user already has a password
      if (user.password_hash) {
        res.status(400).json({
          error: 'Invalid Request',
          message: 'User already has a password. Use the change password endpoint instead.'
        });
        return;
      }

      // Hash new password
      const bcrypt = require('bcrypt');
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          password_hash: hashedPassword,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to set password'
        });
        return;
      }

      res.json({
        message: 'Password set successfully'
      });

    } catch (error) {
      console.error('Error setting password:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to set password'
      });
      return;
    }
  }
);

/**
 * POST /api/user/me/become-creator
 * Upgrades a backer account to creator status
 * PROTECTED ACCESS - Requires authentication
 */
router.post('/me/become-creator',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = (req.user as JWTPayload).userId;

      // Check if user is already a creator
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('is_creator')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        res.status(404).json({
          error: 'Not Found',
          message: 'User not found'
        });
        return;
      }

      if (user.is_creator) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'User is already a creator'
        });
        return;
      }

      // Update user to creator status
      const { error: updateError } = await supabase
        .from('users')
        .update({
          is_creator: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to upgrade to creator'
        });
        return;
      }

      res.json({
        message: 'Successfully upgraded to creator account',
        isCreator: true
      });

    } catch (error) {
      console.error('Error upgrading to creator:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to upgrade to creator'
      });
      return;
    }
  }
);

export default router;
