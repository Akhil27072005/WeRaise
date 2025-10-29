import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  Users, 
  Calendar, 
  Edit, 
  MessageSquare, 
  DollarSign,
  BarChart3,
  CheckCircle,
  LogOut,
  Package,
  ExternalLink,
  Clock,
  AlertCircle,
  X,
  Search,
  Download,
  Mail,
  Phone,
  MapPin,
  User,
  ChevronDown,
  ChevronUp,
  Target,
  Crown
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { CampaignFundingChart } from '../components/CampaignFundingChart';

interface Campaign {
  id: string;
  title: string;
  tagline: string;
  main_image_url: string;
  campaign_media?: Array<{
    id: string;
    media_type: string;
    url: string;
    alt_text: string;
    display_order: number;
  }>;
  total_raised: number;
  funding_goal: number;
  backer_count: number;
  days_remaining: number;
  category_name: string;
  status: string;
  created_at: string;
}

interface Pledge {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  campaign_title: string;
  campaign_id: string;
}

interface Backer {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  campaign_id: string;
  backer?: {
    id: string;
    display_name?: string;
    email?: string;
    avatar_url?: string;
  };
  reward_tier?: {
    id: string;
    title: string;
    amount: number;
  };
  campaign?: {
    id: string;
    title: string;
    status: string;
    creator_id: string;
  };
  shipping_address?: {
    name: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

const Dashboard: React.FC = () => {
  const { user, isCreator, logout, refreshUserData } = useAuth();
  const [view, setView] = useState<'backer' | 'creator'>('backer');
  const [isBecomingCreator, setIsBecomingCreator] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [recommendedCampaigns, setRecommendedCampaigns] = useState<Campaign[]>([]);
  const [fundingAnalytics, setFundingAnalytics] = useState<{
    data: Array<{ [key: string]: string | number }>;
    campaigns: Array<{ id: string; title: string; color: string }>;
  } | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Fetch funding analytics
  const fetchFundingAnalytics = async () => {
    if (!isCreator) return;
    
    try {
      setIsLoadingAnalytics(true);
      const response = await api.campaigns.getFundingAnalytics(90);
      setFundingAnalytics(response.data);
    } catch (err) {
      console.error('Error fetching funding analytics:', err);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  // Manage Backers Modal state
  const [isManageBackersOpen, setIsManageBackersOpen] = useState(false);
  const [backers, setBackers] = useState<Backer[]>([]);
  const [availableCampaigns, setAvailableCampaigns] = useState<Campaign[]>([]);
  const [backerStatistics, setBackerStatistics] = useState<{
    total_raised: number;
    confirmed_pledges: number;
    pending_pledges: number;
    pending_fulfillment: number;
    total_pledges: number;
  } | null>(null);
  const [isLoadingBackers, setIsLoadingBackers] = useState(false);
  const [backerSearchTerm, setBackerSearchTerm] = useState('');
  const [backerStatusFilter, setBackerStatusFilter] = useState('all');
  const [backerCampaignFilter, setBackerCampaignFilter] = useState('all');
  const [backerSortBy, setBackerSortBy] = useState('date');
  const [showBackerDetails, setShowBackerDetails] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        
        if (view === 'creator' && isCreator) {
          // Fetch creator's campaigns
          const campaignsResponse = await api.campaigns.getMyCampaigns();
          setCampaigns(campaignsResponse.data.campaigns);
          
          // Fetch funding analytics
          await fetchFundingAnalytics();
        } else {
          // Fetch user's pledges
          const pledgesResponse = await api.pledges.getHistory({ limit: 10 });
          setPledges(pledgesResponse.data.pledges);
        }
        
        // Fetch recommended campaigns for all users
        const recommendedResponse = await api.campaigns.getAll({ 
          limit: 6,
          status: 'active',
          sort: 'most_funded'
        });
        setRecommendedCampaigns(recommendedResponse.data.campaigns);
      } catch (err) {
        setError('Failed to load dashboard data');
        console.error('Error fetching dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [view, isCreator]);

  // Manage Backers functions
  const openManageBackers = async () => {
    setIsManageBackersOpen(true);
    await fetchAllBackers();
  };

  const fetchAllBackers = async () => {
    try {
      setIsLoadingBackers(true);
      const response = await api.pledges.getAllForCreator({ limit: 100 });
      setBackers(response.data.pledges || []);
      setAvailableCampaigns(response.data.campaigns || []);
      setBackerStatistics(response.data.statistics || null);
    } catch (err) {
      console.error('Error fetching all backers:', err);
      setError('Failed to load backers');
    } finally {
      setIsLoadingBackers(false);
    }
  };

  const closeManageBackers = () => {
    setIsManageBackersOpen(false);
    setBackers([]);
    setAvailableCampaigns([]);
    setBackerStatistics(null);
    setBackerSearchTerm('');
    setBackerStatusFilter('all');
    setBackerCampaignFilter('all');
    setBackerSortBy('date');
    setShowBackerDetails(null);
  };

  const filteredBackers = backers.filter((backer: Backer) => {
    const matchesSearch = backer.backer?.display_name?.toLowerCase().includes(backerSearchTerm.toLowerCase()) ||
                         backer.backer?.email?.toLowerCase().includes(backerSearchTerm.toLowerCase()) ||
                         backer.campaign?.title?.toLowerCase().includes(backerSearchTerm.toLowerCase());
    const matchesStatus = backerStatusFilter === 'all' || backer.status === backerStatusFilter;
    const matchesCampaign = backerCampaignFilter === 'all' || backer.campaign_id === backerCampaignFilter;
    return matchesSearch && matchesStatus && matchesCampaign;
  });

  const sortedBackers = [...filteredBackers].sort((a: Backer, b: Backer) => {
    switch (backerSortBy) {
      case 'amount':
        return b.amount - a.amount;
      case 'name':
        return (a.backer?.display_name || '').localeCompare(b.backer?.display_name || '');
      case 'campaign':
        return (a.campaign?.title || '').localeCompare(b.campaign?.title || '');
      case 'date':
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  const becomeCreator = async () => {
    try {
      setIsBecomingCreator(true);
      await api.user.becomeCreator();
      await refreshUserData();
      setView('creator');
    } catch (err) {
      console.error('Error becoming creator:', err);
      setError('Failed to become a creator. Please try again.');
    } finally {
      setIsBecomingCreator(false);
    }
  };

  const exportBackersData = () => {
    const csvData = sortedBackers.map((backer: Backer) => ({
      'Backer Name': backer.backer?.display_name || 'N/A',
      'Email': backer.backer?.email || 'N/A',
      'Campaign': backer.campaign?.title || 'N/A',
      'Campaign Status': backer.campaign?.status || 'N/A',
      'Amount': backer.amount,
      'Status': backer.status,
      'Pledge Date': new Date(backer.created_at).toLocaleDateString(),
      'Reward Tier': backer.reward_tier?.title || 'No Reward'
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all_backers_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
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

            {/* Centered View Switcher */}
            <div className="flex-1 flex justify-center">
              {isCreator && (
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setView('backer')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                      view === 'backer'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Backer View
                  </button>
                  <button
                    onClick={() => setView('creator')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                      view === 'creator'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Creator View
                  </button>
                </div>
              )}
            </div>

            {/* Right Side - Profile & Actions */}
            <div className="flex items-center space-x-3">
              {/* Profile Link */}
              <Link 
                to="/profile"
                className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
                title="View Profile"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-sm">
                    {user?.first_name?.[0]}{user?.last_name?.[0]}
                  </span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">{user?.display_name || user?.first_name}</p>
                  <p className="text-xs text-gray-500">{isCreator ? 'Creator' : 'Backer'}</p>
                </div>
              </Link>
              
              {/* Become Creator Button - Only show for non-creators */}
              {!isCreator && (
                <button
                  onClick={becomeCreator}
                  disabled={isBecomingCreator}
                  className="flex items-center px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Become a Creator"
                >
                  {isBecomingCreator ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Becoming Creator...
                    </>
                  ) : (
                    <>
                      <Crown className="w-4 h-4 mr-2" />
                      Become Creator
                    </>
                  )}
                </button>
              )}
              
              {/* Logout Button */}
              <button
                onClick={logout}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200 cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {view === 'backer' ? (
            <>
              <BackerView pledges={pledges} isLoading={isLoading} error={error} />
              
              {/* Recommended Campaigns - Only shown in backer view */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-900">Recommended for You</h2>
                  <Link 
                    to="/explore" 
                    className="bg-gray-200 text-black font-semibold px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-200 text-sm cursor-pointer"
                  >
                    Explore More
                  </Link>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {recommendedCampaigns.map((campaign) => {
                      const progressPercentage = (campaign.total_raised / campaign.funding_goal) * 100;
                      
                      // Get the first image from campaign media, fallback to main_image_url
                      const campaignImage = campaign.campaign_media?.find(media => media.media_type === 'image')?.url || campaign.main_image_url;
                      
                      return (
                        <Link 
                          key={campaign.id} 
                          to={`/campaign/${campaign.id}`}
                          className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-200 cursor-pointer"
                        >
                          <div className="h-32 bg-gray-200 relative overflow-hidden">
                            {campaignImage ? (
                              <img 
                                src={campaignImage} 
                                alt={campaign.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const fallback = target.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div 
                              className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center"
                              style={{ display: campaignImage ? 'none' : 'flex' }}
                            >
                              <span className="text-white text-lg font-semibold">{campaign.category_name}</span>
                            </div>
                          </div>
                          <div className="p-4">
                            <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">{campaign.title}</h3>
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{campaign.tagline}</p>
                            
                            <div className="mb-3">
                              <div className="flex justify-between text-sm text-gray-600 mb-1">
                                <span>Progress</span>
                                <span>{Math.round(progressPercentage)}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                                  style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                                ></div>
                              </div>
                            </div>

                            <div className="flex justify-between items-center">
                              <div>
                                <p className="text-lg font-bold text-gray-900">${Math.round(campaign.total_raised).toLocaleString()}</p>
                                <p className="text-xs text-gray-600">of ${Math.round(campaign.funding_goal).toLocaleString()}</p>
                              </div>
                              <div className="text-sm text-gray-600">
                                {campaign.days_remaining} days left
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <CreatorView 
              campaigns={campaigns} 
              isLoading={isLoading} 
              error={error}
              onManageBackers={openManageBackers}
              fundingAnalytics={fundingAnalytics}
              isLoadingAnalytics={isLoadingAnalytics}
            />
          )}
        </div>
      </main>

      {/* Manage Backers Modal */}
      {isManageBackersOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Manage All Backers</h3>
                <p className="text-gray-600 mt-1">View and manage backers across all your campaigns</p>
              </div>
              <button
                onClick={closeManageBackers}
                className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Controls */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search backers by name or email..."
                      value={backerSearchTerm}
                      onChange={(e) => setBackerSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <select
                    value={backerCampaignFilter}
                    onChange={(e) => setBackerCampaignFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Campaigns</option>
                    {availableCampaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.title} ({campaign.status})
                      </option>
                    ))}
                  </select>
                  <select
                    value={backerStatusFilter}
                    onChange={(e) => setBackerStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Status</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="pending">Pending</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="refunded">Refunded</option>
                  </select>
                  <select
                    value={backerSortBy}
                    onChange={(e) => setBackerSortBy(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="date">Sort by Date</option>
                    <option value="amount">Sort by Amount</option>
                    <option value="name">Sort by Name</option>
                    <option value="campaign">Sort by Campaign</option>
                  </select>
                  <button
                    onClick={exportBackersData}
                    className="px-4 py-2 bg-gray-200 text-black font-semibold rounded-lg hover:bg-gray-300 transition-colors duration-200 flex items-center"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </button>
                </div>
              </div>

              {/* Backers List */}
              {isLoadingBackers ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg animate-pulse">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                        <div>
                          <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-24"></div>
                        </div>
                      </div>
                      <div className="h-6 bg-gray-200 rounded w-20"></div>
                    </div>
                  ))}
                </div>
              ) : sortedBackers.length > 0 ? (
                <div className="space-y-4">
                  {sortedBackers.map((backer: Backer) => (
                    <div key={backer.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {backer.backer?.display_name || 'Anonymous Backer'}
                            </h4>
                            <p className="text-sm text-gray-600">{backer.backer?.email}</p>
                            <p className="text-xs text-gray-500">
                              Pledged on {new Date(backer.created_at).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-blue-600 font-medium">
                              {backer.campaign?.title}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">${Math.round(backer.amount).toLocaleString()}</p>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              backer.status === 'confirmed' 
                                ? 'bg-green-100 text-green-800' 
                                : backer.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : backer.status === 'cancelled'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {backer.status === 'confirmed' ? (
                                <CheckCircle className="w-3 h-3 mr-1" />
                              ) : backer.status === 'pending' ? (
                                <Clock className="w-3 h-3 mr-1" />
                              ) : (
                                <AlertCircle className="w-3 h-3 mr-1" />
                              )}
                              {backer.status}
                            </span>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setShowBackerDetails(showBackerDetails === backer.id ? null : backer.id)}
                              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors duration-200"
                            >
                              {showBackerDetails === backer.id ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                            <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors duration-200">
                              <Mail className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {showBackerDetails === backer.id && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h5 className="font-semibold text-gray-900 mb-2">Pledge Details</h5>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Amount:</span>
                                  <span className="font-medium">${Math.round(backer.amount).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Campaign:</span>
                                  <span className="font-medium">{backer.campaign?.title || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Campaign Status:</span>
                                  <span className="font-medium capitalize">{backer.campaign?.status || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Reward Tier:</span>
                                  <span className="font-medium">{backer.reward_tier?.title || 'No Reward'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Pledge Date:</span>
                                  <span className="font-medium">{new Date(backer.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Status:</span>
                                  <span className="font-medium capitalize">{backer.status}</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <h5 className="font-semibold text-gray-900 mb-2">Contact Information</h5>
                              <div className="space-y-2 text-sm">
                                <div className="flex items-center text-gray-600">
                                  <Mail className="w-4 h-4 mr-2" />
                                  <span>{backer.backer?.email}</span>
                                </div>
                                {backer.shipping_address && (
                                  <div className="flex items-start text-gray-600">
                                    <MapPin className="w-4 h-4 mr-2 mt-0.5" />
                                    <div>
                                      <p>{backer.shipping_address.name}</p>
                                      <p>{backer.shipping_address.street}</p>
                                      <p>{backer.shipping_address.city}, {backer.shipping_address.state} {backer.shipping_address.zip}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 flex space-x-2">
                            <button className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center">
                              <Mail className="w-4 h-4 mr-2" />
                              Send Message
                            </button>
                            <button className="px-4 py-2 bg-gray-200 text-black font-semibold rounded-lg hover:bg-gray-300 transition-colors duration-200 flex items-center">
                              <Phone className="w-4 h-4 mr-2" />
                              Contact
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Backers Found</h3>
                  <p className="text-gray-600">
                    {backerSearchTerm || backerStatusFilter !== 'all' || backerCampaignFilter !== 'all'
                      ? 'No backers match your current filters.' 
                      : 'You don\'t have any backers across your campaigns yet.'}
                  </p>
                </div>
              )}

              {/* Summary Stats */}
              {sortedBackers.length > 0 && (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <Users className="w-8 h-8 text-blue-600 mr-3" />
                      <div>
                        <p className="text-sm text-blue-600">Filtered Backers</p>
                        <p className="text-2xl font-bold text-blue-900">{sortedBackers.length}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <DollarSign className="w-8 h-8 text-green-600 mr-3" />
                      <div>
                        <p className="text-sm text-green-600">Total Raised (Confirmed)</p>
                        <p className="text-2xl font-bold text-green-900">
                          ${backerStatistics ? Math.round(backerStatistics.total_raised).toLocaleString() : '0'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <Target className="w-8 h-8 text-purple-600 mr-3" />
                      <div>
                        <p className="text-sm text-purple-600">Confirmed Pledges</p>
                        <p className="text-2xl font-bold text-purple-900">
                          {backerStatistics ? backerStatistics.confirmed_pledges : 0}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <AlertCircle className="w-8 h-8 text-yellow-600 mr-3" />
                      <div>
                        <p className="text-sm text-yellow-600">Pending Payment</p>
                        <p className="text-2xl font-bold text-yellow-900">
                          {backerStatistics ? backerStatistics.pending_pledges : 0}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <Clock className="w-8 h-8 text-orange-600 mr-3" />
                      <div>
                        <p className="text-sm text-orange-600">Pending Fulfillment</p>
                        <p className="text-2xl font-bold text-orange-900">
                          {backerStatistics ? backerStatistics.pending_fulfillment : 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Backer View Component
const BackerView: React.FC<{ pledges: Pledge[], isLoading: boolean, error: string }> = ({ pledges, isLoading, error }) => {
  const totalPledged = pledges.reduce((sum, pledge) => sum + pledge.amount, 0);
  const activePledges = pledges.filter(pledge => pledge.status === 'confirmed').length;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 animate-pulse">
              <div className="h-4 bg-gray-300 rounded mb-2"></div>
              <div className="h-8 bg-gray-300 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Pledged</p>
              <p className="text-3xl font-bold text-gray-900">${Math.round(totalPledged).toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Campaigns Backed</p>
              <p className="text-3xl font-bold text-gray-900">{pledges.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Pledges</p>
              <p className="text-3xl font-bold text-gray-900">{activePledges}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* My Pledges Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">My Pledges</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {pledges.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No pledges found</p>
              <Link 
                to="/explore" 
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Explore campaigns to make your first pledge
              </Link>
            </div>
          ) : (
            pledges.map((pledge) => (
              <div key={pledge.id} className="p-6 hover:bg-gray-50 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Link to={`/campaign/${pledge.campaign_id}`} className="text-lg font-semibold text-gray-900 hover:text-blue-600 cursor-pointer">
                        {pledge.campaign_title}
                      </Link>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        pledge.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                        pledge.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {pledge.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">Pledged ${Math.round(pledge.amount).toLocaleString()} on {new Date(pledge.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <Link 
                      to={`/campaign/${pledge.campaign_id}`} 
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center cursor-pointer"
                    >
                      View Campaign <ExternalLink className="w-4 h-4 ml-1" />
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};

// Creator View Component
const CreatorView: React.FC<{ 
  campaigns: Campaign[], 
  isLoading: boolean, 
  error: string,
  onManageBackers: () => void,
  fundingAnalytics: {
    data: Array<{ [key: string]: string | number }>;
    campaigns: Array<{ id: string; title: string; color: string }>;
  } | null,
  isLoadingAnalytics: boolean
}> = ({ campaigns, isLoading, error, onManageBackers, fundingAnalytics, isLoadingAnalytics }) => {
  const totalRaised = campaigns.reduce((sum, campaign) => sum + campaign.total_raised, 0);
  const activeCampaigns = campaigns.filter(campaign => campaign.status === 'active').length;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 animate-pulse">
              <div className="h-4 bg-gray-300 rounded mb-2"></div>
              <div className="h-8 bg-gray-300 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{error}</p>
      </div>
    );
  }

  // Empty state for creators with no campaigns
  if (campaigns.length === 0) {
    return (
      <div className="space-y-8">
        {/* Top Metrics - Show zeros for empty state */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Raised</p>
                <p className="text-3xl font-bold text-gray-900">$0</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Campaigns</p>
                <p className="text-3xl font-bold text-gray-900">0</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Backers</p>
                <p className="text-3xl font-bold text-gray-900">0</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Empty State */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <BarChart3 className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No campaigns created yet</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Ready to launch your first project? Create a campaign and start bringing your ideas to life.
            </p>
            <Link 
              to="/new-campaign" 
              className="inline-flex items-center px-6 py-3 bg-gray-200 text-black font-semibold rounded-lg hover:bg-gray-300 transition-colors duration-200 cursor-pointer"
            >
              Create Your First Campaign
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Raised</p>
              <p className="text-3xl font-bold text-gray-900">${Math.round(totalRaised).toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Campaigns</p>
              <p className="text-3xl font-bold text-gray-900">{activeCampaigns}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Backers</p>
              <p className="text-3xl font-bold text-gray-900">
                {campaigns.reduce((sum, campaign) => sum + campaign.backer_count, 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Performance */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Campaign Performance</h2>
        </div>
        <div className="p-6">
          <div className="space-y-8">
            {/* Chart Area */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Funding Progress</h3>
              {isLoadingAnalytics ? (
                <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-2"></div>
                    <p className="text-gray-500">Loading funding data...</p>
                  </div>
                </div>
              ) : fundingAnalytics && fundingAnalytics.data.length > 0 ? (
                <CampaignFundingChart 
                  data={fundingAnalytics.data as Array<{ date: string; [key: string]: string | number }>} 
                  campaigns={fundingAnalytics.campaigns} 
                />
              ) : (
                <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No funding data available</p>
                    <p className="text-sm text-gray-400">Chart will appear when campaigns receive pledges</p>
                  </div>
                </div>
              )}
            </div>

            {/* Campaign Overview */}
            <div id="campaign-overview">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Campaign Overview</h3>
              <div className="space-y-6">
                {campaigns.length > 0 ? (
                  campaigns.slice(0, 2).map((campaign) => {
                    const progressPercentage = (campaign.total_raised / campaign.funding_goal) * 100;
                    const daysRemaining = campaign.days_remaining;
                    const timeProgressPercentage = Math.max(0, Math.min(100, ((30 - daysRemaining) / 30) * 100)); // Assuming 30-day campaigns
                    
                    return (
                      <div key={campaign.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-900">{campaign.title}</h4>
                          <div className="flex items-center space-x-2">
                            <Link
                              to={`/edit-campaign/${campaign.id}`}
                              className="inline-flex items-center px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 cursor-pointer"
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Edit
                            </Link>
                            <Link
                              to={`/campaign/${campaign.id}`}
                              className="inline-flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200 cursor-pointer"
                            >
                              View
                            </Link>
                          </div>
                        </div>
                        
                        <div className="mb-4">
                          <div className="flex justify-between text-sm text-gray-600 mb-2">
                            <span>Funding Progress</span>
                            <span>{Math.round(progressPercentage)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                              className="bg-green-500 h-3 rounded-full transition-all duration-300" 
                              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                            ></div>
                          </div>
                          <p className="text-sm text-gray-600 mt-2">
                            ${Math.round(campaign.total_raised).toLocaleString()} of ${Math.round(campaign.funding_goal).toLocaleString()} goal
                          </p>
                        </div>

                        <div>
                          <div className="flex justify-between text-sm text-gray-600 mb-2">
                            <span>Time Remaining</span>
                            <span>{daysRemaining} days</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                              className="bg-blue-500 h-3 rounded-full transition-all duration-300" 
                              style={{ width: `${timeProgressPercentage}%` }}
                            ></div>
                          </div>
                          <p className="text-sm text-gray-600 mt-2">
                            {daysRemaining} days left in campaign
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>No campaigns to display</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Management */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Campaign Management</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button 
              onClick={onManageBackers}
              className="flex items-center justify-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
            >
              <Users className="w-5 h-5 text-gray-600 mr-3" />
              <span className="font-medium text-gray-900">Manage Backers</span>
            </button>
            
            <button className="flex items-center justify-center p-4 bg-gray-200 text-black rounded-lg hover:bg-gray-300 transition-colors duration-200 font-semibold">
              <MessageSquare className="w-5 h-5 mr-3" />
              <span>Send New Update</span>
            </button>
            
            <button 
              onClick={() => {
                const element = document.getElementById('campaign-overview');
                element?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex items-center justify-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
            >
              <Edit className="w-5 h-5 text-gray-600 mr-3" />
              <span className="font-medium text-gray-900">Edit Campaign Page</span>
            </button>
          </div>
        </div>
      </div>

      {/* Payout Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Payout Summary</h2>
        </div>
        <div className="p-6">
          {totalRaised > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 font-semibold text-gray-900">Description</th>
                      <th className="text-right py-3 font-semibold text-gray-900">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="py-3 text-gray-900">Gross Funds</td>
                      <td className="py-3 text-right font-semibold text-gray-900">${Math.round(totalRaised).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="py-3 text-gray-900">Platform Fees (5%)</td>
                      <td className="py-3 text-right text-red-600">-${Math.round(totalRaised * 0.05).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="py-3 text-gray-900">Payment Processing (3%)</td>
                      <td className="py-3 text-right text-red-600">-${Math.round(totalRaised * 0.03).toLocaleString()}</td>
                    </tr>
                    <tr className="border-t-2 border-gray-300">
                      <td className="py-3 font-semibold text-gray-900">Net Payout</td>
                      <td className="py-3 text-right font-bold text-green-600">${Math.round(totalRaised * 0.92).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center">
                  <Calendar className="w-5 h-5 text-blue-600 mr-2" />
                  <span className="font-medium text-blue-900">
                    Next Payout Date: {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No funds raised yet</h3>
              <p className="text-gray-600 mb-4">
                Once your campaigns start receiving pledges, you'll see payout information here.
              </p>
              <Link 
                to="/new-campaign" 
                className="inline-flex items-center px-4 py-2 bg-gray-200 text-black font-semibold rounded-lg hover:bg-gray-300 transition-colors duration-200"
              >
                Create Campaign
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
