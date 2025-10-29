import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, extractTokenFromHeader, JWTPayload, refreshTokenPair } from '../utils/auth';

// =====================================================
// Authentication Middleware
// =====================================================
// This middleware handles JWT token verification and
// automatic token refresh for protected routes.
// =====================================================


// =====================================================
// MAIN AUTHENTICATION MIDDLEWARE
// =====================================================

/**
 * Middleware to authenticate JWT access tokens
 * Attaches user data to req.user if token is valid
 * Returns 401 if token is invalid or missing
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  try {
    // Extract token from Authorization header
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Access token is required',
        code: 'MISSING_TOKEN'
      });
      return;
    }

    // Verify the access token
    const decoded = verifyAccessToken(token);
    
    // Attach user data to request
    req.user = decoded;
    
    // Continue to next middleware/route handler
    next();

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Token verification failed';
    
    res.status(401).json({
      error: 'Unauthorized',
      message: errorMessage,
      code: 'INVALID_TOKEN'
    });
  }
}

// =====================================================
// OPTIONAL AUTHENTICATION MIDDLEWARE
// =====================================================

/**
 * Middleware that optionally authenticates tokens
 * Attaches user data to req.user if token is valid
 * Continues without error if token is missing or invalid
 * Useful for routes that work differently for authenticated vs anonymous users
 */
export function optionalAuthenticateToken(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (token) {
      const decoded = verifyAccessToken(token);
      req.user = decoded;
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
}

// =====================================================
// CREATOR-ONLY MIDDLEWARE
// =====================================================

/**
 * Middleware that requires user to be a creator
 * Must be used after authenticateToken middleware
 */
export function requireCreator(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED'
    });
    return;
  }

  if (!(req.user as JWTPayload).isCreator) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Creator access required',
      code: 'CREATOR_REQUIRED'
    });
    return;
  }

  next();
}

// =====================================================
// TOKEN REFRESH MIDDLEWARE
// =====================================================

/**
 * Middleware that attempts to refresh expired access tokens
 * Checks for refresh token in request body or headers
 * Automatically generates new token pair if refresh token is valid
 */
export async function attemptTokenRefresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Check if access token is expired
    const accessToken = extractTokenFromHeader(req.headers.authorization);
    
    if (!accessToken) {
      next();
      return;
    }

    // Try to verify the access token
    try {
      const decoded = verifyAccessToken(accessToken);
      req.user = decoded;
      next();
      return;
    } catch (error) {
      // If token is expired, try to refresh it
      if (error instanceof Error && error.message.includes('expired')) {
        const refreshToken = req.body.refreshToken || req.headers['x-refresh-token'] as string;
        
        if (refreshToken) {
          try {
            const newTokens = await refreshTokenPair(refreshToken);
            
            // Set new tokens in response headers
            res.setHeader('X-New-Access-Token', newTokens.accessToken);
            res.setHeader('X-New-Refresh-Token', newTokens.refreshToken);
            
            // Continue with refreshed token
            const decoded = verifyAccessToken(newTokens.accessToken);
            req.user = decoded;
            next();
            return;
          } catch (refreshError) {
            // Refresh failed, continue without authentication
            res.status(401).json({
              error: 'Unauthorized',
              message: 'Token refresh failed',
              code: 'REFRESH_FAILED'
            });
            return;
          }
        }
      }
      
      // Token is invalid or refresh token is missing
      res.status(401).json({
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication middleware error',
      code: 'AUTH_MIDDLEWARE_ERROR'
    });
  }
}

// =====================================================
// RATE LIMITING MIDDLEWARE (Optional)
// =====================================================

/**
 * Simple rate limiting middleware for authentication endpoints
 * Prevents brute force attacks on login/register endpoints
 */
export function createRateLimit(maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) {
  const attempts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    const clientAttempts = attempts.get(clientId);
    
    if (!clientAttempts || now > clientAttempts.resetTime) {
      // Reset or initialize attempts
      attempts.set(clientId, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }
    
    if (clientAttempts.count >= maxAttempts) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((clientAttempts.resetTime - now) / 1000)
      });
      return;
    }
    
    clientAttempts.count++;
    next();
  };
}

// =====================================================
// ERROR HANDLING MIDDLEWARE
// =====================================================

/**
 * Global error handler for authentication-related errors
 */
export function authErrorHandler(error: any, req: Request, res: Response, next: NextFunction): void {
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
    return;
  }
  
  if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Token has expired',
      code: 'TOKEN_EXPIRED'
    });
    return;
  }
  
  // Pass other errors to the next error handler
  next(error);
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Extracts user ID from authenticated request
 */
export function getUserId(req: Request): string | null {
  return (req.user as JWTPayload)?.userId || null;
}

/**
 * Checks if the authenticated user is a creator
 */
export function isCreator(req: Request): boolean {
  return (req.user as JWTPayload)?.isCreator || false;
}

/**
 * Validates that the authenticated user owns the resource
 */
export function validateResourceOwnership(req: Request, resourceUserId: string): boolean {
  return (req.user as JWTPayload)?.userId === resourceUserId;
}
