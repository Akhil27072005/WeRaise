import { supabase } from './db';
import bcrypt from 'bcryptjs';

// =====================================================
// WeRaise Crowdfunding Platform - Database Seeding Script
// =====================================================
// This script populates the PostgreSQL database with comprehensive
// mock data for testing frontend complexity and performance.
// =====================================================

interface User {
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  location: string;
  is_creator: boolean;
  is_verified: boolean;
  email_verified: boolean;
}

interface Campaign {
  creator_id: string;
  category_id: string;
  title: string;
  tagline: string;
  description: string;
  story: string;
  main_image_url: string;
  video_url?: string;
  funding_goal: number;
  minimum_pledge: number;
  funding_type: 'all-or-nothing' | 'keep-it-all';
  status: 'draft' | 'pending' | 'active' | 'completed' | 'failed' | 'cancelled';
  location: string;
  duration_days: number;
  start_date: string;
  end_date: string;
  published_at?: string;
}

interface RewardTier {
  campaign_id: string;
  amount: number;
  title: string;
  description: string;
  estimated_delivery_date: string;
  quantity_limit?: number;
  quantity_claimed: number;
  is_limited: boolean;
  display_order: number;
}

interface Comment {
  campaign_id: string;
  user_id: string;
  parent_comment_id?: string;
  content: string;
  is_public: boolean;
}

interface Pledge {
  campaign_id: string;
  backer_id: string;
  reward_tier_id?: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'refunded';
  fulfillment_status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'delayed' | 'refunded';
  estimated_delivery_date?: string;
  shipping_address?: any;
  confirmed_at?: string;
}

interface CampaignUpdate {
  campaign_id: string;
  title: string;
  content: string;
  image_url?: string;
  is_public: boolean;
}

interface CampaignMedia {
  campaign_id: string;
  media_type: 'image' | 'video';
  url: string;
  alt_text: string;
  display_order: number;
}

// =====================================================
// MOCK DATA GENERATORS
// =====================================================

const categories = [
  { name: 'Technology', description: 'Innovation and tech projects', icon_name: 'settings' },
  { name: 'Education', description: 'Learning and knowledge sharing', icon_name: 'book-open' },
  { name: 'Community', description: 'Local community initiatives', icon_name: 'users' },
  { name: 'Environment', description: 'Environmental and sustainability projects', icon_name: 'leaf' },
  { name: 'Arts & Culture', description: 'Creative and cultural projects', icon_name: 'palette' },
  { name: 'Wellness', description: 'Health and wellness initiatives', icon_name: 'heart' },
  { name: 'Food & Beverage', description: 'Culinary and beverage projects', icon_name: 'utensils' },
  { name: 'Fashion & Design', description: 'Fashion and design projects', icon_name: 'shirt' }
];

const firstNames = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn',
  'Blake', 'Cameron', 'Drew', 'Emery', 'Finley', 'Hayden', 'Jamie', 'Kendall',
  'Parker', 'Reese', 'Sage', 'Skyler', 'Sydney', 'Tatum', 'River', 'Phoenix'
];

const lastNames = [
  'Anderson', 'Brown', 'Davis', 'Garcia', 'Johnson', 'Jones', 'Miller', 'Rodriguez',
  'Smith', 'Taylor', 'Thomas', 'Thompson', 'White', 'Williams', 'Wilson', 'Martinez',
  'Jackson', 'Lee', 'Perez', 'Thompson', 'Harris', 'Sanchez', 'Clark', 'Ramirez'
];

const locations = [
  'San Francisco, CA', 'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Austin, TX',
  'Seattle, WA', 'Boston, MA', 'Denver, CO', 'Portland, OR', 'Miami, FL',
  'Atlanta, GA', 'Phoenix, AZ', 'Dallas, TX', 'Houston, TX', 'Philadelphia, PA'
];

const bios = [
  'Passionate entrepreneur with a vision for positive change.',
  'Creative professional dedicated to bringing innovative ideas to life.',
  'Tech enthusiast and community builder.',
  'Artist and storyteller exploring new mediums.',
  'Environmental advocate working towards sustainable solutions.',
  'Educator committed to making learning accessible to all.',
  'Designer focused on creating beautiful, functional experiences.',
  'Researcher pushing the boundaries of what\'s possible.',
  'Community organizer building stronger neighborhoods.',
  'Innovator combining technology with social impact.'
];

const avatarUrls = [
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=150&h=150&fit=crop&crop=face'
];

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomElements<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDecimal(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function getRandomDate(start: Date, end: Date): string {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
}

function getRandomFutureDate(daysFromNow: number): string {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysFromNow);
  return futureDate.toISOString();
}

