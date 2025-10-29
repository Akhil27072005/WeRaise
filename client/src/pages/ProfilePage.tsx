import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Shield, 
  Activity, 
  Bell, 
  CreditCard,
  Edit,
  Save,
  Plus,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  X,
  Trash2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

// Modal Component - defined outside to prevent re-creation on every render
const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

const ProfilePage: React.FC = () => {
  const { user, refreshUserData } = useAuth();
  const [activeTab, setActiveTab] = useState<'account' | 'activity' | 'notifications' | 'payments'>('account');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [payoutAccounts, setPayoutAccounts] = useState<any[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(true);
  const [userActivity, setUserActivity] = useState<{
    backerActivity: {
      totalPledged: number;
      recentPledges: any[];
    };
    creatorActivity: {
      totalRaised: number;
      launchedCampaigns: any[];
    };
  } | null>(null);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);

  // In-place editing states
  const [editValues, setEditValues] = useState({
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    displayName: user?.display_name || '',
    bio: user?.bio || '',
    location: user?.location || '',
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Password change states
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Update editValues when user changes
  useEffect(() => {
    setEditValues({
      firstName: user?.first_name || '',
      lastName: user?.last_name || '',
      displayName: user?.display_name || '',
      bio: user?.bio || '',
      location: user?.location || '',
    });
  }, [user]);

  // Fetch payment methods and payout accounts
  useEffect(() => {
    const fetchPaymentData = async () => {
      try {
        setIsLoadingPaymentMethods(true);
        
        // Fetch payment methods
        const paymentMethodsResponse = await api.user.getPaymentMethods();
        setPaymentMethods(paymentMethodsResponse.data.paymentMethods || []);
        
        // Fetch payout accounts
        const payoutAccountsResponse = await api.user.getPayoutAccounts();
        setPayoutAccounts(payoutAccountsResponse.data.payoutAccounts || []);
      } catch (err) {
        console.error('Error fetching payment data:', err);
        // Set empty arrays on error
        setPaymentMethods([]);
        setPayoutAccounts([]);
      } finally {
        setIsLoadingPaymentMethods(false);
      }
    };

    fetchPaymentData();
  }, []);

  // Fetch user activity data
  useEffect(() => {
    const fetchUserActivity = async () => {
      try {
        setIsLoadingActivity(true);
        const response = await api.pledges.getUserActivity();
        setUserActivity(response.data);
      } catch (err) {
        console.error('Error fetching user activity:', err);
        // Set default empty data on error
        setUserActivity({
          backerActivity: {
            totalPledged: 0,
            recentPledges: []
          },
          creatorActivity: {
            totalRaised: 0,
            launchedCampaigns: []
          }
        });
      } finally {
        setIsLoadingActivity(false);
      }
    };

    fetchUserActivity();
  }, []);


  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'editCard' | 'addCard' | 'editBank' | 'addBank' | 'confirmDelete' | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Form states for modals
  const [cardForm, setCardForm] = useState({
    number: '',
    expiry: '',
    cvv: '',
    name: ''
  });
  const [bankForm, setBankForm] = useState({
    bankName: '',
    accountNumber: '',
    routingNumber: '',
    accountHolderName: ''
  });

  const recentlyBackedCampaigns = userActivity?.backerActivity?.recentPledges || [];
  const launchedCampaigns = userActivity?.creatorActivity?.launchedCampaigns || [];


  // Helper functions for profile editing
  const startEditingProfile = () => {
    setIsEditingProfile(true);
  };

  const cancelEditingProfile = () => {
    setIsEditingProfile(false);
    // Reset to original values
    setEditValues({
      firstName: user?.first_name || '',
      lastName: user?.last_name || '',
      displayName: user?.display_name || '',
      bio: user?.bio || '',
      location: user?.location || '',
    });
  };

  const saveProfile = async () => {
    try {
      setIsSavingProfile(true);
      setError('');
      
      // Prepare the update data
      const updateData = {
        firstName: editValues.firstName,
        lastName: editValues.lastName,
        displayName: editValues.displayName,
        bio: editValues.bio,
        location: editValues.location,
      };

      // Make API call to update profile
      await api.user.updateProfile(updateData);
      
      // Refresh user data
      await refreshUserData();
      
      setIsEditingProfile(false);
      setSuccess('Profile updated successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleProfileInputChange = (field: string, value: string) => {
    setEditValues(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Password change functions
  const startEditingPassword = () => {
    setIsEditingPassword(true);
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  };

  const cancelEditingPassword = () => {
    setIsEditingPassword(false);
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  };

  const savePassword = async () => {
    try {
      // Validate passwords
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setError('New passwords do not match');
        return;
      }

      if (passwordData.newPassword.length < 8) {
        setError('New password must be at least 8 characters long');
        return;
      }

      setIsChangingPassword(true);
      setError('');
      
      // Make API call based on user type
      if (user?.hasPassword) {
        // Change existing password
        await api.user.changePassword({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        });
      } else {
        // Set new password for OAuth users
        await api.user.setPassword(passwordData.newPassword);
      }
      
      setIsEditingPassword(false);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setSuccess('Password changed successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err: any) {
      console.error('Error changing password:', err);
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handlePasswordInputChange = (field: string, value: string) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Modal helper functions
  const openModal = (type: 'editCard' | 'addCard' | 'editBank' | 'addBank' | 'confirmDelete', item?: any) => {
    setModalType(type);
    setSelectedItem(item);
    setIsModalOpen(true);
    
    if (type === 'editCard' && item) {
      setCardForm({
        number: item.fullNumber,
        expiry: item.expiry,
        cvv: item.cvv,
        name: item.name
      });
    } else if (type === 'editBank' && item) {
      setBankForm({
        bankName: item.bankName,
        accountNumber: item.accountNumber || '',
        routingNumber: item.routingNumber || '',
        accountHolderName: item.accountHolderName
      });
    } else if (type === 'addCard') {
      setCardForm({ number: '', expiry: '', cvv: '', name: '' });
    } else if (type === 'addBank') {
      setBankForm({ bankName: '', accountNumber: '', routingNumber: '', accountHolderName: '' });
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalType(null);
    setSelectedItem(null);
  };

  const handleSaveCard = () => {
    if (modalType === 'editCard' && selectedItem) {
      // Update existing card
      setPaymentMethods(cards => cards.map(card => 
        card.id === selectedItem.id 
          ? { ...card, ...cardForm, last_four_digits: cardForm.number.slice(-4) }
          : card
      ));
    } else if (modalType === 'addCard') {
      // Add new card
      const newCard = {
        id: Date.now(),
        type: cardForm.number.startsWith('4') ? 'Visa' : 'Mastercard',
        lastFour: cardForm.number.slice(-4),
        expiry: cardForm.expiry,
        fullNumber: cardForm.number,
        cvv: cardForm.cvv,
        name: cardForm.name
      };
      setPaymentMethods(cards => [...cards, newCard]);
    }
    closeModal();
  };

  const handleSaveBank = () => {
    if (modalType === 'editBank' && selectedItem) {
      // Update existing bank account
      setPayoutAccounts(accounts => accounts.map(account => 
        account.id === selectedItem.id 
          ? { ...account, ...bankForm, lastFour: bankForm.accountNumber.slice(-4) }
          : account
      ));
    } else if (modalType === 'addBank') {
      // Add new bank account
      const newAccount = {
        id: Date.now(),
        bankName: bankForm.bankName,
        lastFour: bankForm.accountNumber.slice(-4),
        accountHolderName: bankForm.accountHolderName,
        accountNumber: bankForm.accountNumber,
        routingNumber: bankForm.routingNumber
      };
      setPayoutAccounts(accounts => [...accounts, newAccount]);
    }
    closeModal();
  };

  const handleDeleteItem = () => {
    if (modalType === 'confirmDelete' && selectedItem) {
      if (selectedItem.type === 'card') {
        setPaymentMethods(cards => cards.filter(card => card.id !== selectedItem.id));
      } else if (selectedItem.type === 'bank') {
        setPayoutAccounts(accounts => accounts.filter(account => account.id !== selectedItem.id));
      }
    }
    closeModal();
  };


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-gray-200 shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link 
                to="/dashboard"
                className="flex items-center cursor-pointer"
              >
                <img src="/WeRaise_Logo.png" alt="We Raise" className="w-8 h-8 mr-2" />
                <span className="text-xl font-bold text-gray-900">We Raise</span>
              </Link>
            </div>

            {/* Back Button */}
            <div className="flex items-center space-x-4">
              <Link 
                to="/dashboard" 
                className="flex items-center text-gray-600 hover:text-gray-900 font-medium"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Error/Success Messages */}
      {error && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <AlertCircle className="w-5 h-5 text-red-400 mr-3 mt-0.5" />
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {success && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <CheckCircle className="w-5 h-5 text-green-400 mr-3 mt-0.5" />
              <p className="text-green-800">{success}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar (Left Column - 25%) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-24">
              {/* Profile Header */}
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-blue-600 font-bold text-2xl">
                    {user?.first_name?.[0]}{user?.last_name?.[0]}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  {user?.display_name || `${user?.first_name} ${user?.last_name}`}
                </h2>
                <p className="text-gray-600">{user?.email}</p>
              </div>

              {/* Navigation Links */}
              <nav className="space-y-2">
                {[
                  { id: 'account', label: 'Account & Security', icon: Shield },
                  { id: 'activity', label: 'Activity & History', icon: Activity },
                  { id: 'notifications', label: 'Notifications & Alerts', icon: Bell },
                  { id: 'payments', label: 'Payment Methods', icon: CreditCard }
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`w-full flex items-center px-4 py-3 rounded-lg text-left transition-colors duration-200 ${
                        activeTab === tab.id
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-5 h-5 mr-3" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content Area (Right Column - 75%) */}
          <div className="lg:col-span-3">
            {/* Account & Security Tab */}
            {activeTab === 'account' && (
              <div className="space-y-6">
                {/* Personal Information Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900">Personal Information</h3>
                    {!isEditingProfile ? (
                      <button
                        onClick={startEditingProfile}
                        className="text-gray-600 hover:text-gray-900 font-medium px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 flex items-center text-sm"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </button>
                    ) : (
                      <div className="flex space-x-2">
                        <button
                          onClick={cancelEditingProfile}
                          className="text-gray-600 hover:text-gray-900 font-medium px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveProfile}
                          disabled={isSavingProfile}
                          className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm"
                        >
                          {isSavingProfile ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-2" />
                              Save
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editValues.firstName}
                          onChange={(e) => handleProfileInputChange('firstName', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-900">{user?.first_name || 'Not provided'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editValues.lastName}
                          onChange={(e) => handleProfileInputChange('lastName', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-900">{user?.last_name || 'Not provided'}</p>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Public Display Name</label>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editValues.displayName}
                          onChange={(e) => handleProfileInputChange('displayName', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-900">{user?.display_name || 'Not provided'}</p>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                      {isEditingProfile ? (
                        <textarea
                          value={editValues.bio}
                          onChange={(e) => handleProfileInputChange('bio', e.target.value)}
                        rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                      ) : (
                        <p className="text-gray-900 whitespace-pre-wrap">{user?.bio || 'No bio provided'}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Security Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Security</h3>
                  
                  {/* Change Password */}
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-gray-900">Change Password</h4>
                      {!isEditingPassword ? (
                        <button
                          onClick={startEditingPassword}
                          disabled={!user?.hasPassword}
                          className={`font-medium px-3 py-2 rounded-lg transition-colors duration-200 flex items-center text-sm ${
                            user?.hasPassword 
                              ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100' 
                              : 'text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          {user?.hasPassword ? 'Change Password' : 'Set Password'}
                        </button>
                      ) : (
                        <div className="flex space-x-2">
                          <button
                            onClick={cancelEditingPassword}
                            className="text-gray-600 hover:text-gray-900 font-medium px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 text-sm"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={savePassword}
                            disabled={isChangingPassword || (user?.hasPassword && !passwordData.currentPassword) || !passwordData.newPassword || !passwordData.confirmPassword}
                            className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm"
                          >
                            {isChangingPassword ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Changing...
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4 mr-2" />
                                Save Password
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {isEditingPassword ? (
                    <div className="space-y-4">
                      {user?.hasPassword && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                                value={passwordData.currentPassword}
                                onChange={(e) => handlePasswordInputChange('currentPassword', e.target.value)}
                              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                              value={passwordData.newPassword}
                              onChange={(e) => handlePasswordInputChange('newPassword', e.target.value)}
                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                              value={passwordData.confirmPassword}
                              onChange={(e) => handlePasswordInputChange('confirmPassword', e.target.value)}
                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    ) : (
                      <p className="text-gray-600">
                        {user?.hasPassword 
                          ? 'Click "Change Password" to update your password' 
                          : 'Click "Set Password" to add a password to your Google account'
                        }
                      </p>
                    )}
                  </div>

                  {/* Two-Factor Authentication */}
                  <div className="mb-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">Two-Factor Authentication</h4>
                        <p className="text-gray-600">Add an extra layer of security to your account</p>
                      </div>
                      <button
                        onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                          twoFactorEnabled ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                            twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Connected Accounts */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Connected Accounts</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-red-600 font-semibold text-sm">G</span>
                          </div>
                          <span className="font-medium text-gray-900">Google</span>
                        </div>
                        <div className={`flex items-center ${user?.isGoogleConnected ? 'text-green-600' : 'text-gray-500'}`}>
                          {user?.isGoogleConnected ? (
                            <>
                              <CheckCircle className="w-4 h-4 mr-1" />
                              <span className="text-sm">Connected</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-4 h-4 mr-1" />
                              <span className="text-sm">Not Connected</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* Activity & History Tab */}
            {activeTab === 'activity' && (
              <div className="space-y-6">
                {/* Backer History Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Backer History</h3>
                  
                  <div className="mb-6">
                    <div className="text-3xl font-bold text-gray-900 mb-2">${Math.round(userActivity?.backerActivity?.totalPledged || 0).toLocaleString()}</div>
                    <p className="text-gray-600">Total Pledged</p>
                  </div>

                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Recently Backed Campaigns</h4>
                    {isLoadingActivity ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg animate-pulse">
                            <div className="flex-1">
                              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                            </div>
                            <div className="h-6 bg-gray-200 rounded-full w-20"></div>
                          </div>
                        ))}
                      </div>
                    ) : recentlyBackedCampaigns.length > 0 ? (
                      <div className="space-y-3">
                        {recentlyBackedCampaigns.map((campaign) => (
                          <div key={campaign.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <h5 className="font-semibold text-gray-900">{campaign.title}</h5>
                              <p className="text-sm text-gray-600">{campaign.date} • ${Math.round(campaign.amount).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                campaign.status === 'In Progress' 
                                  ? 'bg-yellow-100 text-yellow-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {campaign.status === 'In Progress' ? (
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                ) : (
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                )}
                                {campaign.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>No campaigns backed yet</p>
                        <Link to="/explore" className="text-blue-600 hover:text-blue-700 mt-2 inline-block">
                          Explore campaigns
                        </Link>
                      </div>
                    )}
                  </div>

                  <button className="bg-gray-200 text-black font-semibold px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-200">
                    View Full Pledges
                  </button>
                </div>

                {/* Creator History Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Creator History</h3>
                  
                  <div className="mb-6">
                    <div className="text-3xl font-bold text-gray-900 mb-2">${Math.round(userActivity?.creatorActivity?.totalRaised || 0).toLocaleString()}</div>
                    <p className="text-gray-600">Total Raised</p>
                  </div>

                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Launched Campaigns</h4>
                    {isLoadingActivity ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg animate-pulse">
                            <div className="flex-1">
                              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                            </div>
                            <div className="h-6 bg-gray-200 rounded-full w-20"></div>
                          </div>
                        ))}
                      </div>
                    ) : launchedCampaigns.length > 0 ? (
                      <div className="space-y-3">
                        {launchedCampaigns.map((campaign) => (
                          <div key={campaign.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <h5 className="font-semibold text-gray-900">{campaign.title}</h5>
                              <p className="text-sm text-gray-600">${Math.round(campaign.raised).toLocaleString()} of ${Math.round(campaign.goal).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center space-x-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                campaign.status === 'Active' 
                                  ? 'bg-green-100 text-green-800'
                                  : campaign.status === 'Completed'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {campaign.status}
                              </span>
                              <Link 
                                to={`/campaign/${campaign.id}`}
                                className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                View
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>No campaigns launched yet</p>
                        <Link to="/new-campaign" className="text-blue-600 hover:text-blue-700 mt-2 inline-block">
                          Create your first campaign
                        </Link>
                      </div>
                    )}
                  </div>

                  <Link 
                    to="/new-campaign" 
                    className="bg-gray-200 text-black font-semibold px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors duration-200 inline-flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Launch New Campaign
                  </Link>
                </div>
              </div>
            )}

            {/* Notifications & Alerts Tab */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Notification Preferences</h3>
                  
                  <div className="space-y-6">
                    {/* Campaign Updates */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900">Campaign Updates</h4>
                        <p className="text-sm text-gray-600">Get notified when campaigns you've backed have updates</p>
                      </div>
                      <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600 transition-colors duration-200">
                        <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6 transition-transform duration-200" />
                      </button>
                    </div>

                    {/* Platform News */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900">Platform News</h4>
                        <p className="text-sm text-gray-600">Receive updates about new features and platform announcements</p>
                      </div>
                      <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600 transition-colors duration-200">
                        <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6 transition-transform duration-200" />
                      </button>
                    </div>

                    {/* New Comments */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900">New Comments on My Projects</h4>
                        <p className="text-sm text-gray-600">Get notified when someone comments on your campaigns</p>
                      </div>
                      <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors duration-200">
                        <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1 transition-transform duration-200" />
                      </button>
                    </div>

                    {/* Email Frequency */}
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Email Frequency</h4>
                      <div className="space-y-2">
                        {['Immediate', 'Daily Digest', 'Weekly'].map((frequency) => (
                          <label key={frequency} className="flex items-center">
                            <input
                              type="radio"
                              name="emailFrequency"
                              value={frequency}
                              defaultChecked={frequency === 'Daily Digest'}
                              className="mr-3 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-gray-700">{frequency}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Methods Tab */}
            {activeTab === 'payments' && (
              <div className="space-y-6">
                {/* Funding Methods Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Funding Methods</h3>
                  
                  <div className="space-y-4 mb-6">
                    {isLoadingPaymentMethods ? (
                      <div className="animate-pulse">
                        <div className="h-20 bg-gray-200 rounded-lg mb-4"></div>
                        <div className="h-20 bg-gray-200 rounded-lg"></div>
                      </div>
                    ) : paymentMethods.length === 0 ? (
                      <div className="text-center py-8">
                        <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 mb-4">No payment methods added yet</p>
                        <button className="bg-gray-200 text-black font-semibold px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-200 cursor-pointer">
                          Add Payment Method
                        </button>
                      </div>
                    ) : (
                      paymentMethods.map((card) => (
                        <div key={card.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <div className="w-10 h-6 bg-blue-600 rounded flex items-center justify-center mr-3">
                              <span className="text-white text-xs font-bold">{card.provider}</span>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">**** **** **** {card.last_four_digits}</p>
                              <p className="text-sm text-gray-600">{card.cardholder_name}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {card.is_default && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                Default
                              </span>
                            )}
                            <button 
                              onClick={() => openModal('editCard', card)}
                              className="text-gray-600 hover:text-gray-900 p-1 cursor-pointer"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => openModal('confirmDelete', { ...card, type: 'card' })}
                              className="text-red-600 hover:text-red-800 p-1 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <button 
                    onClick={() => openModal('addCard')}
                    className="bg-gray-200 text-black font-semibold px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-200 flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Card
                  </button>
                </div>

                {/* Payout Methods Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Payout Methods</h3>
                  
                  <div className="space-y-4 mb-6">
                    {isLoadingPaymentMethods ? (
                      <div className="animate-pulse">
                        <div className="h-20 bg-gray-200 rounded-lg"></div>
                      </div>
                    ) : payoutAccounts.length === 0 ? (
                      <div className="text-center py-8">
                        <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 mb-4">No payout accounts added yet</p>
                        <button className="bg-gray-200 text-black font-semibold px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-200 cursor-pointer">
                          Add Payout Account
                        </button>
                      </div>
                    ) : (
                      payoutAccounts.map((account) => (
                        <div key={account.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                              <CreditCard className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{account.bank_name}</p>
                              <p className="text-sm text-gray-600">**** **** **** {account.account_number_encrypted}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {account.is_default && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                Default
                              </span>
                            )}
                            <button 
                              onClick={() => openModal('editBank', account)}
                              className="text-gray-600 hover:text-gray-900 p-1 cursor-pointer"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => openModal('confirmDelete', { ...account, type: 'bank' })}
                              className="text-red-600 hover:text-red-800 p-1 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <button 
                    onClick={() => openModal('addBank')}
                    className="bg-gray-200 text-black font-semibold px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-200 flex items-center mb-6"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Account
                  </button>

                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">Tax & Identity Verification</h4>
                    <p className="text-sm text-blue-700 mb-3">
                      Complete your tax and identity verification to receive payouts from your campaigns.
                    </p>
                    <button className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200">
                      Complete Verification
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <Modal 
        isOpen={isModalOpen && modalType === 'editCard'} 
        onClose={closeModal} 
        title="Edit Payment Card"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Card Number</label>
            <input
              type="text"
              value={cardForm.number}
              onChange={(e) => setCardForm(prev => ({ ...prev, number: e.target.value }))}
              placeholder="1234 5678 9012 3456"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Expiry</label>
              <input
                type="text"
                value={cardForm.expiry}
                onChange={(e) => setCardForm(prev => ({ ...prev, expiry: e.target.value }))}
                placeholder="MM/YY"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">CVV</label>
              <input
                type="text"
                value={cardForm.cvv}
                onChange={(e) => setCardForm(prev => ({ ...prev, cvv: e.target.value }))}
                placeholder="123"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cardholder Name</label>
            <input
              type="text"
              value={cardForm.name}
              onChange={(e) => setCardForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="John Doe"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex space-x-3 pt-4">
            <button
              onClick={handleSaveCard}
              className="flex-1 bg-gray-200 text-black font-semibold px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-200"
            >
              Save Changes
            </button>
            <button
              onClick={closeModal}
              className="flex-1 bg-white border border-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isModalOpen && modalType === 'addCard'} 
        onClose={closeModal} 
        title="Add New Payment Card"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Card Number</label>
            <input
              type="text"
              value={cardForm.number}
              onChange={(e) => setCardForm(prev => ({ ...prev, number: e.target.value }))}
              placeholder="1234 5678 9012 3456"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Expiry</label>
              <input
                type="text"
                value={cardForm.expiry}
                onChange={(e) => setCardForm(prev => ({ ...prev, expiry: e.target.value }))}
                placeholder="MM/YY"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">CVV</label>
              <input
                type="text"
                value={cardForm.cvv}
                onChange={(e) => setCardForm(prev => ({ ...prev, cvv: e.target.value }))}
                placeholder="123"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cardholder Name</label>
            <input
              type="text"
              value={cardForm.name}
              onChange={(e) => setCardForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="John Doe"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex space-x-3 pt-4">
            <button
              onClick={handleSaveCard}
              className="flex-1 bg-gray-200 text-black font-semibold px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-200"
            >
              Add Card
            </button>
            <button
              onClick={closeModal}
              className="flex-1 bg-white border border-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isModalOpen && modalType === 'editBank'} 
        onClose={closeModal} 
        title="Edit Bank Account"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
            <input
              type="text"
              value={bankForm.bankName}
              onChange={(e) => setBankForm(prev => ({ ...prev, bankName: e.target.value }))}
              placeholder="Bank of America"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
            <input
              type="text"
              value={bankForm.accountNumber}
              onChange={(e) => setBankForm(prev => ({ ...prev, accountNumber: e.target.value }))}
              placeholder="1234567890"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Routing Number</label>
            <input
              type="text"
              value={bankForm.routingNumber}
              onChange={(e) => setBankForm(prev => ({ ...prev, routingNumber: e.target.value }))}
              placeholder="123456789"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Account Holder Name</label>
            <input
              type="text"
              value={bankForm.accountHolderName}
              onChange={(e) => setBankForm(prev => ({ ...prev, accountHolderName: e.target.value }))}
              placeholder="John Doe"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex space-x-3 pt-4">
            <button
              onClick={handleSaveBank}
              className="flex-1 bg-gray-200 text-black font-semibold px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-200"
            >
              Save Changes
            </button>
            <button
              onClick={closeModal}
              className="flex-1 bg-white border border-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isModalOpen && modalType === 'addBank'} 
        onClose={closeModal} 
        title="Add New Bank Account"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
            <input
              type="text"
              value={bankForm.bankName}
              onChange={(e) => setBankForm(prev => ({ ...prev, bankName: e.target.value }))}
              placeholder="Bank of America"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
            <input
              type="text"
              value={bankForm.accountNumber}
              onChange={(e) => setBankForm(prev => ({ ...prev, accountNumber: e.target.value }))}
              placeholder="1234567890"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Routing Number</label>
            <input
              type="text"
              value={bankForm.routingNumber}
              onChange={(e) => setBankForm(prev => ({ ...prev, routingNumber: e.target.value }))}
              placeholder="123456789"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Account Holder Name</label>
            <input
              type="text"
              value={bankForm.accountHolderName}
              onChange={(e) => setBankForm(prev => ({ ...prev, accountHolderName: e.target.value }))}
              placeholder="John Doe"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex space-x-3 pt-4">
            <button
              onClick={handleSaveBank}
              className="flex-1 bg-gray-200 text-black font-semibold px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-200"
            >
              Add Account
            </button>
            <button
              onClick={closeModal}
              className="flex-1 bg-white border border-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isModalOpen && modalType === 'confirmDelete'} 
        onClose={closeModal} 
        title="Confirm Deletion"
      >
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">
                Delete {selectedItem?.type === 'card' ? 'Payment Card' : 'Bank Account'}?
              </h4>
              <p className="text-sm text-gray-600">
                This action cannot be undone. Are you sure you want to remove this {selectedItem?.type === 'card' ? 'payment method' : 'bank account'}?
              </p>
            </div>
          </div>
          <div className="flex space-x-3 pt-4">
            <button
              onClick={handleDeleteItem}
              className="flex-1 bg-red-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200"
            >
              Delete
            </button>
            <button
              onClick={closeModal}
              className="flex-1 bg-white border border-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProfilePage;
