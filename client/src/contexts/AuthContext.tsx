import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setTokens, clearTokens, isAuthenticated as checkAuth } from '../lib/api';

// Types
interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  location?: string;
  is_creator: boolean;
  is_verified: boolean;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
  last_login?: string;
  isGoogleConnected?: boolean;
  hasPassword?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isCreator: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  refreshUserData: () => Promise<void>;
  setUserFromTokens: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  isCreator?: boolean;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Computed values
  const isAuthenticated = !!user;
  const isCreator = user?.is_creator || false;

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (checkAuth()) {
          // Try to fetch user data
          const response = await api.user.getProfile();
          setUser(response.data.user);
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        clearTokens();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (email: string, password: string) => {
    try {
      const response = await api.auth.login({ email, password });
      const { accessToken, refreshToken } = response.data.tokens;
      
      // Set tokens
      setTokens(accessToken, refreshToken);
      
      // Fetch user data
      const userResponse = await api.user.getProfile();
      setUser(userResponse.data.user);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed';
      throw new Error(message);
    }
  };

  // Register function
  const register = async (data: RegisterData) => {
    try {
      const response = await api.auth.register(data);
      const { accessToken, refreshToken } = response.data.tokens;
      
      // Set tokens
      setTokens(accessToken, refreshToken);
      
      // Fetch user data
      const userResponse = await api.user.getProfile();
      setUser(userResponse.data.user);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Registration failed';
      throw new Error(message);
    }
  };

  // Logout function
  const logout = () => {
    clearTokens();
    setUser(null);
  };

  // Refresh user data
  const refreshUserData = async () => {
    try {
      const response = await api.user.getProfile();
      setUser(response.data.user);
    } catch (error) {
      console.error('Failed to refresh user data:', error);
      logout();
    }
  };

  // Set user data from existing tokens (for OAuth flow)
  const setUserFromTokens = async () => {
    try {
      console.log('setUserFromTokens called, checking auth...');
      if (checkAuth()) {
        console.log('User is authenticated, fetching profile...');
        const response = await api.user.getProfile();
        console.log('Profile fetched:', response.data.user);
        setUser(response.data.user);
      } else {
        console.log('User is not authenticated according to checkAuth()');
      }
    } catch (error) {
      console.error('Failed to set user from tokens:', error);
      clearTokens();
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isCreator,
    isLoading,
    login,
    register,
    logout,
    refreshUserData,
    setUserFromTokens,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