function getRandomPastDate(daysAgo: number): string {
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - daysAgo);
  return pastDate.toISOString();
}

// =====================================================
// DATA GENERATION FUNCTIONS
// =====================================================

async function generateUsers(): Promise<User[]> {
  const users: User[] = [];
  const passwordHash = await bcrypt.hash('password123', 10);
  
  for (let i = 0; i < 20; i++) {
    const firstName = getRandomElement(firstNames);
    const lastName = getRandomElement(lastNames);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i + 1}@example.com`;
    
    users.push({
      email,
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      display_name: `${firstName} ${lastName}`,
      bio: getRandomElement(bios),
      avatar_url: getRandomElement(avatarUrls),
      location: getRandomElement(locations),
      is_creator: i < 8, // First 8 users are creators
      is_verified: Math.random() > 0.3, // 70% verified
      email_verified: Math.random() > 0.1 // 90% email verified
    });
  }
  
  return users;
}

async function generateCampaigns(userIds: string[], categoryIds: string[]): Promise<Campaign[]> {
  const campaigns: Campaign[] = [];
  const creatorIds = userIds.slice(0, 8); // First 8 users are creators
  
  // Ensure we have category IDs
  if (categoryIds.length === 0) {
    throw new Error('No categories available. Please ensure categories are inserted first.');
  }
  
  const campaignTemplates = [
    {
      title: 'EcoSmart Home Automation System',
      tagline: 'Transform your home into an eco-friendly smart space',
      description: 'An innovative home automation system that reduces energy consumption by 40% while providing seamless smart home control.',
      story: 'After years of research in sustainable technology, our team has developed a revolutionary home automation system that not only makes your home smarter but also significantly reduces your carbon footprint. Our EcoSmart system learns your habits and optimizes energy usage automatically.',
      funding_goal: 50000,
      minimum_pledge: 25,
      funding_type: 'all-or-nothing' as const,
      location: 'San Francisco, CA',
      duration_days: 45
    },
    {
      title: 'Community Garden Initiative',
      tagline: 'Growing fresh food and stronger communities together',
      description: 'Establishing urban gardens in underserved neighborhoods to provide fresh produce and community gathering spaces.',
      story: 'Our community garden initiative aims to transform vacant lots into thriving green spaces where neighbors can grow fresh vegetables, learn about sustainable agriculture, and build lasting friendships. We\'ve already secured partnerships with local schools and community centers.',
      funding_goal: 25000,
      minimum_pledge: 10,
      funding_type: 'keep-it-all' as const,
      location: 'Detroit, MI',
      duration_days: 60
    },
    {
      title: 'Art Therapy for Veterans',
      tagline: 'Healing through creativity and community',
      description: 'Providing free art therapy sessions and materials for veterans dealing with PTSD and mental health challenges.',
      story: 'Art therapy has proven to be an effective tool for healing trauma and building resilience. Our program provides professional art therapists, quality materials, and a supportive community environment where veterans can express themselves and connect with others who understand their experiences.',
      funding_goal: 35000,
      minimum_pledge: 15,
      funding_type: 'all-or-nothing' as const,
      location: 'Austin, TX',
      duration_days: 30
    },
    {
      title: 'Sustainable Fashion Line',
      tagline: 'Ethical fashion that doesn\'t compromise on style',
      description: 'Creating a complete sustainable fashion collection using recycled materials and ethical manufacturing.',
      story: 'The fashion industry is one of the world\'s largest polluters. Our sustainable fashion line proves that style and sustainability can coexist. We use only recycled and organic materials, partner with ethical manufacturers, and ensure fair wages for all workers in our supply chain.',
      funding_goal: 75000,
      minimum_pledge: 50,
      funding_type: 'all-or-nothing' as const,
      location: 'Los Angeles, CA',
      duration_days: 90
    },
    {
      title: 'Educational VR Platform',
      tagline: 'Immersive learning experiences for students worldwide',
      description: 'Developing virtual reality educational content that makes learning interactive and engaging for students of all ages.',
      story: 'Virtual reality has the power to transform education by making abstract concepts tangible and creating immersive learning experiences. Our platform will provide VR content for science, history, and literature classes, making education more engaging and accessible.',
      funding_goal: 100000,
      minimum_pledge: 30,
      funding_type: 'all-or-nothing' as const,
      location: 'Seattle, WA',
      duration_days: 120
    },
    {
      title: 'Local Food Truck Network',
      tagline: 'Supporting local chefs and bringing diverse cuisine to your neighborhood',
      description: 'Creating a network of food trucks featuring local chefs and diverse cuisines in underserved areas.',
      story: 'Food trucks bring communities together through shared meals and cultural exchange. Our network will support local chefs, provide healthy food options in food deserts, and create economic opportunities for culinary entrepreneurs.',
      funding_goal: 40000,
      minimum_pledge: 20,
      funding_type: 'keep-it-all' as const,
      location: 'Chicago, IL',
      duration_days: 45
    },
    {
      title: 'Mental Health App for Teens',
      tagline: 'Supporting teen mental health through technology and community',
      description: 'Developing a comprehensive mental health app specifically designed for teenagers with peer support and professional resources.',
      story: 'Teen mental health is a growing concern, and traditional resources often don\'t meet young people where they are. Our app combines peer support, professional resources, and evidence-based techniques in a platform that teens will actually want to use.',
      funding_goal: 60000,
      minimum_pledge: 25,
      funding_type: 'all-or-nothing' as const,
      location: 'Boston, MA',
      duration_days: 75
    },
    {
      title: 'Renewable Energy for Schools',
      tagline: 'Powering education with clean energy',
      description: 'Installing solar panels and renewable energy systems in public schools to reduce costs and teach sustainability.',
      story: 'Schools spend millions on energy costs that could be redirected to education. Our initiative installs solar panels and renewable energy systems in public schools, reducing their energy costs while providing hands-on learning opportunities about sustainability.',
      funding_goal: 150000,
      minimum_pledge: 100,
      funding_type: 'all-or-nothing' as const,
      location: 'Denver, CO',
      duration_days: 180
    },
    {
      title: 'Indie Film Production',
      tagline: 'Telling stories that matter through independent cinema',
      description: 'Producing an independent film that explores themes of social justice and community resilience.',
      story: 'Independent cinema has the power to tell stories that mainstream media often ignores. Our film explores themes of social justice, community resilience, and the power of ordinary people to create extraordinary change.',
      funding_goal: 80000,
      minimum_pledge: 40,
      funding_type: 'all-or-nothing' as const,
      location: 'New York, NY',
      duration_days: 60
    },
    {
      title: 'Accessibility Tech Innovation',
      tagline: 'Making technology accessible to everyone',
      description: 'Developing assistive technology devices that make digital experiences more accessible for people with disabilities.',
      story: 'Technology should be accessible to everyone, regardless of ability. Our assistive technology devices use cutting-edge AI and sensor technology to make digital experiences more accessible and inclusive for people with various disabilities.',
      funding_goal: 120000,
      minimum_pledge: 75,
      funding_type: 'all-or-nothing' as const,
      location: 'Portland, OR',
      duration_days: 90
    },
    {
      title: 'Community Music Studio',
      tagline: 'Creating space for musical expression and learning',
      description: 'Building a community music studio with instruments, recording equipment, and free lessons for underserved youth.',
      story: 'Music has the power to transform lives, but access to instruments and instruction is often limited by economic barriers. Our community music studio will provide free instruments, recording equipment, and professional instruction to underserved youth.',
      funding_goal: 45000,
      minimum_pledge: 35,
      funding_type: 'keep-it-all' as const,
      location: 'Miami, FL',
      duration_days: 50
    },
    {
      title: 'Urban Farming Initiative',
      tagline: 'Growing food and hope in the heart of the city',
      description: 'Establishing vertical farms in urban areas to provide fresh produce and create green jobs.',
      story: 'Urban farming can address food insecurity while creating green jobs and improving air quality. Our vertical farming initiative will establish farms in urban areas, providing fresh produce to local communities and creating employment opportunities.',
      funding_goal: 95000,
      minimum_pledge: 60,
      funding_type: 'all-or-nothing' as const,
      location: 'Atlanta, GA',
      duration_days: 100
    },
    {
      title: 'Digital Literacy Program',
      tagline: 'Bridging the digital divide one person at a time',
      description: 'Providing free digital literacy training and computer access to underserved communities.',
      story: 'Digital literacy is essential in today\'s world, but many people lack access to training and technology. Our program provides free digital literacy training, computer access, and ongoing support to help people participate fully in the digital economy.',
      funding_goal: 55000,
      minimum_pledge: 20,
      funding_type: 'keep-it-all' as const,
      location: 'Phoenix, AZ',
      duration_days: 80
    },
    {
      title: 'Wildlife Conservation Project',
      tagline: 'Protecting endangered species through community action',
      description: 'Supporting local wildlife conservation efforts and habitat restoration in threatened ecosystems.',
      story: 'Wildlife conservation requires community involvement and sustainable solutions. Our project supports local conservation efforts, habitat restoration, and community education to protect endangered species and their ecosystems.',
      funding_goal: 70000,
      minimum_pledge: 45,
      funding_type: 'all-or-nothing' as const,
      location: 'Dallas, TX',
      duration_days: 120
    },
    {
      title: 'Senior Technology Training',
      tagline: 'Connecting seniors to the digital world',
      description: 'Providing technology training and support for seniors to help them stay connected and independent.',
      story: 'Technology can help seniors stay connected with family, access services, and maintain independence. Our program provides patient, personalized technology training and ongoing support to help seniors navigate the digital world with confidence.',
      funding_goal: 30000,
      minimum_pledge: 25,
      funding_type: 'keep-it-all' as const,
      location: 'Houston, TX',
      duration_days: 40
    }
  ];

  for (let i = 0; i < 15; i++) {
    const template = campaignTemplates[i];
    const creatorId = getRandomElement(creatorIds);
    const categoryId = getRandomElement(categoryIds);
    
    // Determine campaign status and dates
    const now = new Date();
    const startDate = getRandomPastDate(30);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + template.duration_days);
    
    let status: Campaign['status'];
    let publishedAt: string | undefined;
    
    if (i < 7) { // 50% successfully funded
      status = 'completed';
      publishedAt = startDate;
    } else if (i < 12) { // 30% active
      status = 'active';
      publishedAt = startDate;
    } else { // 20% failed
      status = 'failed';
      publishedAt = startDate;
    }
    
    campaigns.push({
      creator_id: creatorId,
      category_id: categoryId,
      title: template.title,
      tagline: template.tagline,
      description: template.description,
      story: template.story,
      main_image_url: [
        'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674641/IMG_7912_xjq6bf.webp', // EcoSmart Home Automation System
        'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674287/photo-1416879595882-3373a0480b5b_en5rjo.jpg', // Community Garden Initiative
        'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674626/education_banner_d882ff0e86_bwzjao.jpg', // Art Therapy for Veterans
        'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674324/photo-1441986300917-64674bd600d8_yq1ln1.jpg', // Sustainable Fashion Line
        'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674626/education_banner_d882ff0e86_bwzjao.jpg', // Educational VR Platform
        'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674607/142019441-56a792635f9b58b7d0ebcaa2_dc2w2d.jpg', // Local Food Truck Network
        'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674368/photo-1571019613454-1cb2f99b2d8b_vzrxwd.jpg', // Mental Health App for Teens
        'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674382/photo-1506905925346-21bda4d32df4_towfzy.jpg', // Renewable Energy for Schools
        'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674687/film-production-on-set_kgltvi.jpg', // Indie Film Production
        'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674641/IMG_7912_xjq6bf.webp', // Accessibility Tech Innovation
        'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674287/photo-1416879595882-3373a0480b5b_en5rjo.jpg', // Community Music Studio
        'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674287/photo-1416879595882-3373a0480b5b_en5rjo.jpg', // Urban Farming Initiative
        'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674626/education_banner_d882ff0e86_bwzjao.jpg', // Digital Literacy Program
        'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674382/photo-1506905925346-21bda4d32df4_towfzy.jpg', // Wildlife Conservation Project
        'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674626/education_banner_d882ff0e86_bwzjao.jpg' // Senior Technology Training
      ][i],
      video_url: Math.random() > 0.5 ? `https://vimeo.com/${1000000 + i}` : undefined,
      funding_goal: template.funding_goal,
      minimum_pledge: template.minimum_pledge,
      funding_type: template.funding_type,
      status,
      location: template.location,
      duration_days: template.duration_days,
      start_date: startDate,
      end_date: endDate.toISOString(),
      published_at: publishedAt
    });
  }
  
  return campaigns;
}

