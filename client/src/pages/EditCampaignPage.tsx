import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ArrowRight, 
  Plus, 
  Trash2, 
  Upload,
  Save,
  CheckCircle
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const EditCampaignPage: React.FC = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  
  const [formData, setFormData] = useState({
    // Step 1: Campaign Basics
    projectTitle: '',
    tagline: '',
    category: '',
    location: '',
    duration: '',
    
    // Step 2: Goal and Funding
    fundingGoal: '',
    pledgeMinimum: '',
    fundingType: 'all-or-nothing',
    
    // Step 3: Story and Media
    mainImage: null as File | null,
    mainImageUrl: '',
    campaignStory: '',
    
    // Step 4: Rewards and Tiers
    rewardTiers: [
      {
        id: 1,
        amount: '',
        title: '',
        description: '',
        deliveryDate: '',
        quantityLimit: ''
      }
    ]
  });

  const categories = [
    'Technology',
    'Education',
    'Community',
    'Environment',
    'Arts & Culture',
    'Wellness',
    'Food & Beverage',
    'Fashion & Design'
  ];

  // Load campaign data
  useEffect(() => {
    const loadCampaign = async () => {
      if (!campaignId) return;
      
      try {
        setIsLoading(true);
        setError('');
        
        const response = await api.campaigns.getById(campaignId);
        const campaign = response.data.campaign;
        
        // Check if user owns this campaign
        if (campaign.creator_id !== user?.id) {
          setError('You can only edit your own campaigns');
          return;
        }
        
        // Check if campaign can be edited (only draft campaigns)
        if (campaign.status !== 'draft') {
          setError('Only draft campaigns can be edited');
          return;
        }
        
        // Populate form with existing data
        setFormData({
          projectTitle: campaign.title || '',
          tagline: campaign.tagline || '',
          category: campaign.category_name || '',
          location: campaign.location || '',
          duration: campaign.duration_days?.toString() || '',
          fundingGoal: campaign.funding_goal?.toString() || '',
          pledgeMinimum: campaign.minimum_pledge?.toString() || '',
          fundingType: campaign.funding_type || 'all-or-nothing',
          mainImage: null,
          mainImageUrl: campaign.main_image_url || '',
          campaignStory: campaign.description || '',
          rewardTiers: campaign.reward_tiers?.map((tier: any, index: number) => ({
            id: index + 1,
            amount: tier.amount?.toString() || '',
            title: tier.title || '',
            description: tier.description || '',
            deliveryDate: tier.estimated_delivery_date || '',
            quantityLimit: tier.quantity_limit?.toString() || ''
          })) || [{
            id: 1,
            amount: '',
            title: '',
            description: '',
            deliveryDate: '',
            quantityLimit: ''
          }]
        });
        
      } catch (err: any) {
        setError(err.message || 'Failed to load campaign');
        console.error('Error loading campaign:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadCampaign();
  }, [campaignId, user?.id]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleRewardTierChange = (index: number, field: string, value: string) => {
    const updatedTiers = [...formData.rewardTiers];
    updatedTiers[index] = {
      ...updatedTiers[index],
      [field]: value
    };
    setFormData(prev => ({
      ...prev,
      rewardTiers: updatedTiers
    }));
  };

  const addRewardTier = () => {
    const newTier = {
      id: formData.rewardTiers.length + 1,
      amount: '',
      title: '',
      description: '',
      deliveryDate: '',
      quantityLimit: ''
    };
    setFormData(prev => ({
      ...prev,
      rewardTiers: [...prev.rewardTiers, newTier]
    }));
  };

  const removeRewardTier = (index: number) => {
    if (formData.rewardTiers.length > 1) {
      const updatedTiers = formData.rewardTiers.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        rewardTiers: updatedTiers
      }));
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        mainImage: file
      }));
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      setSuccess('');
      
      // Prepare campaign data
      const campaignData = {
        title: formData.projectTitle,
        tagline: formData.tagline,
        category_name: formData.category,
        location: formData.location,
        duration_days: parseInt(formData.duration),
        funding_goal: parseFloat(formData.fundingGoal),
        minimum_pledge: parseFloat(formData.pledgeMinimum),
        funding_type: formData.fundingType,
        description: formData.campaignStory,
        reward_tiers: formData.rewardTiers.map(tier => ({
          amount: parseFloat(tier.amount),
          title: tier.title,
          description: tier.description,
          estimated_delivery_date: tier.deliveryDate,
          quantity_limit: parseInt(tier.quantityLimit) || null
        }))
      };
      
      await api.campaigns.update(campaignId!, campaignData);
      
      setSuccess('Campaign updated successfully!');
      
      // Redirect to campaign detail page after a short delay
      setTimeout(() => {
        navigate(`/campaign/${campaignId}`);
      }, 2000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to update campaign');
      console.error('Error updating campaign:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/4 mb-8"></div>
            <div className="h-96 bg-gray-300 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link 
              to="/dashboard" 
              className="inline-flex items-center px-6 py-3 bg-gray-200 text-black font-semibold rounded-lg hover:bg-gray-300 transition-colors duration-200 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-gray-200 shadow-sm z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link 
              to="/dashboard" 
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors duration-200 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Dashboard
            </Link>
            
            <div className="flex items-center space-x-4">
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="bg-gray-200 text-black font-semibold px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-200 flex items-center disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  currentStep >= step 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'border-gray-300 text-gray-400'
                }`}>
                  {currentStep > step ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-semibold">{step}</span>
                  )}
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${
                    currentStep >= step ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {step === 1 && 'Basics'}
                    {step === 2 && 'Funding'}
                    {step === 3 && 'Story'}
                    {step === 4 && 'Rewards'}
                  </p>
                </div>
                {step < 4 && (
                  <div className={`w-16 h-0.5 mx-4 ${
                    currentStep > step ? 'bg-blue-600' : 'bg-gray-300'
                  }`}></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800">{success}</p>
          </div>
        )}
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Step Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {/* Step 1: Campaign Basics */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Campaign Basics</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Title *
                </label>
                <input
                  type="text"
                  value={formData.projectTitle}
                  onChange={(e) => handleInputChange('projectTitle', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your project title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tagline *
                </label>
                <input
                  type="text"
                  value={formData.tagline}
                  onChange={(e) => handleInputChange('tagline', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="A short description of your project"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="City, Country"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Campaign Duration (Days) *
                </label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => handleInputChange('duration', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="30"
                  min="1"
                  max="90"
                />
              </div>
            </div>
          )}

          {/* Step 2: Goal and Funding */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Goal and Funding</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Funding Goal *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                  <input
                    type="number"
                    value={formData.fundingGoal}
                    onChange={(e) => handleInputChange('fundingGoal', e.target.value)}
                    className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="10000"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Pledge Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                  <input
                    type="number"
                    value={formData.pledgeMinimum}
                    onChange={(e) => handleInputChange('pledgeMinimum', e.target.value)}
                    className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="100"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Funding Type *
                </label>
                <select
                  value={formData.fundingType}
                  onChange={(e) => handleInputChange('fundingType', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all-or-nothing">All or Nothing</option>
                  <option value="flexible">Flexible Funding</option>
                </select>
              </div>

              {/* Fee Disclosure */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Platform Fees</h4>
                <p className="text-sm text-blue-700">
                  WeRaise charges a 5% platform fee on successfully funded campaigns. 
                  Payment processing fees (2.9% + ₹30 per transaction) are additional.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Story and Media */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Story and Media</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Main Image
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {formData.mainImageUrl && !formData.mainImage && (
                    <div className="mb-4">
                      <img 
                        src={formData.mainImageUrl} 
                        alt="Current campaign image"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label 
                    htmlFor="image-upload"
                    className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {formData.mainImage ? 'Change Image' : 'Upload Image'}
                  </label>
                  <p className="text-sm text-gray-500 mt-2">
                    Recommended size: 1200x800px
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Campaign Story *
                </label>
                <textarea
                  value={formData.campaignStory}
                  onChange={(e) => handleInputChange('campaignStory', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={8}
                  placeholder="Tell your story, explain your project, and why people should support it..."
                />
              </div>
            </div>
          )}

          {/* Step 4: Rewards and Tiers */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Rewards and Tiers</h2>
                <button
                  onClick={addRewardTier}
                  className="bg-gray-200 text-black font-semibold px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-200 flex items-center cursor-pointer"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Reward
                </button>
              </div>

              <div className="space-y-4">
                {formData.rewardTiers.map((tier, index) => (
                  <div key={tier.id} className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Reward Tier {index + 1}</h3>
                      {formData.rewardTiers.length > 1 && (
                        <button
                          onClick={() => removeRewardTier(index)}
                          className="text-red-600 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Amount *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                          <input
                            type="number"
                            value={tier.amount}
                            onChange={(e) => handleRewardTierChange(index, 'amount', e.target.value)}
                            className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="500"
                            min="1"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Quantity Limit
                        </label>
                        <input
                          type="number"
                          value={tier.quantityLimit}
                          onChange={(e) => handleRewardTierChange(index, 'quantityLimit', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="100"
                          min="1"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Title *
                      </label>
                      <input
                        type="text"
                        value={tier.title}
                        onChange={(e) => handleRewardTierChange(index, 'title', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Early Bird Special"
                      />
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description *
                      </label>
                      <textarea
                        value={tier.description}
                        onChange={(e) => handleRewardTierChange(index, 'description', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={3}
                        placeholder="Describe what backers will receive..."
                      />
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Estimated Delivery Date
                      </label>
                      <input
                        type="date"
                        value={tier.deliveryDate}
                        onChange={(e) => handleRewardTierChange(index, 'deliveryDate', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className="flex items-center px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </button>

            <div className="flex items-center space-x-4">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-gray-200 text-black font-semibold px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors duration-200 flex items-center disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>

              {currentStep < 4 && (
                <button
                  onClick={nextStep}
                  className="flex items-center px-6 py-3 bg-gray-200 text-black font-semibold rounded-lg hover:bg-gray-300 transition-colors duration-200 cursor-pointer"
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EditCampaignPage;
