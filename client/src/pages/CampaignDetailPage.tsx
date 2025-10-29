import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Heart, 
  Share2, 
  Users, 
  Clock
} from 'lucide-react';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface Campaign {
  id: string;
  title: string;
  tagline: string;
  description: string;
  main_image_url: string;
  total_raised: number;
  funding_goal: number;
  backer_count: number;
  days_remaining: number;
  category_name: string;
  creator_name: string;
  creator_id: string;
  status: string;
  created_at: string;
  end_date: string;
  reward_tiers?: RewardTier[];
}

interface RewardTier {
  id: string;
  title: string;
  description: string;
  amount: number;
  quantity_limit: number;
  quantity_claimed: number;
  estimated_delivery_date: string;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
}

const CampaignDetailPage: React.FC = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { isAuthenticated, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'story' | 'updates' | 'comments'>('story');
  const [selectedReward, setSelectedReward] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [rewardTiers, setRewardTiers] = useState<RewardTier[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [error, setError] = useState<string>('');
  
  // PayPal integration state
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string>('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [currentPledgeId, setCurrentPledgeId] = useState<string | null>(null);

  useEffect(() => {
    const fetchCampaignDetails = async () => {
      if (!campaignId) return;
      
      try {
        setIsLoading(true);
        setError('');
        
        // Fetch campaign details
        const campaignResponse = await api.campaigns.getById(campaignId);
        const campaignData = campaignResponse.data.campaign;
        setCampaign(campaignData);
        
        // Use reward tiers from the campaign response
        if (campaignData.reward_tiers) {
          setRewardTiers(campaignData.reward_tiers);
        }
      } catch (err) {
        setError('Failed to load campaign details');
        console.error('Error fetching campaign:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaignDetails();
  }, [campaignId]);

  // Fetch comments when comments tab is active
  useEffect(() => {
    const fetchComments = async () => {
      if (!campaignId || activeTab !== 'comments') return;
      
      try {
        setIsLoadingComments(true);
        const response = await api.campaigns.getComments(campaignId);
        setComments(response.data.comments || []);
      } catch (err) {
        console.error('Error fetching comments:', err);
        setComments([]);
      } finally {
        setIsLoadingComments(false);
      }
    };

    fetchComments();
  }, [campaignId, activeTab]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignId || !newComment.trim() || !isAuthenticated) return;

    try {
      setIsPostingComment(true);
      const response = await api.campaigns.postComment(campaignId, newComment.trim());
      
      // Add the new comment to the list
      setComments(prev => [...prev, response.data.comment]);
      setNewComment('');
    } catch (err) {
      console.error('Error posting comment:', err);
      setError('Failed to post comment');
    } finally {
      setIsPostingComment(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // PayPal payment handlers
  const createPayPalOrder = async (_data: any, _actions: any) => {
    if (!campaignId || !selectedReward || !isAuthenticated) {
      throw new Error('Missing required information for payment');
    }

    try {
      setIsProcessingPayment(true);
      setPaymentError('');
      
      const selectedTier = rewardTiers.find(tier => tier.id === selectedReward);
      if (!selectedTier) {
        throw new Error('Selected reward tier not found');
      }

      const response = await api.pledges.createPayPalOrder({
        campaignId,
        amount: selectedTier.amount,
        rewardTierId: selectedReward
      });

      console.log('PayPal create order response:', response);
      console.log('Response data:', response.data);
      console.log('Order ID:', response.data.orderID);
      console.log('Approval URL:', response.data.approvalUrl);
      console.log('Pledge ID:', response.data.pledgeId);

      // Store the pledge ID from response body
      setCurrentPledgeId(response.data.pledgeId);

      // PayPal SDK expects only the orderID
      return response.data.orderID;
    } catch (error: any) {
      console.error('Error creating PayPal order:', error);
      // Extract more detailed error message
      let errorMessage = 'Failed to create payment order';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.details) {
        errorMessage = `Validation Error: ${JSON.stringify(error.response.data.details)}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      setPaymentError(errorMessage);
      throw error;
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const onPayPalApprove = async (data: any, _actions: any) => {
    try {
      setIsProcessingPayment(true);
      setPaymentError('');
      
      if (!currentPledgeId) {
        throw new Error('Pledge ID not found. Please try again.');
      }
      
      const response = await api.pledges.capturePayPalOrder(data.orderID, currentPledgeId);
      
      if (response.data.message === 'Payment captured successfully') {
        setPaymentSuccess(true);
        // Refresh campaign data to show updated funding
        const campaignResponse = await api.campaigns.getById(campaignId!);
        setCampaign(campaignResponse.data.campaign);
        // Clear the pledge ID
        setCurrentPledgeId(null);
      } else {
        throw new Error('Payment capture failed');
      }
    } catch (error: any) {
      console.error('Error capturing PayPal payment:', error);
      // Extract more detailed error message
      let errorMessage = 'Payment failed';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      setPaymentError(errorMessage);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const onPayPalError = async (err: any) => {
    console.error('PayPal error:', err);
    setPaymentError('Payment was cancelled or failed');
    setIsProcessingPayment(false);
    
    // Clean up the pending pledge if it exists
    if (currentPledgeId) {
      try {
        await api.pledges.cancelPayPalOrder(currentPledgeId);
        console.log('Error pledge cleaned up successfully');
      } catch (error) {
        console.error('Failed to clean up error pledge:', error);
      } finally {
        setCurrentPledgeId(null);
      }
    }
  };

  const onPayPalCancel = async (data: any) => {
    console.log('PayPal payment cancelled:', data);
    setPaymentError('Payment was cancelled');
    setIsProcessingPayment(false);
    
    // Clean up the pending pledge if it exists
    if (currentPledgeId) {
      try {
        await api.pledges.cancelPayPalOrder(currentPledgeId);
        console.log('Cancelled pledge cleaned up successfully');
      } catch (error) {
        console.error('Failed to clean up cancelled pledge:', error);
      } finally {
        setCurrentPledgeId(null);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="h-96 bg-gray-300 rounded-xl mb-6"></div>
                <div className="h-4 bg-gray-300 rounded mb-2"></div>
                <div className="h-4 bg-gray-300 rounded mb-4"></div>
              </div>
              <div className="lg:col-span-1">
                <div className="h-64 bg-gray-300 rounded-xl"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Campaign Not Found</h1>
            <p className="text-gray-600 mb-6">{error || 'The campaign you\'re looking for doesn\'t exist.'}</p>
            <Link 
              to="/" 
              className="inline-flex items-center px-6 py-3 bg-gray-200 text-black font-semibold rounded-lg hover:bg-gray-300 transition-colors duration-200 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const progressPercentage = Math.min((campaign.total_raised / campaign.funding_goal) * 100, 100);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* PayPal Button Styling */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .paypal-buttons-container {
            width: 100%;
          }
          
          .paypal-buttons-container [data-paypal-button] {
            width: 100% !important;
            border-radius: 8px !important;
          }
          
          .paypal-buttons-container [data-paypal-button] iframe {
            border-radius: 8px !important;
          }
        `
      }} />
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-gray-200 shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link 
              to="/" 
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors duration-200 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Campaigns
            </Link>
            
            <div className="flex items-center space-x-4">
              <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200 cursor-pointer">
                <Heart className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200 cursor-pointer">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Campaign Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Campaign Image */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="h-96 bg-gray-200 relative overflow-hidden">
                {campaign.main_image_url ? (
                  <img 
                    src={campaign.main_image_url} 
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
                  style={{ display: campaign.main_image_url ? 'none' : 'flex' }}
                >
                  <span className="text-white text-lg font-semibold">{campaign.category_name}</span>
                </div>
              </div>
            </div>

            {/* Campaign Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="mb-4">
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                  {campaign.category_name}
                </span>
              </div>
              
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{campaign.title}</h1>
              <p className="text-xl text-gray-600 mb-4">{campaign.tagline}</p>
              
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  Created by {campaign.creator_name}
                </div>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  {campaign.days_remaining} days left
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6">
                  {[
                    { id: 'story', label: 'Story' },
                    { id: 'updates', label: 'Updates' },
                    { id: 'comments', label: 'Comments' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 cursor-pointer ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="p-6">
                {activeTab === 'story' && (
                  <div className="prose max-w-none">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                      {campaign.description}
                    </p>
                  </div>
                )}

                {activeTab === 'updates' && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No updates yet</p>
                  </div>
                )}

                {activeTab === 'comments' && (
                  <div className="space-y-6">
                    {/* Comments List */}
                    {isLoadingComments ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex space-x-4 animate-pulse">
                            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                            <div className="flex-1">
                              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                              <div className="h-3 bg-gray-200 rounded w-1/6 mb-2"></div>
                              <div className="h-4 bg-gray-200 rounded w-full"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : comments.length > 0 ? (
                      comments.map((comment) => (
                        <div key={comment.id} className="flex space-x-4">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            {comment.user.avatar_url ? (
                              <img 
                                src={comment.user.avatar_url} 
                                alt={comment.user.display_name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-gray-600 font-semibold text-sm">
                                {comment.user.display_name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="font-semibold text-gray-900">{comment.user.display_name}</span>
                              <span className="text-sm text-gray-500">{formatDate(comment.created_at)}</span>
                            </div>
                            <p className="text-gray-700 mb-2">{comment.content}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No comments yet. Be the first to comment!</p>
                      </div>
                    )}

                    {/* Comment Form */}
                    <div className="border-t border-gray-200 pt-6">
                      {isAuthenticated ? (
                        <form onSubmit={handlePostComment} className="flex space-x-4">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            {user?.avatar_url ? (
                              <img 
                                src={user.avatar_url} 
                                alt={user.display_name || 'User'}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-gray-600 font-semibold text-sm">
                                {(user?.display_name || user?.first_name || 'U').charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex-1">
                            <textarea
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              placeholder="Add a comment..."
                              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                              rows={3}
                              maxLength={1000}
                              disabled={isPostingComment}
                            />
                            <div className="flex justify-between items-center mt-2">
                              <span className="text-sm text-gray-500">
                                {newComment.length}/1000 characters
                              </span>
                              <button 
                                type="submit"
                                disabled={!newComment.trim() || isPostingComment}
                                className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isPostingComment ? 'Posting...' : 'Post Comment'}
                              </button>
                            </div>
                          </div>
                        </form>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-gray-500 mb-4">Log in to post a comment</p>
                          <Link 
                            to="/login" 
                            className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
                          >
                            Log In
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Pledge Widget */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-24">
              {/* Progress */}
              <div className="mb-6">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Raised</span>
                  <span>{progressPercentage.toFixed(1)}%</span>
                    </div>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                      <div 
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                      ></div>
                    </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span className="font-semibold text-lg">${Math.round(campaign.total_raised).toLocaleString()}</span>
                  <span>of ${Math.round(campaign.funding_goal).toLocaleString()}</span>
                </div>
              </div>

              {/* Backers */}
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Users className="w-5 h-5 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">Backers</span>
                  </div>
                  <span className="font-semibold">{campaign.backer_count}</span>
                </div>
                  </div>

              {/* Days Left */}
              <div className="mb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                    <Clock className="w-5 h-5 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">Days Left</span>
                  </div>
                  <span className="font-semibold">{campaign.days_remaining}</span>
                </div>
              </div>

              {/* Reward Tiers */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose a Reward</h3>
                <div className="space-y-3">
                  {rewardTiers.map((tier) => (
                    <div
                      key={tier.id}
                      onClick={() => setSelectedReward(tier.id)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-colors duration-200 ${
                        selectedReward === tier.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-gray-900">{tier.title}</h4>
                         <span className="font-bold text-lg">${Math.round(tier.amount).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{tier.description}</p>
                      <div className="text-xs text-gray-500">
                        {tier.quantity_claimed} of {tier.quantity_limit} claimed
                      </div>
                    </div>
                  ))}
                  </div>
              </div>

              {/* PayPal Payment Section */}
              {isAuthenticated && selectedReward ? (
                <div className="space-y-4">
                  {/* Payment Status Messages */}
                  {paymentSuccess && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-800 text-sm font-medium">
                        ✅ Payment successful! Thank you for backing this project.
                      </p>
                    </div>
                  )}
                  
                  {paymentError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-800 text-sm font-medium">
                        ❌ {paymentError}
                      </p>
                    </div>
                  )}

                  {/* PayPal Buttons */}
                  <div className="paypal-buttons-container">
                    <PayPalButtons
                      createOrder={createPayPalOrder}
                      onApprove={onPayPalApprove}
                      onError={onPayPalError}
                      onCancel={onPayPalCancel}
                      style={{
                        layout: "vertical",
                        color: "blue",
                        shape: "rect",
                        label: "paypal",
                        height: 45
                      }}
                      disabled={isProcessingPayment}
                      forceReRender={[selectedReward]}
                    />
                  </div>
                  
                  {isProcessingPayment && (
                    <div className="text-center">
                      <div className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-lg">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700 mr-2"></div>
                        Processing payment...
                      </div>
                    </div>
                  )}
                </div>
              ) : !isAuthenticated ? (
                <div className="space-y-4">
                  <button 
                    className="w-full py-3 px-4 rounded-lg font-semibold bg-gray-100 text-gray-400 cursor-not-allowed"
                    disabled
                  >
                    Login to Back This Project
                  </button>
                  <p className="text-xs text-gray-500 text-center">
                    <Link to="/login" className="text-blue-600 hover:text-blue-700 cursor-pointer">
                      Sign in
                    </Link> to back this project
                  </p>
                </div>
              ) : !selectedReward ? (
                <div className="space-y-4">
                  <button 
                    className="w-full py-3 px-4 rounded-lg font-semibold bg-gray-100 text-gray-400 cursor-not-allowed"
                    disabled
                  >
                    Select a Reward to Continue
                  </button>
                  <p className="text-xs text-gray-500 text-center">
                    Please select a reward tier above to proceed with payment
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CampaignDetailPage;