function generateRewardTiers(campaignIds: string[]): RewardTier[] {
  const rewardTiers: RewardTier[] = [];
  
  const tierTemplates = [
    { amount: 10, title: 'Supporter', description: 'Thank you for your support! You\'ll receive updates and our gratitude.' },
    { amount: 25, title: 'Early Bird', description: 'Early supporter perks including exclusive updates and behind-the-scenes content.' },
    { amount: 50, title: 'Backer', description: 'Special recognition and exclusive digital content.' },
    { amount: 100, title: 'Supporter Plus', description: 'All previous rewards plus a special thank you gift.' },
    { amount: 250, title: 'VIP Supporter', description: 'VIP recognition and exclusive merchandise.' },
    { amount: 500, title: 'Premium Backer', description: 'Premium recognition and exclusive access to creator events.' },
    { amount: 1000, title: 'Champion', description: 'Champion recognition and personal consultation with the creator.' }
  ];
  
  campaignIds.forEach(campaignId => {
    const numTiers = getRandomNumber(3, 5);
    const selectedTiers = getRandomElements(tierTemplates, numTiers);
    
    selectedTiers.forEach((tier, index) => {
      const isLimited = Math.random() > 0.7; // 30% limited
      const quantityLimit = isLimited ? getRandomNumber(10, 100) : undefined;
      const quantityClaimed = isLimited ? getRandomNumber(0, Math.floor(quantityLimit! * 0.8)) : 0;
      
      rewardTiers.push({
        campaign_id: campaignId,
        amount: tier.amount,
        title: tier.title,
        description: tier.description,
        estimated_delivery_date: getRandomFutureDate(90).split('T')[0],
        quantity_limit: quantityLimit,
        quantity_claimed: quantityClaimed,
        is_limited: isLimited,
        display_order: index
      });
    });
  });
  
  return rewardTiers;
}

