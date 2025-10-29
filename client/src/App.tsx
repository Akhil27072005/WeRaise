import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import SignupPage from './pages/SignupPage';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import ExplorePage from './pages/ExplorePage';
import CampaignDetailPage from './pages/CampaignDetailPage';
import ProfilePage from './pages/ProfilePage';
import PledgeHistoryPage from './pages/PledgeHistoryPage';
import NewCampaignPage from './pages/NewCampaignPage';
import EditCampaignPage from './pages/EditCampaignPage';

function App() {
  // PayPal configuration - using sandbox for development
  const paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || "your_client_id_here"; // Temporary hardcode for testing
  
  // Debug logging
  console.log('Environment variables:', import.meta.env);
  console.log('PayPal Client ID:', paypalClientId);
  console.log('PayPal Client ID type:', typeof paypalClientId);
  console.log('PayPal Client ID length:', paypalClientId?.length);
  
  if (!paypalClientId) {
    console.error('PayPal Client ID not found! Please set VITE_PAYPAL_CLIENT_ID in your environment variables.');
  }

  const paypalOptions = {
    clientId: paypalClientId || "sb", // Use environment variable or fallback to sandbox
    currency: "USD",
    intent: "capture",
    "enable-funding": "venmo,paylater",
    "disable-funding": "",
    "data-sdk-integration-source": "integrationbuilder_ac"
  };

  return (
    <PayPalScriptProvider options={paypalOptions}>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/campaign/:campaignId" element={<CampaignDetailPage />} />
            
            {/* Protected routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/pledge-history" element={
              <ProtectedRoute>
                <PledgeHistoryPage />
              </ProtectedRoute>
            } />
            <Route path="/new-campaign" element={
              <ProtectedRoute>
                <NewCampaignPage />
              </ProtectedRoute>
            } />
            <Route path="/edit-campaign/:campaignId" element={
              <ProtectedRoute>
                <EditCampaignPage />
              </ProtectedRoute>
            } />
          </Routes>
        </Router>
      </AuthProvider>
    </PayPalScriptProvider>
  );
}

export default App;
