import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ArrowRight, 
  Plus, 
  Trash2, 
  Save,
  CheckCircle,
  Image as ImageIcon
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const NewCampaignPage: React.FC = () => {
  const navigate = useNavigate();
  const { isCreator, isAuthenticated } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
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

  // Check if user is authenticated and is a creator
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    if (!isCreator) {
      navigate('/dashboard');
      return;
    }
  }, [isAuthenticated, isCreator, navigate]);

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

  const steps = [
    { id: 1, title: 'Basics', description: 'Campaign basics' },
    { id: 2, title: 'Goal', description: 'Funding goal' },
    { id: 3, title: 'Story', description: 'Your story' },
    { id: 4, title: 'Rewards', description: 'Reward tiers' }
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (file: File) => {
    setFormData(prev => ({ ...prev, mainImage: file }));
    
    // Create preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const addRewardTier = () => {
    const newTier = {
      id: Date.now(),
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

  const removeRewardTier = (id: number) => {
    setFormData(prev => ({
      ...prev,
      rewardTiers: prev.rewardTiers.filter(tier => tier.id !== id)
    }));
  };

  const updateRewardTier = (id: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      rewardTiers: prev.rewardTiers.map(tier =>
        tier.id === id ? { ...tier, [field]: value } : tier
      )
    }));
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

  const submitCampaign = async () => {
    // Validate form data before submission
    if (!formData.projectTitle.trim()) {
      alert('Please enter a project title');
      return;
    }
    if (!formData.tagline.trim()) {
      alert('Please enter a tagline');
      return;
    }
    if (!formData.category) {
      alert('Please select a category');
      return;
    }
    if (!formData.duration || isNaN(parseInt(formData.duration))) {
      alert('Please enter a valid campaign duration (number of days)');
      return;
    }
    if (!formData.fundingGoal) {
      alert('Please enter funding goal');
      return;
    }
    if (!formData.campaignStory.trim()) {
      alert('Please enter campaign story');
      return;
    }
    
    // Validate reward tiers
    const validTiers = formData.rewardTiers.filter(tier => 
      tier.title.trim() && tier.description.trim() && tier.amount
    );
    
    if (validTiers.length === 0) {
      alert('Please fill out at least one reward tier completely (amount, title, and description)');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Create FormData for multipart upload
      const formDataToSend = new FormData();
      
      // Add campaign data
      formDataToSend.append('title', formData.projectTitle);
      formDataToSend.append('tagline', formData.tagline);
      formDataToSend.append('description', formData.campaignStory);
      formDataToSend.append('story', formData.campaignStory);
      formDataToSend.append('categoryId', formData.category);
      formDataToSend.append('fundingGoal', formData.fundingGoal);
      formDataToSend.append('minimumPledge', formData.pledgeMinimum || '1');
      formDataToSend.append('fundingType', formData.fundingType);
      formDataToSend.append('durationDays', formData.duration.toString());
      formDataToSend.append('location', formData.location || '');
      
      // Add image file if present
      if (formData.mainImage) {
        formDataToSend.append('campaignImage', formData.mainImage);
      }
      
      // Add reward tiers (filter out empty ones)
      const validRewardTiers = formData.rewardTiers.filter(tier => 
        tier.title.trim() && tier.description.trim() && tier.amount
      );
      
      if (validRewardTiers.length === 0) {
        alert('Please add at least one valid reward tier');
        setIsSubmitting(false);
        return;
      }
      
      formDataToSend.append('rewardTiers', JSON.stringify(validRewardTiers.map(tier => ({
        amount: parseFloat(tier.amount) || 0,
        title: tier.title.trim(),
        description: tier.description.trim(),
        estimatedDeliveryDate: tier.deliveryDate || null,
        quantityLimit: tier.quantityLimit ? parseInt(tier.quantityLimit) : null,
        isLimited: !!tier.quantityLimit
      }))));
      
      // Make API call with FormData
      const response = await api.campaigns.create(formDataToSend);
      
      if (response.data) {
        alert('Campaign created and published successfully!');
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      alert(`Error creating campaign: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveDraft = () => {
    // In a real app, this would save to the backend
    console.log('Draft saved:', formData);
    alert('Draft saved successfully!');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-gray-200 shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <img src="/WeRaise_Logo.png" alt="We Raise" className="w-8 h-8 mr-2" />
              <span className="text-xl font-bold text-gray-900">We Raise</span>
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

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Campaign</h1>
          <p className="text-gray-600">Launch your project and start raising funds from your community</p>
        </div>

        {/* Progress Tracker */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  currentStep >= step.id
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-300 text-gray-400'
                }`}>
                  {currentStep > step.id ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <span className="font-semibold">{step.id}</span>
                  )}
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${
                    currentStep >= step.id ? 'text-blue-600' : 'text-gray-400'
                  }`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-500">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 mx-4 ${
                    currentStep > step.id ? 'bg-blue-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {/* Step 1: Campaign Basics */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Campaign Basics</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Title *
                </label>
                <input
                  type="text"
                  value={formData.projectTitle}
                  onChange={(e) => handleInputChange('projectTitle', e.target.value)}
                  placeholder="Enter your project title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Short Tagline
                </label>
                <input
                  type="text"
                  value={formData.tagline}
                  onChange={(e) => handleInputChange('tagline', e.target.value)}
                  placeholder="A brief description of your project"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="City, Country"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Campaign Duration (Days)
                  </label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => handleInputChange('duration', e.target.value)}
                    placeholder="30"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Goal and Funding */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Goal and Funding</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Funding Goal *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={formData.fundingGoal}
                    onChange={(e) => handleInputChange('fundingGoal', e.target.value)}
                    placeholder="10000"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Pledge Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={formData.pledgeMinimum}
                    onChange={(e) => handleInputChange('pledgeMinimum', e.target.value)}
                    placeholder="1"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  Funding Type *
                </label>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="fundingType"
                      value="all-or-nothing"
                      checked={formData.fundingType === 'all-or-nothing'}
                      onChange={(e) => handleInputChange('fundingType', e.target.value)}
                      className="mr-3 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-medium text-gray-900">All-or-Nothing</span>
                      <p className="text-sm text-gray-600">You only receive funds if you reach your goal</p>
                    </div>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="fundingType"
                      value="keep-it-all"
                      checked={formData.fundingType === 'keep-it-all'}
                      onChange={(e) => handleInputChange('fundingType', e.target.value)}
                      className="mr-3 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Keep-it-All</span>
                      <p className="text-sm text-gray-600">You keep all funds raised, regardless of goal</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Fee Disclosure */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Platform Fees</h4>
                <p className="text-sm text-blue-700">
                  WeRaise charges a 5% platform fee on successfully funded campaigns. 
                  Payment processing fees (2.9% + $30 per transaction) are additional.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Story and Media */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Story and Media</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Main Campaign Image *
                </label>
                
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Campaign preview"
                      className="w-full h-64 object-cover rounded-lg border border-gray-300"
                    />
                    <button
                      onClick={() => {
                        setFormData(prev => ({ ...prev, mainImage: null }));
                        setImagePreview(null);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <p className="text-sm text-green-600 mt-2">
                      Selected: {formData.mainImage?.name}
                    </p>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors duration-200">
                    <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-900 mb-2">Upload your main campaign image</p>
                    <p className="text-sm text-gray-600 mb-4">
                      Drag and drop your image here, or click to browse
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 cursor-pointer"
                    >
                      Choose Image
                    </label>
                    <p className="text-xs text-gray-500 mt-2">
                      Supported formats: JPG, PNG, GIF, WebP (Max 5MB)
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Campaign Story *
                </label>
                <textarea
                  value={formData.campaignStory}
                  onChange={(e) => handleInputChange('campaignStory', e.target.value)}
                  placeholder="Tell your story. What inspired this project? What problem does it solve? How will you use the funds?"
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  required
                />
                <p className="text-sm text-gray-500 mt-2">
                  This is your main campaign description. Be detailed and compelling.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Rewards and Tiers */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Reward Tiers</h2>
              
              <div className="space-y-6">
                {formData.rewardTiers.map((tier, index) => (
                  <div key={tier.id} className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Reward Tier {index + 1}</h3>
                      {formData.rewardTiers.length > 1 && (
                        <button
                          onClick={() => removeRewardTier(tier.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Pledge Amount *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                          <input
                            type="number"
                            value={tier.amount}
                            onChange={(e) => updateRewardTier(tier.id, 'amount', e.target.value)}
                            placeholder="25"
                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Estimated Delivery Date
                        </label>
                        <input
                          type="date"
                          value={tier.deliveryDate}
                          onChange={(e) => updateRewardTier(tier.id, 'deliveryDate', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reward Title *
                      </label>
                      <input
                        type="text"
                        value={tier.title}
                        onChange={(e) => updateRewardTier(tier.id, 'title', e.target.value)}
                        placeholder="Early Bird Special"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reward Description *
                      </label>
                      <textarea
                        value={tier.description}
                        onChange={(e) => updateRewardTier(tier.id, 'description', e.target.value)}
                        placeholder="Describe what backers will receive"
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        required
                      />
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Quantity Limit (Optional)
                      </label>
                      <input
                        type="number"
                        value={tier.quantityLimit}
                        onChange={(e) => updateRewardTier(tier.id, 'quantityLimit', e.target.value)}
                        placeholder="100"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={addRewardTier}
                className="bg-gray-200 text-black font-semibold px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-200 flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Tier
              </button>
            </div>
          )}

          {/* Form Navigation */}
          <div className="flex items-center justify-between pt-8 border-t border-gray-200 mt-8">
            <div className="flex space-x-4">
              {currentStep > 1 && (
                <button
                  onClick={prevStep}
                  className="bg-white border border-gray-300 text-gray-700 font-semibold px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </button>
              )}
              
              <button
                onClick={saveDraft}
                className="bg-gray-200 text-black font-semibold px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors duration-200 flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Draft
              </button>
            </div>

            <div>
              {currentStep < 4 ? (
                <button
                  onClick={nextStep}
                  className="bg-gray-200 text-black font-semibold px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors duration-200 flex items-center"
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              ) : (
                <button
                  onClick={submitCampaign}
                  disabled={isSubmitting}
                  className={`font-semibold px-6 py-3 rounded-lg transition-colors duration-200 flex items-center ${
                    isSubmitting 
                      ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating Campaign...
                    </>
                  ) : (
                    <>
                      Publish Campaign
                      <CheckCircle className="w-4 h-4 ml-2" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NewCampaignPage;