function generatePledges(campaignIds: string[], userIds: string[], rewardTierIds: string[]): Pledge[] {
  const pledges: Pledge[] = [];
  const backerIds = userIds.slice(8); // Users 8+ are backers
  
  for (let i = 0; i < 200; i++) {
    const campaignId = getRandomElement(campaignIds);
    const backerId = getRandomElement(backerIds);
    const rewardTierId = Math.random() > 0.3 ? getRandomElement(rewardTierIds) : undefined;
    
    // Generate realistic pledge amount
    let amount: number;
    if (rewardTierId) {
      // Find the reward tier to get its amount
      const rewardTier = rewardTierIds.find(id => id === rewardTierId);
      amount = getRandomDecimal(10, 1000);
    } else {
      amount = getRandomDecimal(5, 500);
    }
    
    const statuses: Pledge['status'][] = ['confirmed', 'pending', 'cancelled'];
    const status = getRandomElement(statuses);
    
    const fulfillmentStatuses: Pledge['fulfillment_status'][] = ['pending', 'processing', 'shipped', 'delivered'];
    const fulfillmentStatus = getRandomElement(fulfillmentStatuses);
    
    const createdAt = getRandomPastDate(60);
    const confirmedAt = status === 'confirmed' ? new Date(createdAt).toISOString() : undefined;
    
    pledges.push({
      campaign_id: campaignId,
      backer_id: backerId,
      reward_tier_id: rewardTierId,
      amount,
      status,
      fulfillment_status: fulfillmentStatus,
      estimated_delivery_date: getRandomFutureDate(120).split('T')[0],
      shipping_address: {
        name: `${getRandomElement(firstNames)} ${getRandomElement(lastNames)}`,
        street: `${getRandomNumber(100, 9999)} ${getRandomElement(['Main', 'Oak', 'Pine', 'Elm', 'Cedar'])} St`,
        city: getRandomElement(['San Francisco', 'New York', 'Los Angeles', 'Chicago', 'Austin']),
        state: getRandomElement(['CA', 'NY', 'TX', 'IL', 'WA']),
        zip: getRandomNumber(10000, 99999).toString(),
        country: 'USA'
      },
      confirmed_at: confirmedAt
    });
  }
  
  return pledges;
}

