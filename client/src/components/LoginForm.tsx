import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { setTokens } from '../lib/api';
import { z } from 'zod';

// Zod validation schema for login
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const LoginForm: React.FC = () => {
  const { login, setUserFromTokens } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Partial<LoginFormData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string>('');

  // Handle OAuth callback
  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const oauthSuccess = searchParams.get('oauth_success');
    const error = searchParams.get('error');

    if (error === 'oauth_failed') {
      setApiError('Google login failed. Please try again.');
      return;
    }

    if (oauthSuccess === 'true' && accessToken && refreshToken) {
      console.log('OAuth success detected, processing tokens...');
      // Store tokens using the proper API function
      setTokens(accessToken, refreshToken);
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Fetch user data immediately to avoid race condition
      const fetchUserData = async () => {
        try {
          console.log('Fetching user data from tokens...');
          await setUserFromTokens();
          console.log('User data fetched successfully, navigating to dashboard...');
          // Navigate to dashboard after user data is loaded
          navigate('/dashboard');
        } catch (error) {
          console.error('Failed to fetch user data after OAuth:', error);
          // Fallback: still redirect to dashboard, let AuthContext handle it
          navigate('/dashboard');
        }
      };
      
      fetchUserData();
    }
  }, [searchParams, navigate, setUserFromTokens]);

  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/auth/google`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear errors when user starts typing
    if (errors[name as keyof LoginFormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
    if (apiError) {
      setApiError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validate form data
      loginSchema.parse(formData);
      setErrors({});
      setApiError('');
      setIsLoading(true);

      // Call login API
      await login(formData.email, formData.password);
      
      // Redirect to dashboard on success
      navigate('/dashboard');
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Partial<LoginFormData> = {};
        error.issues.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof LoginFormData] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        // API error
        setApiError(error instanceof Error ? error.message : 'Login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-4">
      <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 flex items-center justify-center">
        <img src="../../public/WeRaise_Logo.png" alt="We Raise" className="w-60 h-60" />
      </div>

      {/* Main Form Card */}
      <Card className="w-full max-w-md bg-white shadow-xl border border-gray-200 rounded-2xl">
        <CardHeader className="text-center pb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h1>
          <p className="text-gray-600 text-sm">
            Login with your Google account
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Social Login Buttons */}
          <div className="space-y-3">
                      
              <Button 
                variant="outline" 
                className="w-full border-gray-300 text-black bg-white hover:bg-gray-50 h-12 rounded-lg cursor-pointer"
                onClick={handleGoogleLogin}
              >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Login with Google
            </Button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          {/* API Error Display */}
          {apiError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm">{apiError}</p>
            </div>
          )}

          {/* Email and Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-black mb-2">
                Email
              </label>
              <Input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="m@example.com"
                className="bg-white border border-gray-300 text-black placeholder-gray-400 focus:ring-2 focus:ring-gray-400 focus:border-gray-500 h-12 rounded-lg"
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-black">
                  Password
                </label>
                <a href="#" className="text-sm text-gray-500 hover:text-gray-700">
                  Forgot your password?
                </a>
              </div>
              <Input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="bg-white border border-gray-300 text-black placeholder-gray-400 focus:ring-2 focus:ring-gray-400 focus:border-gray-500 h-12 rounded-lg"
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-gray-200 text-black hover:bg-gray-300 h-12 font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </form>

          {/* Sign up link */}
          <div className="text-center">
            <p className="text-gray-600 text-sm">
              Don't have an account?{' '}
              <Link to="/signup" className="text-blue-600 hover:text-blue-700 font-medium cursor-pointer">
                Sign up
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Footer Legal Text */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-center">
        <p className="text-gray-500 text-xs">
          By clicking continue, you agree to our{' '}
          <a href="#" className="text-blue-600 hover:text-blue-700 underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="#" className="text-blue-600 hover:text-blue-700 underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
};

export default LoginForm;
