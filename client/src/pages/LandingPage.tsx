import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
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

const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [featuredCampaigns, setFeaturedCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchFeaturedCampaigns = async () => {
      try {
        const response = await api.campaigns.getAll({ 
          limit: 6, 
          sort: 'most_funded' 
        });
        setFeaturedCampaigns(response.data.campaigns);
      } catch (err) {
        setError('Failed to load featured campaigns');
        console.error('Error fetching campaigns:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeaturedCampaigns();
  }, []);
  return (
    <div className="min-h-screen bg-white">
      {/* Header Section */}
      <header className="sticky top-0 bg-white border-b border-gray-200 shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link 
                to={isAuthenticated ? "/dashboard" : "/"}
                className="flex items-center cursor-pointer"
              >
                <img src="/WeRaise_Logo.png" alt="We Raise" className="w-8 h-8 mr-2" />
                <span className="text-xl font-bold text-gray-900">We Raise</span>
              </Link>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex space-x-8">
              <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 font-medium cursor-pointer">How It Works</a>
              <a href="#campaigns" className="text-gray-600 hover:text-gray-900 font-medium cursor-pointer">Explore Projects</a>
              <a href="#about" className="text-gray-600 hover:text-gray-900 font-medium cursor-pointer">About Us</a>
            </nav>

            {/* CTA Buttons */}
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  <Link 
                    to="/dashboard" 
                    className="text-gray-600 hover:text-gray-900 font-medium cursor-pointer"
                  >
                    Dashboard
                  </Link>
                  <Link 
                    to="/new-campaign" 
                    className="bg-gray-200 text-black font-semibold px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-200 cursor-pointer"
                  >
                    Start a Campaign
                  </Link>
                </>
              ) : (
                <>
                  <Link 
                    to="/login" 
                    className="text-gray-600 hover:text-gray-900 font-medium cursor-pointer"
                  >
                    Log In
                  </Link>
                  <Link 
                    to="/signup" 
                    className="bg-gray-200 text-black font-semibold px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-200 cursor-pointer"
                  >
                    Start a Campaign
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Text/CTA */}
            <div>
              <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
                Bring Your Ideas to Life
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Join thousands of creators who have successfully funded their dreams. 
                Launch your campaign today and turn your vision into reality.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link 
                  to="/signup" 
                  className="bg-gray-200 text-black font-semibold px-8 py-4 rounded-lg hover:bg-gray-300 transition-colors duration-200 text-center"
                >
                  Launch Your Project Now
                </Link>
                <button className="bg-white border border-gray-300 text-black font-semibold px-8 py-4 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                  Explore Success Stories
                </button>
              </div>
            </div>

            {/* Right Side - Visual */}
            <div className="relative">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl p-8 shadow-xl">
                <div className="text-center">
                  <div className="w-32 h-32 bg-white rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg">
                    <Heart className="w-16 h-16 text-red-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">$2.5M Raised</h3>
                  <p className="text-gray-600">Across 500+ successful campaigns</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-xl text-gray-600">Get started in just a few simple steps</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-white rounded-xl p-8 shadow-lg">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">Create Your Campaign</h3>
              <p className="text-gray-600 text-center">
                Set your funding goal, tell your story, and create compelling content that resonates with your audience.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-xl p-8 shadow-lg">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-green-600">2</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">Share & Promote</h3>
              <p className="text-gray-600 text-center">
                Spread the word through social media, email, and our platform to reach potential backers worldwide.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-xl p-8 shadow-lg">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-purple-600">3</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">Receive Funding</h3>
              <p className="text-gray-600 text-center">
                Once you reach your goal, receive your funds and start bringing your project to life.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Campaigns Section */}
      <section id="campaigns" className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Featured Campaigns</h2>
            <p className="text-xl text-gray-600">Discover amazing projects that are making a difference</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 animate-pulse">
                  <div className="h-48 bg-gray-300"></div>
                  <div className="p-6">
                    <div className="h-4 bg-gray-300 rounded mb-2"></div>
                    <div className="h-3 bg-gray-300 rounded mb-4"></div>
                    <div className="h-3 bg-gray-300 rounded mb-2"></div>
                    <div className="h-3 bg-gray-300 rounded"></div>
                  </div>
                </div>
              ))
            ) : error ? (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-500">{error}</p>
              </div>
            ) : (
              featuredCampaigns.map((campaign) => {
                // Get the first image from campaign media, fallback to main_image_url
                const campaignImage = campaign.campaign_media?.find(media => media.media_type === 'image')?.url || campaign.main_image_url;
                
                return (
                  <Link 
                    key={campaign.id} 
                    to={`/campaign/${campaign.id}`}
                    className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 hover:shadow-xl transition-shadow duration-200"
                  >
                    <div className="h-48 bg-gray-200 relative overflow-hidden">
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
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-blue-600 font-medium">{campaign.category_name}</span>
                      <span className="text-sm text-gray-500">{campaign.days_remaining} days left</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">{campaign.title}</h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">{campaign.tagline}</p>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Raised</span>
                        <span className="font-semibold">${Math.round(campaign.total_raised).toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${Math.min((campaign.total_raised / campaign.funding_goal) * 100, 100)}%` 
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>{campaign.backer_count} backers</span>
                        <span>${Math.round(campaign.funding_goal).toLocaleString()} goal</span>
                      </div>
                    </div>
                  </div>
                </Link>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Success Stories</h2>
            <p className="text-xl text-gray-600">Hear from creators who made their dreams come true</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Testimonial 1 */}
            <div className="bg-white rounded-xl p-8 shadow-lg">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                  <span className="text-blue-600 font-bold">SJ</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Sarah Johnson</h4>
                  <p className="text-sm text-gray-600">Creator of EcoBottle</p>
                </div>
              </div>
              <p className="text-gray-600 italic">
                "WeRaise helped me turn my environmental vision into reality. The platform made it easy to connect with like-minded backers who believed in my mission."
              </p>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-white rounded-xl p-8 shadow-lg">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                  <span className="text-green-600 font-bold">MR</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Mike Rodriguez</h4>
                  <p className="text-sm text-gray-600">Creator of SmartGarden</p>
                </div>
              </div>
              <p className="text-gray-600 italic">
                "The support from the WeRaise community was incredible. Not only did I reach my funding goal, but I also built lasting relationships with my backers."
              </p>
            </div>

            {/* Testimonial 3 */}
            <div className="bg-white rounded-xl p-8 shadow-lg">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                  <span className="text-purple-600 font-bold">AL</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Alex Lee</h4>
                  <p className="text-sm text-gray-600">Creator of EduAI</p>
                </div>
              </div>
              <p className="text-gray-600 italic">
                "WeRaise provided the perfect platform to launch my educational technology. The tools and community support made all the difference."
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-16 text-center">
            <div className="bg-white rounded-xl p-8 shadow-lg max-w-4xl mx-auto">
              <h3 className="text-3xl font-bold text-gray-900 mb-4">Join Our Success</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <p className="text-4xl font-bold text-blue-600 mb-2">$10M+</p>
                  <p className="text-gray-600">Total Raised</p>
                </div>
                <div>
                  <p className="text-4xl font-bold text-green-600 mb-2">500+</p>
                  <p className="text-gray-600">Successful Campaigns</p>
                </div>
                <div>
                  <p className="text-4xl font-bold text-purple-600 mb-2">50K+</p>
                  <p className="text-gray-600">Active Backers</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="bg-white py-20">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">Ready to Launch Your Dream Project?</h2>
          <p className="text-xl text-gray-600 mb-8">
            Join thousands of creators who have successfully funded their ideas. Start your campaign today.
          </p>
          <Link 
            to={isAuthenticated ? "/dashboard" : "/signup"}
            className="bg-gray-200 text-black font-semibold px-8 py-4 rounded-lg hover:bg-gray-300 transition-colors duration-200 text-lg cursor-pointer"
          >
            {isAuthenticated ? "Go to Dashboard" : "Start a Campaign"}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <img src="/WeRaise_Logo.png" alt="We Raise" className="w-8 h-8 mr-2" />
                <span className="text-xl font-bold">We Raise</span>
              </div>
              <p className="text-gray-400">
                Empowering creators to bring their ideas to life through crowdfunding.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Platform</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">How It Works</a></li>
                <li><a href="#" className="hover:text-white">Success Stories</a></li>
                <li><a href="#" className="hover:text-white">Creator Resources</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Help Center</a></li>
                <li><a href="#" className="hover:text-white">Contact Us</a></li>
                <li><a href="#" className="hover:text-white">Community</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white">Cookie Policy</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 We Raise. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