function generateCampaignMedia(campaignIds: string[]): CampaignMedia[] {
  const media: CampaignMedia[] = [];
  
  // Cloudinary image URLs for different campaign categories
  const mediaCollections = {
    technology: [
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674641/IMG_7912_xjq6bf.webp', // Smart home devices
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674641/IMG_7912_xjq6bf.webp', // Technology workspace
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674641/IMG_7912_xjq6bf.webp', // Circuit boards
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674641/IMG_7912_xjq6bf.webp', // Modern office
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674641/IMG_7912_xjq6bf.webp'  // Smart devices
    ],
    education: [
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674626/education_banner_d882ff0e86_bwzjao.jpg', // Students learning
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674626/education_banner_d882ff0e86_bwzjao.jpg', // Teacher and students
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674626/education_banner_d882ff0e86_bwzjao.jpg', // Classroom setting
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674626/education_banner_d882ff0e86_bwzjao.jpg', // Books and learning
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674626/education_banner_d882ff0e86_bwzjao.jpg'  // Educational environment
    ],
    community: [
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674287/photo-1416879595882-3373a0480b5b_en5rjo.jpg', // Community gathering
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674287/photo-1416879595882-3373a0480b5b_en5rjo.jpg', // People together
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674287/photo-1416879595882-3373a0480b5b_en5rjo.jpg', // Community event
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674287/photo-1416879595882-3373a0480b5b_en5rjo.jpg', // Group activity
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674287/photo-1416879595882-3373a0480b5b_en5rjo.jpg'  // Community spirit
    ],
    environment: [
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674382/photo-1506905925346-21bda4d32df4_towfzy.jpg', // Forest/nature
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674382/photo-1506905925346-21bda4d32df4_towfzy.jpg', // Green energy
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674382/photo-1506905925346-21bda4d32df4_towfzy.jpg', // Environmental conservation
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674382/photo-1506905925346-21bda4d32df4_towfzy.jpg', // Sustainable living
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674382/photo-1506905925346-21bda4d32df4_towfzy.jpg'  // Nature preservation
    ],
    arts: [
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674420/photo-1493225457124-a3eb161ffa5f_ipykar.jpg', // Art studio
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674420/photo-1493225457124-a3eb161ffa5f_ipykar.jpg', // Creative workspace
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674420/photo-1493225457124-a3eb161ffa5f_ipykar.jpg', // Artistic process
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674420/photo-1493225457124-a3eb161ffa5f_ipykar.jpg', // Creative expression
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674420/photo-1493225457124-a3eb161ffa5f_ipykar.jpg'  // Art creation
    ],
    wellness: [
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674368/photo-1571019613454-1cb2f99b2d8b_vzrxwd.jpg', // Yoga/wellness
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674368/photo-1571019613454-1cb2f99b2d8b_vzrxwd.jpg', // Healthy lifestyle
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674368/photo-1571019613454-1cb2f99b2d8b_vzrxwd.jpg', // Mental health
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674368/photo-1571019613454-1cb2f99b2d8b_vzrxwd.jpg', // Wellness activities
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674368/photo-1571019613454-1cb2f99b2d8b_vzrxwd.jpg'  // Health and wellness
    ],
    food: [
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674607/142019441-56a792635f9b58b7d0ebcaa2_dc2w2d.jpg', // Food preparation
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674607/142019441-56a792635f9b58b7d0ebcaa2_dc2w2d.jpg', // Culinary arts
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674607/142019441-56a792635f9b58b7d0ebcaa2_dc2w2d.jpg', // Fresh ingredients
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674607/142019441-56a792635f9b58b7d0ebcaa2_dc2w2d.jpg', // Cooking process
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674607/142019441-56a792635f9b58b7d0ebcaa2_dc2w2d.jpg'  // Food innovation
    ],
    fashion: [
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674324/photo-1441986300917-64674bd600d8_yq1ln1.jpg', // Fashion design
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674324/photo-1441986300917-64674bd600d8_yq1ln1.jpg', // Sustainable fashion
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674324/photo-1441986300917-64674bd600d8_yq1ln1.jpg', // Fashion studio
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674324/photo-1441986300917-64674bd600d8_yq1ln1.jpg', // Design process
      'https://res.cloudinary.com/dqcov9axv/image/upload/v1761674324/photo-1441986300917-64674bd600d8_yq1ln1.jpg'  // Fashion creation
    ]
  };
  
  const categoryKeys = Object.keys(mediaCollections);
  
  campaignIds.forEach((campaignId, campaignIndex) => {
    // Determine category based on campaign index (cycling through categories)
    const categoryKey = categoryKeys[campaignIndex % categoryKeys.length];
    const mediaIds = mediaCollections[categoryKey as keyof typeof mediaCollections];
    
    // Generate 3-5 media items per campaign
    const numMedia = getRandomNumber(3, 5);
    
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = mediaIds[i % mediaIds.length];
      const isVideo = Math.random() > 0.8; // 20% chance of video
      
      media.push({
        campaign_id: campaignId,
        media_type: isVideo ? 'video' : 'image',
        url: isVideo 
          ? `https://vimeo.com/${1000000 + campaignIndex * 10 + i}`
          : mediaUrl,
        alt_text: `${categoryKey} campaign media ${i + 1}`,
        display_order: i
      });
    }
  });
  
  return media;
}

