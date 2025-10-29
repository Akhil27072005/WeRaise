import axios, { type AxiosInstance, type AxiosResponse } from 'axios';

// Global API configuration
const API_BASE_URL = 'http://localhost:3001/api';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
let accessToken: string | null = null;
let refreshToken: string | null = null;

// Initialize tokens from localStorage
const initializeTokens = () => {
  accessToken = localStorage.getItem('accessToken');
  refreshToken = localStorage.getItem('refreshToken');
};

// Set tokens
export const setTokens = (access: string, refresh: string) => {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
  console.log('Tokens set:', { accessToken: !!accessToken, refreshToken: !!refreshToken });
};

// Clear tokens
export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

// Get current access token
export const getAccessToken = () => accessToken;

// Get current refresh token
export const getRefreshToken = () => refreshToken;

// Check if user is authenticated
export const isAuthenticated = () => !!accessToken;

// Request interceptor to add auth header
apiClient.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    
    // Don't set Content-Type for FormData - let the browser set it with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't already tried to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Only attempt refresh if we have a refresh token
      if (refreshToken) {
        try {
          // Call refresh token endpoint
          const refreshResponse = await axios.post(`${API_BASE_URL}/user/refresh-token`, {
            refreshToken: refreshToken,
          });

          const { accessToken: newAccessToken, refreshToken: newRefreshToken } = refreshResponse.data.tokens;
          
          // Update tokens
          setTokens(newAccessToken, newRefreshToken);
          
          // Update the original request with new token
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          
          // Retry the original request
          return apiClient(originalRequest);
        } catch (refreshError) {
          // Refresh failed, clear tokens and redirect to login
          clearTokens();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token, redirect to login
        clearTokens();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// Initialize tokens on module load
initializeTokens();

// API endpoints
export const api = {
  // Authentication
  auth: {
    register: (data: { email: string; password: string; firstName: string; lastName: string; isCreator?: boolean }) =>
      apiClient.post('/user/register', data),
    login: (data: { email: string; password: string }) =>
      apiClient.post('/user/login', data),
    refreshToken: (refreshToken: string) =>
      apiClient.post('/user/refresh-token', { refreshToken }),
  },

  // User
  user: {
    getProfile: () => apiClient.get('/user/me'),
    updateProfile: (data: any) => apiClient.put('/user/me', data),
    changePassword: (data: { currentPassword: string; newPassword: string }) => apiClient.put('/user/me/password', data),
    forgotPassword: (email: string) => apiClient.post('/user/forgot-password', { email }),
    resetPassword: (data: { token: string; newPassword: string }) => apiClient.post('/user/reset-password', data),
    resendVerification: (email: string) => apiClient.post('/user/resend-verification', { email }),
    setPassword: (newPassword: string) => apiClient.put('/user/me/set-password', { newPassword }),
    getPaymentMethods: () => apiClient.get('/user/me/payment-methods'),
    addPaymentMethod: (data: any) => apiClient.post('/user/me/payment-methods', data),
    deletePaymentMethod: (id: string) => apiClient.delete(`/user/me/payment-methods/${id}`),
    getPayoutAccounts: () => apiClient.get('/user/me/payout-accounts'),
    addPayoutAccount: (data: any) => apiClient.post('/user/me/payout-accounts', data),
    deletePayoutAccount: (id: string) => apiClient.delete(`/user/me/payout-accounts/${id}`),
    becomeCreator: () => apiClient.post('/user/me/become-creator'),
  },

  // Campaigns
  campaigns: {
    getAll: (params?: { page?: number; limit?: number; category?: string; categoryName?: string; status?: string; sort?: string }) =>
      apiClient.get('/campaigns', { params }),
    getMyCampaigns: () => apiClient.get('/campaigns/my-campaigns'),
    getFundingAnalytics: (days?: number) => apiClient.get('/campaigns/funding-analytics', { params: { days } }),
    getCategories: () => apiClient.get('/campaigns/categories'),
    search: (params: { q: string; page?: number; limit?: number; category?: string; categoryName?: string; minGoal?: number; maxGoal?: number }) =>
      apiClient.get('/campaigns/search', { params }),
    getById: (id: string) => apiClient.get(`/campaigns/${id}`),
    create: (data: any) => apiClient.post('/campaigns', data),
    update: (id: string, data: any) => apiClient.put(`/campaigns/${id}`, data),
    addUpdate: (id: string, data: any) => apiClient.post(`/campaigns/${id}/update`, data),
    getComments: (id: string) => apiClient.get(`/campaigns/${id}/comments`),
    postComment: (id: string, content: string) => apiClient.post(`/campaigns/${id}/comments`, { content }),
    sendTracking: (id: string, data: { trackingNumber: string; carrierName: string; trackingUrl?: string }) => 
      apiClient.post(`/campaigns/${id}/send-tracking`, data),
  },

  // Pledges
  pledges: {
    create: (data: any) => apiClient.post('/pledges', data),
    getHistory: (params?: { page?: number; limit?: number; status?: string }) =>
      apiClient.get('/pledges/history', { params }),
    getUserActivity: () => apiClient.get('/pledges/user-activity'),
    getByCampaign: (campaignId: string, params?: { page?: number; limit?: number; status?: string }) =>
      apiClient.get(`/pledges/campaign/${campaignId}`, { params }),
    getAllForCreator: (params?: { page?: number; limit?: number; status?: string; campaignId?: string }) =>
      apiClient.get('/pledges/creator/all', { params }),
    update: (id: string, data: any) => apiClient.put(`/pledges/${id}`, data),
    // PayPal integration
    createPayPalOrder: (data: { campaignId: string; amount: number; rewardTierId: string }) =>
      apiClient.post('/pledges/paypal/create-order', data),
    capturePayPalOrder: (orderId: string, pledgeId: string) =>
      apiClient.post('/pledges/paypal/capture-order', { orderId, pledgeId }),
    cancelPayPalOrder: (pledgeId: string) =>
      apiClient.post('/pledges/paypal/cancel-order', { pledgeId }),
  },
};

export default apiClient;
