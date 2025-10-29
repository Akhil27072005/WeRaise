import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Grid, 
  BookOpen, 
  Users, 
  Settings, 
  Leaf, 
  Palette, 
  Heart,
  ArrowLeft
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

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
  creator_name: string;
}

interface Category {
  id: string;
  name: string;
  description: string;
  icon_name: string;
}

const ExplorePage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Icon mapping for categories
  const categoryIcons: { [key: string]: any } = {
    'Technology': Settings,
    'Education': BookOpen,
    'Community': Users,
    'Environment': Leaf,
    'Arts & Culture': Palette,
    'Wellness': Heart,
    'Food & Beverage': Heart,
    'Fashion & Design': Heart
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch categories
        const categoriesResponse = await api.campaigns.getCategories();
        setCategories(categoriesResponse.data.categories);
        
        // Fetch campaigns
        const campaignsResponse = await api.campaigns.getAll({ 
          limit: 50,
          status: 'active'
        });
        setCampaigns(campaignsResponse.data.campaigns);
      } catch (err) {
        setError('Failed to load campaigns');
        console.error('Error fetching data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredCampaigns = selectedCategory === 'All' 
    ? campaigns 
    : campaigns.filter(campaign => campaign.category_name === selectedCategory);

  const getCategoryIcon = (categoryName: string) => {
    return categoryIcons[categoryName] || Grid;
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Education': 'text-purple-600',
      'Community': 'text-yellow-600',
      'Technology': 'text-blue-600',
      'Environment': 'text-green-600',
      'Arts & Culture': 'text-pink-600',
      'Wellness': 'text-red-600',
      'Food & Beverage': 'text-orange-600',
      'Fashion & Design': 'text-purple-600'
    };
    return colors[category] || 'text-gray-600';
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-gray-200 shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <img src="/WeRaise_Logo.png" alt="We Raise" className="w-8 h-8 mr-2" />
              <span className="text-xl font-bold text-gray-900">We Raise</span>
            </div>

            {/* Navigation */}
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <Link 
                  to="/dashboard" 
                  className="flex items-center text-gray-600 hover:text-gray-900 font-medium cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Link>
              ) : (
                <Link 
                  to="/" 
                  className="flex items-center text-gray-600 hover:text-gray-900 font-medium cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Support Our Community</h1>
          <p className="text-xl text-gray-600 mb-8">
            Discover and fund amazing projects that make a difference in our global community.
          </p>
          <Link 
            to={isAuthenticated ? "/new-campaign" : "/signup"}
            className="bg-gray-200 text-black font-semibold px-8 py-3 rounded-lg hover:bg-gray-300 transition-colors duration-200 cursor-pointer"
          >
            {isAuthenticated ? "Start Your Campaign" : "Sign Up to Start"}
          </Link>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {/* All Categories Button */}
          <button
            onClick={() => setSelectedCategory('All')}
            className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer ${
              selectedCategory === 'All'
                ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Grid className="w-4 h-4 mr-2" />
            All
          </button>
          
          {/* Dynamic Category Buttons */}
          {categories.map((category) => {
            const Icon = getCategoryIcon(category.name);
            const isActive = selectedCategory === category.name;
            
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.name)}
                className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {category.name}
              </button>
            );
          })}
        </div>

        {/* Campaigns Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-pulse">
                <div className="h-48 bg-gray-300"></div>
                <div className="p-6">
                  <div className="h-4 bg-gray-300 rounded mb-2"></div>
                  <div className="h-3 bg-gray-300 rounded mb-4"></div>
                  <div className="h-3 bg-gray-300 rounded mb-2"></div>
                  <div className="h-3 bg-gray-300 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-gray-500">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredCampaigns.map((campaign) => {
              const Icon = getCategoryIcon(campaign.category_name);
              const categoryColor = getCategoryColor(campaign.category_name);
              const progressPercentage = (campaign.total_raised / campaign.funding_goal) * 100;
              
              return (
                <Link 
                  key={campaign.id} 
                  to={`/campaign/${campaign.id}`}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-200 cursor-pointer"
                >
                  {/* Campaign Image */}
                  <div className="h-48 bg-gray-200 relative overflow-hidden">
                    {(() => {
                      // Get the first image from campaign media, fallback to main_image_url
                      const campaignImage = campaign.campaign_media?.find(media => media.media_type === 'image')?.url || campaign.main_image_url;
                      
                      return campaignImage ? (
                        <img 
                          src={campaignImage} 
                          alt={campaign.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                          <span className="text-white text-lg font-semibold">{campaign.category_name}</span>
                        </div>
                      );
                    })()}
                  </div>
                  
                  <div className="p-6">
                    {/* Campaign Title */}
                    <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">{campaign.title}</h3>
                    
                    {/* Category */}
                    <div className="flex items-center mb-3">
                      <Icon className={`w-4 h-4 mr-2 ${categoryColor}`} />
                      <span className={`text-sm font-medium ${categoryColor}`}>{campaign.category_name}</span>
                    </div>
                    
                    {/* Description */}
                    <p className="text-gray-600 mb-4 text-sm leading-relaxed line-clamp-2">
                      {campaign.tagline}
                    </p>
                    
                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>${Math.round(campaign.total_raised).toLocaleString()} raised</span>
                        <span>${Math.round(campaign.funding_goal).toLocaleString()} goal</span>
                      </div>
                    </div>
                    
                    {/* Days Left and Backers */}
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-600">
                        <div>{campaign.days_remaining} days left</div>
                        <div>{campaign.backer_count} backers</div>
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        by {campaign.creator_name}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* No Results Message */}
        {!isLoading && !error && filteredCampaigns.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Grid className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No campaigns found</h3>
            <p className="text-gray-600 mb-4">
              Try selecting a different category to see more campaigns.
            </p>
            <Link 
              to={isAuthenticated ? "/new-campaign" : "/signup"}
              className="bg-gray-200 text-black font-semibold px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors duration-200 cursor-pointer"
            >
              {isAuthenticated ? "Create a Campaign" : "Sign Up to Create"}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
};

export default ExplorePage;