function generateCampaignUpdates(campaignIds: string[]): CampaignUpdate[] {
  const updates: CampaignUpdate[] = [];
  
  const updateTemplates = [
    {
      title: 'Project Update: Exciting Progress!',
      content: 'We\'re thrilled to share some amazing progress on our project. The team has been working tirelessly, and we\'re seeing incredible results. Thank you for your continued support!'
    },
    {
      title: 'Behind the Scenes: Meet Our Team',
      content: 'We wanted to introduce you to the amazing people making this project possible. Each team member brings unique skills and passion to our mission.'
    },
    {
      title: 'Milestone Achieved: What\'s Next?',
      content: 'We\'ve reached an important milestone! This achievement brings us closer to our goal and opens up new possibilities for the project. Here\'s what we\'re planning next.'
    },
    {
      title: 'Community Spotlight: Your Stories',
      content: 'We\'re inspired by the stories you\'ve shared with us. Your experiences and feedback are shaping this project in meaningful ways. Keep sharing!'
    },
    {
      title: 'Technical Deep Dive: How It Works',
      content: 'For those interested in the technical details, we\'re sharing an in-depth look at how our solution works and why it\'s innovative.'
    }
  ];
  
  campaignIds.forEach(campaignId => {
    const numUpdates = getRandomNumber(3, 5);
    const selectedUpdates = getRandomElements(updateTemplates, numUpdates);
    
    selectedUpdates.forEach((update, index) => {
      updates.push({
        campaign_id: campaignId,
        title: update.title,
        content: update.content,
        image_url: Math.random() > 0.5 ? `https://images.unsplash.com/photo-${1600000000000 + index}?w=600&h=400&fit=crop` : undefined,
        is_public: true
      });
    });
  });
  
  return updates;
}

