import jwt from 'jsonwebtoken';
import { supabase } from '../db';

// =====================================================
// JWT Authentication Utilities
// =====================================================
// This module handles JWT token generation, verification,
// and automatic token refresh for the crowdfunding platform.
// =====================================================

export interface JWTPayload {
  userId: string;
  email: string;
  isCreator: boolean;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// =====================================================
// TOKEN GENERATION
// =====================================================

/**
 * Generates a short-lived access token (15 minutes)
 * Contains user ID, email, and creator status
 */
export function generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET environment variable is not set');
  }

  return jwt.sign(payload, secret, {
    expiresIn: '15m', // 15 minutes
    issuer: 'werase-crowdfunding',
    audience: 'werase-users'
  });
}

/**
 * Generates a long-lived refresh token (7 days)
 * Contains only user ID for security
 */
export function generateRefreshToken(userId: string): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET environment variable is not set');
  }

  return jwt.sign(
    { userId },
    secret,
    {
      expiresIn: '7d', // 7 days
      issuer: 'werase-crowdfunding',
      audience: 'werase-users'
    }
  );
}

/**
 * Generates both access and refresh tokens
 */
export function generateTokenPair(userId: string, email: string, isCreator: boolean): TokenPair {
  const accessToken = generateAccessToken({ userId, email, isCreator });
  const refreshToken = generateRefreshToken(userId);
  
  return { accessToken, refreshToken };
}

// =====================================================
// TOKEN VERIFICATION
// =====================================================

/**
 * Verifies an access token and returns the decoded payload
 */
export function verifyAccessToken(token: string): JWTPayload {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET environment variable is not set');
  }

  try {
    const decoded = jwt.verify(token, secret, {
      issuer: 'werase-crowdfunding',
      audience: 'werase-users'
    }) as JWTPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Access token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid access token');
    } else {
      throw new Error('Token verification failed');
    }
  }
}

/**
 * Verifies a refresh token and returns the user ID
 */
export function verifyRefreshToken(token: string): { userId: string } {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET environment variable is not set');
  }

  try {
    const decoded = jwt.verify(token, secret, {
      issuer: 'werase-crowdfunding',
      audience: 'werase-users'
    }) as { userId: string };

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    } else {
      throw new Error('Refresh token verification failed');
    }
  }
}

// =====================================================
// TOKEN REFRESH LOGIC
// =====================================================

/**
 * Refreshes an access token using a valid refresh token
 * Returns new access and refresh token pair
 */
export async function refreshTokenPair(refreshToken: string): Promise<TokenPair> {
  try {
    // Verify the refresh token
    const { userId } = verifyRefreshToken(refreshToken);

    // Get user data from database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, is_creator')
      .eq('id', userId)
      .single();

    if (error || !user) {
      throw new Error('User not found');
    }

    // Generate new token pair
    return generateTokenPair(user.id, user.email, user.is_creator);

  } catch (error) {
    throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// =====================================================
// USER AUTHENTICATION HELPERS
// =====================================================

/**
 * Authenticates user credentials and returns token pair
 */
export async function authenticateUser(email: string, password: string): Promise<TokenPair> {
  try {
    // Get user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, password_hash, is_creator')
      .eq('email', email)
      .single();

    if (error || !user) {
      throw new Error('Invalid email or password');
    }

    // Check if user has a password (not OAuth-only)
    if (!user.password_hash) {
      throw new Error('This account uses Google login. Please sign in with Google.');
    }

    // Verify password (assuming bcrypt is used)
    const bcrypt = require('bcryptjs');
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Generate token pair
    return generateTokenPair(user.id, user.email, user.is_creator);

  } catch (error) {
    throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Registers a new user and returns token pair
 */
export async function registerUser(
  email: string, 
  password: string, 
  firstName: string, 
  lastName: string,
  displayName?: string,
  isCreator: boolean = false
): Promise<TokenPair> {
  try {
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 12);

    // Insert new user
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        display_name: displayName || `${firstName} ${lastName}`,
        is_creator: isCreator,
        email_verified: false,
        is_verified: false
      })
      .select('id, email, is_creator')
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('Email already exists');
      }
      throw new Error(`Registration failed: ${error.message}`);
    }

    // Generate token pair
    return generateTokenPair(user.id, user.email, user.is_creator);

  } catch (error) {
    throw new Error(`Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Extracts token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Checks if a token is expired without throwing an error
 */
export function isTokenExpired(token: string, isRefreshToken: boolean = false): boolean {
  try {
    const secret = isRefreshToken ? process.env.JWT_REFRESH_SECRET : process.env.JWT_ACCESS_SECRET;
    if (!secret) return true;

    jwt.verify(token, secret, {
      issuer: 'werase-crowdfunding',
      audience: 'werase-users'
    });
    return false;
  } catch (error) {
    return error instanceof jwt.TokenExpiredError;
  }
}

/**
 * Gets token expiration time
 */
export function getTokenExpiration(token: string, isRefreshToken: boolean = false): Date | null {
  try {
    const secret = isRefreshToken ? process.env.JWT_REFRESH_SECRET : process.env.JWT_ACCESS_SECRET;
    if (!secret) return null;

    const decoded = jwt.verify(token, secret, {
      issuer: 'werase-crowdfunding',
      audience: 'werase-users'
    }) as any;

    return new Date(decoded.exp * 1000);
  } catch (error) {
    return null;
  }
}
