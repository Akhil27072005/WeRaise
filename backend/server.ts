import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import passport from 'passport';
import dotenv from 'dotenv';
import { testConnection } from './db';
import { authErrorHandler } from './middleware/authMiddleware';

// Import route handlers
import userRoutes from './routes/user';
import campaignRoutes from './routes/campaigns';
import pledgeRoutes from './routes/pledges';

// Import Passport configuration
import './config/passport';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Vite default port
  credentials: true
}));

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session middleware (required for Passport OAuth)
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// =====================================================
// API ROUTES
// =====================================================

// Health check endpoints
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/health', async (req, res) => {
  try {
    // Test database connection (only if Supabase is configured)
    if (process.env.SUPABASE_URL && (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
      await testConnection();
      res.json({ 
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({ 
        status: 'healthy',
        database: 'not configured',
        message: 'Supabase configuration not set in .env file',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Google OAuth routes (separate from user routes)
app.get('/auth/google', (req, res) => {
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

app.get('/auth/google/register', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Google OAuth is not configured. Please contact the administrator.'
    });
    return;
  }
  
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: 'register' // Add state to distinguish registration from login
  })(req, res);
});

app.get('/auth/google/callback', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_not_configured`);
    return;
  }
  
  passport.authenticate('google', { failureRedirect: '/login?error=oauth_failed' })(req, res, async () => {
    try {
      const user = req.user as any;
      const state = req.query.state as string;
      
      if (!user) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_failed`);
      }

      // Generate JWT tokens
      const { generateOAuthTokens } = await import('./config/passport');
      const { accessToken, refreshToken } = await generateOAuthTokens(user);

      // Redirect to appropriate frontend page based on state
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      let redirectUrl;
      
      if (state === 'register') {
        // Redirect to signup page for registration flow
        redirectUrl = `${frontendUrl}/signup?access_token=${accessToken}&refresh_token=${refreshToken}&oauth_success=true`;
      } else {
        // Default to login page for login flow
        redirectUrl = `${frontendUrl}/login?access_token=${accessToken}&refresh_token=${refreshToken}&oauth_success=true`;
      }
      
      res.redirect(redirectUrl);

    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_failed`);
    }
  });
});

// API route handlers
app.use('/api/user', userRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/pledges', pledgeRoutes);

// 404 handler - catch all routes
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl 
  });
});

// Authentication error handler
app.use(authErrorHandler);

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('🚨 Server error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Start server
const startServer = async () => {
  try {
    // Start server first
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
    
    // Test database connection after server starts
    if (process.env.SUPABASE_URL && (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
      try {
        await testConnection();
        console.log('Database connection successful');
      } catch (error) {
        console.log('Database connection failed:', error instanceof Error ? error.message : 'Unknown error');
      }
    } else {
      console.log('Database connection skipped - Supabase configuration not set');
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

export default app;