// =====================================================
// DATABASE OPERATIONS
// =====================================================

async function clearData(): Promise<void> {
  console.log('🗑️  Clearing existing data...');
  
  const tables = [
    'campaign_updates',
    'campaign_media',
    'pledges',
    'reward_tiers',
    'campaigns',
    'users',
    'categories'
  ];
  
  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
    
    if (error) {
      console.log(`⚠️  Warning: Could not clear ${table}:`, error.message);
    }
  }
  
  console.log('✅ Data cleared successfully');
}

async function insertCategories(): Promise<string[]> {
  console.log('📂 Inserting categories...');
  
  const { data, error } = await supabase
    .from('categories')
    .insert(categories)
    .select('id');
  
  if (error) {
    throw new Error(`Failed to insert categories: ${error.message}`);
  }
  
  const categoryIds = data.map(category => category.id);
  console.log(`✅ Inserted ${categories.length} categories`);
  return categoryIds;
}

async function insertUsers(users: User[]): Promise<string[]> {
  console.log('👥 Inserting users...');
  
  const { data, error } = await supabase
    .from('users')
    .insert(users)
    .select('id');
  
  if (error) {
    throw new Error(`Failed to insert users: ${error.message}`);
  }
  
  const userIds = data.map(user => user.id);
  console.log(`✅ Inserted ${users.length} users`);
  return userIds;
}

async function insertCampaigns(campaigns: Campaign[]): Promise<string[]> {
  console.log('🎯 Inserting campaigns...');
  
  const { data, error } = await supabase
    .from('campaigns')
    .insert(campaigns)
    .select('id');
  
  if (error) {
    throw new Error(`Failed to insert campaigns: ${error.message}`);
  }
  
  const campaignIds = data.map(campaign => campaign.id);
  console.log(`✅ Inserted ${campaigns.length} campaigns`);
  return campaignIds;
}

async function insertRewardTiers(rewardTiers: RewardTier[]): Promise<string[]> {
  console.log('🎁 Inserting reward tiers...');
  
  const { data, error } = await supabase
    .from('reward_tiers')
    .insert(rewardTiers)
    .select('id');
  
  if (error) {
    throw new Error(`Failed to insert reward tiers: ${error.message}`);
  }
  
  const rewardTierIds = data.map(tier => tier.id);
  console.log(`✅ Inserted ${rewardTiers.length} reward tiers`);
  return rewardTierIds;
}

async function insertPledges(pledges: Pledge[]): Promise<void> {
  console.log('💰 Inserting pledges...');
  
  // Insert in batches to avoid timeout
  const batchSize = 50;
  for (let i = 0; i < pledges.length; i += batchSize) {
    const batch = pledges.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('pledges')
      .insert(batch);
    
    if (error) {
      throw new Error(`Failed to insert pledges batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
    }
    
    console.log(`📦 Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(pledges.length / batchSize)}`);
  }
  
  console.log(`✅ Inserted ${pledges.length} pledges`);
}

async function insertCampaignMedia(media: CampaignMedia[]): Promise<void> {
  console.log('🖼️  Inserting campaign media...');
  
  const { error } = await supabase
    .from('campaign_media')
    .insert(media);
  
  if (error) {
    throw new Error(`Failed to insert campaign media: ${error.message}`);
  }
  
  console.log(`✅ Inserted ${media.length} campaign media items`);
}

async function insertCampaignUpdates(updates: CampaignUpdate[]): Promise<void> {
  console.log('📝 Inserting campaign updates...');
  
  const { error } = await supabase
    .from('campaign_updates')
    .insert(updates);
  
  if (error) {
    throw new Error(`Failed to insert campaign updates: ${error.message}`);
  }
  
  console.log(`✅ Inserted ${updates.length} campaign updates`);
}

// =====================================================
// COMMENT GENERATION AND INSERTION
// =====================================================

function generateComments(campaignIds: string[], userIds: string[]): Comment[] {
  const comments: Comment[] = [];
  const commentTemplates = [
    "This looks amazing! I'm excited to see how this project develops.",
    "Great concept! When do you expect to start shipping rewards?",
    "I've been following this project for a while. The progress looks fantastic!",
    "This is exactly what I've been looking for. Count me in!",
    "The video really sold me on this idea. Well done!",
    "I have a question about the shipping - will this be available internationally?",
    "The reward tiers look great. I'm going with the premium option.",
    "This campaign has exceeded my expectations. Keep up the great work!",
    "I'm curious about the timeline. When do you expect to complete this?",
    "The story behind this project is really inspiring. Good luck!",
    "I've backed similar projects before, but this one stands out.",
    "The creator seems very responsive. That's always a good sign.",
    "I'm excited to be part of this journey from the beginning.",
    "The quality of the rewards looks excellent based on the images.",
    "This is my first time backing a crowdfunding campaign. Excited!",
    "The community around this project seems really engaged.",
    "I love how transparent the creator is about the process.",
    "The stretch goals are really interesting. Hope you reach them!",
    "I've shared this with my friends. They're excited too!",
    "The updates are really helpful. Thanks for keeping us informed!"
  ];

  // Generate 3-8 comments per campaign
  campaignIds.forEach(campaignId => {
    const numComments = Math.floor(Math.random() * 6) + 3; // 3-8 comments
    
    for (let i = 0; i < numComments; i++) {
      const randomUser = userIds[Math.floor(Math.random() * userIds.length)];
      const randomComment = commentTemplates[Math.floor(Math.random() * commentTemplates.length)];
      
      comments.push({
        campaign_id: campaignId,
        user_id: randomUser,
        content: randomComment,
        is_public: true
      });
    }
  });

  return comments;
}

async function insertComments(comments: Comment[]): Promise<void> {
  console.log('💬 Inserting campaign comments...');
  
  const { error } = await supabase
    .from('campaign_comments')
    .insert(comments);
  
  if (error) {
    throw new Error(`Failed to insert campaign comments: ${error.message}`);
  }
  
  console.log(`✅ Inserted ${comments.length} campaign comments`);
}

// =====================================================
// MAIN EXECUTION FUNCTION
// =====================================================

async function main(): Promise<void> {
  try {
    console.log('🌱 Starting database seeding...');
    console.log('=====================================');
    
    // Step 1: Clear existing data
    await clearData();
    
    // Step 2: Insert categories first (no dependencies)
    const categoryIds = await insertCategories();
    
    // Step 3: Generate mock data
    console.log('📊 Generating mock data...');
    const users = await generateUsers();
    
    // Step 4: Insert users (no dependencies)
    const userIds = await insertUsers(users);
    
    // Step 5: Generate and insert campaigns (depends on users and categories)
    const campaigns = await generateCampaigns(userIds, categoryIds);
    const campaignIds = await insertCampaigns(campaigns);
    
    // Step 6: Insert reward tiers (depends on campaigns)
    const rewardTiers = generateRewardTiers(campaignIds);
    const rewardTierIds = await insertRewardTiers(rewardTiers);
    
    // Step 7: Insert pledges (depends on campaigns, users, and reward tiers)
    const pledges = generatePledges(campaignIds, userIds, rewardTierIds);
    await insertPledges(pledges);
    
    // Step 8: Insert campaign media (depends on campaigns)
    const media = generateCampaignMedia(campaignIds);
    await insertCampaignMedia(media);
    
    // Step 9: Insert campaign updates (depends on campaigns)
    const updates = generateCampaignUpdates(campaignIds);
    await insertCampaignUpdates(updates);
    
    // Step 10: Insert campaign comments (depends on campaigns and users)
    const comments = generateComments(campaignIds, userIds);
    await insertComments(comments);
    
    console.log('=====================================');
    console.log('🎉 Database seeding completed successfully!');
    console.log(`📈 Summary:`);
    console.log(`   • ${categories.length} categories created`);
    console.log(`   • ${users.length} users created`);
    console.log(`   • ${campaignIds.length} campaigns created`);
    console.log(`   • ${rewardTierIds.length} reward tiers created`);
    console.log(`   • ${pledges.length} pledges created`);
    console.log(`   • ${media.length} campaign media items created`);
    console.log(`   • ${updates.length} campaign updates created`);
    console.log(`   • ${comments.length} campaign comments created`);
    console.log('=====================================');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// =====================================================
// SCRIPT EXECUTION
// =====================================================

if (require.main === module) {
  main()
    .then(() => {
      console.log('✅ Seeding script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding script failed:', error);
      process.exit(1);
    });
}

export { main };
