import { Router, Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { supabase } from '../db';
import { authenticateToken, requireCreator, optionalAuthenticateToken } from '../middleware/authMiddleware';
import { sendRewardTracking } from '../utils/emailService';
import { JWTPayload } from '../utils/auth';
import { uploadSingle, handleUploadError } from '../middleware/uploadMiddleware';
import { uploadFile } from '../utils/cloudinary';

// =====================================================
// Campaign Routes
// =====================================================
// Handles campaign discovery, creation, updates, and management.
// Mix of public (viewing) and protected (creation/management) routes.
// =====================================================

const router = Router();

// =====================================================
// PUBLIC CAMPAIGN ROUTES (No Authentication Required)
// =====================================================

/**
 * GET /api/campaigns/categories
 * Retrieves all available categories
 * PUBLIC ACCESS - No authentication required
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve categories'
      });
      return;
    }

    res.json({ categories });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve categories'
    });
    return;
  }
});

/**
 * GET /api/campaigns
 * Retrieves list of all active/featured campaigns for discovery
 * PUBLIC ACCESS - No authentication required
 */
router.get('/', 
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    query('category').optional().isUUID().withMessage('Category must be a valid UUID'),
    query('categoryName').optional().isIn(['Technology', 'Education', 'Community', 'Environment', 'Arts & Culture', 'Wellness', 'Food & Beverage', 'Fashion & Design']).withMessage('Invalid category name'),
    query('status').optional().isIn(['active', 'completed', 'failed']).withMessage('Invalid status'),
    query('sort').optional().isIn(['newest', 'popular', 'category', 'most_funded']).withMessage('Invalid sort option')
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid query parameters',
          details: errors.array()
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      const { category, categoryName, status, sort } = req.query;

      // Build query with campaign media
      let query = supabase
        .from('campaign_summary')
        .select(`
          *,
          campaign_media(
            id,
            media_type,
            url,
            alt_text,
            display_order
          )
        `);

      // Apply filters
      if (category) {
        query = query.eq('category_id', category);
      }
      
      if (categoryName) {
        query = query.eq('category_name', categoryName);
      }
      
      if (status) {
        query = query.eq('status', status);
      } else {
        // Default to active campaigns
        query = query.in('status', ['active', 'completed']);
      }

      // Apply sorting
      switch (sort) {
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        case 'popular':
          query = query.order('backer_count', { ascending: false });
          break;
        case 'category':
          query = query.order('category_name', { ascending: true });
          break;
        case 'most_funded':
          query = query.order('total_raised', { ascending: false });
          break;
        default:
          query = query.order('category_name', { ascending: true });
      }

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data: campaigns, error } = await query;

      if (error) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to retrieve campaigns'
        });
        return;
      }

      // Calculate days remaining for each campaign
      const campaignsWithDaysRemaining = campaigns?.map(campaign => {
        const now = new Date();
        const endDate = new Date(campaign.end_date);
        const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        
        return {
          ...campaign,
          days_remaining: daysRemaining
        };
      }) || [];

      res.json({
        campaigns: campaignsWithDaysRemaining,
        pagination: {
          page,
          limit,
          total: campaignsWithDaysRemaining.length
        }
      });

    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve campaigns'
      });
      return;
    }
  }
);

/**
 * GET /api/campaigns/search
 * Searches campaigns based on query and filters
 * PUBLIC ACCESS - No authentication required
 */
router.get('/search',
  [
    query('q').notEmpty().withMessage('Search query is required'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('category').optional().isUUID(),
    query('categoryName').optional().isIn(['Technology', 'Education', 'Community', 'Environment', 'Arts & Culture', 'Wellness', 'Food & Beverage', 'Fashion & Design']),
    query('minGoal').optional().isFloat({ min: 0 }),
    query('maxGoal').optional().isFloat({ min: 0 })
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid search parameters',
          details: errors.array()
        });
        return;
      }

      const { q, page = 1, limit = 20, category, categoryName, minGoal, maxGoal } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      // Build search query with campaign media
      let query = supabase
        .from('campaign_summary')
        .select(`
          *,
          campaign_media(
            id,
            media_type,
            url,
            alt_text,
            display_order
          )
        `)
        .or(`title.ilike.%${q}%,tagline.ilike.%${q}%`)
        .in('status', ['active', 'completed']);

      // Apply filters
      if (category) {
        query = query.eq('category_id', category);
      }

      if (categoryName) {
        query = query.eq('category_name', categoryName);
      }

      if (minGoal) {
        query = query.gte('funding_goal', minGoal);
      }

      if (maxGoal) {
        query = query.lte('funding_goal', maxGoal);
      }

      // Apply pagination
      query = query.range(offset, offset + parseInt(limit as string) - 1);

      const { data: campaigns, error } = await query;

      if (error) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Search failed'
        });
        return;
      }

      // Calculate days remaining for each campaign
      const campaignsWithDaysRemaining = campaigns?.map(campaign => {
        const now = new Date();
        const endDate = new Date(campaign.end_date);
        const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        
        return {
          ...campaign,
          days_remaining: daysRemaining
        };
      }) || [];

      res.json({
        campaigns: campaignsWithDaysRemaining,
        query: q,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: campaignsWithDaysRemaining.length
        }
      });

    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Search failed'
      });
      return;
    }
  }
);

/**
 * GET /api/campaigns/my-campaigns
 * Retrieves campaigns created by the authenticated user
 * PROTECTED ACCESS - Requires authentication
 */
router.get('/my-campaigns',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = (req.user as JWTPayload)!.userId;

      // Get creator's campaigns with basic info
      const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select(`
          id,
          title,
          tagline,
          main_image_url,
          funding_goal,
          status,
          created_at,
          end_date,
          duration_days,
          categories(name)
        `)
        .eq('creator_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to retrieve campaigns'
        });
        return;
      }

      // Calculate pledge totals for each campaign
      const campaignsWithTotals = await Promise.all(
        campaigns.map(async (campaign) => {
          // Get pledge data for this campaign
          const { data: pledges, error: pledgesError } = await supabase
            .from('pledges')
            .select('amount, status')
            .eq('campaign_id', campaign.id)
            .eq('status', 'confirmed');

          if (pledgesError) {
            console.error('Error fetching pledges for campaign:', campaign.id, pledgesError);
            return {
              ...campaign,
              total_raised: 0,
              backer_count: 0,
              days_remaining: Math.max(0, Math.ceil((new Date(campaign.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))),
              category_name: campaign.categories?.[0]?.name || 'Unknown'
            };
          }

          const totalRaised = pledges?.reduce((sum, pledge) => sum + parseFloat(pledge.amount), 0) || 0;
          const backerCount = pledges?.length || 0;
          const daysRemaining = Math.max(0, Math.ceil((new Date(campaign.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));

          return {
            ...campaign,
            total_raised: totalRaised,
            backer_count: backerCount,
            days_remaining: daysRemaining,
            category_name: campaign.categories?.[0]?.name || 'Unknown'
          };
        })
      );

      res.json({
        campaigns: campaignsWithTotals
      });

    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve campaigns'
      });
      return;
    }
  }
);

/**
 * GET /api/campaigns/funding-analytics
 * Retrieves daily funding data for creator's campaigns
 * PROTECTED ACCESS - Creator authentication required
 */
router.get('/funding-analytics',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = (req.user as JWTPayload)!.userId;
      const { days = 90 } = req.query;

      // Get creator's campaigns
      const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select('id, title')
        .eq('creator_id', userId)
        .eq('status', 'active');

      if (campaignsError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to retrieve campaigns'
        });
        return;
      }

      if (!campaigns || campaigns.length === 0) {
        res.json({
          data: [],
          campaigns: []
        });
        return;
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days as string));

      // Generate date range
      const dateRange = [];
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        dateRange.push(new Date(currentDate).toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Get daily funding data for each campaign
      const fundingData = await Promise.all(
        campaigns.map(async (campaign) => {
          const { data: pledges, error: pledgesError } = await supabase
            .from('pledges')
            .select('amount, created_at')
            .eq('campaign_id', campaign.id)
            .eq('status', 'confirmed')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());

          if (pledgesError) {
            console.error('Error fetching pledges for campaign:', campaign.id, pledgesError);
            return { campaign, dailyData: {} };
          }

          // Group pledges by date
          const dailyData: { [key: string]: number } = {};
          pledges?.forEach(pledge => {
            const date = new Date(pledge.created_at).toISOString().split('T')[0];
            dailyData[date] = (dailyData[date] || 0) + parseFloat(pledge.amount);
          });

          return { campaign, dailyData };
        })
      );

      // Create chart data structure
      const chartData = dateRange.map(date => {
        const dataPoint: { [key: string]: string | number } = { date };
        
        fundingData.forEach(({ campaign, dailyData }) => {
          dataPoint[campaign.id] = dailyData[date] || 0;
        });

        return dataPoint;
      });

      res.json({
        data: chartData,
        campaigns: campaigns.map(c => ({
          id: c.id,
          title: c.title,
          color: `var(--chart-${campaigns.indexOf(c) % 5 + 1})`
        }))
      });

    } catch (error) {
      console.error('Error fetching funding analytics:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve funding analytics'
      });
      return;
    }
  }
);

/**
 * GET /api/campaigns/:id
 * Retrieves full details for a single campaign
 * PUBLIC ACCESS - No authentication required
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const campaignId = req.params.id;

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        *,
        creator:users!creator_id(id, display_name, avatar_url, is_verified),
        category:categories(id, name, icon_name),
        reward_tiers(*),
        campaign_media(*)
      `)
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Campaign not found'
      });
      return;
    }

    // Get pledge statistics
    const { data: pledgeStats, error: statsError } = await supabase
      .from('pledges')
      .select('amount, status')
      .eq('campaign_id', campaignId)
      .eq('status', 'confirmed');

    if (statsError) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve campaign statistics'
      });
      return;
    }

    const totalRaised = pledgeStats?.reduce((sum, pledge) => sum + parseFloat(pledge.amount), 0) || 0;
    const backerCount = pledgeStats?.length || 0;

    // Calculate days remaining
    const now = new Date();
    const endDate = new Date(campaign.end_date);
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    // Get category name
    const category = Array.isArray(campaign.category) ? campaign.category[0] : campaign.category;
    const categoryName = category?.name || 'Uncategorized';

    // Get creator name
    const creator = Array.isArray(campaign.creator) ? campaign.creator[0] : campaign.creator;
    const creatorName = creator?.display_name || 
                       `${creator?.first_name || ''} ${creator?.last_name || ''}`.trim() ||
                       'Unknown Creator';

    res.json({
      campaign: {
        ...campaign,
        total_raised: totalRaised,
        backer_count: backerCount,
        funding_percentage: Math.round((totalRaised / parseFloat(campaign.funding_goal)) * 100),
        days_remaining: daysRemaining,
        creator_name: creatorName,
        category_name: categoryName
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve campaign'
    });
    return;
  }
});

// =====================================================
// PROTECTED CAMPAIGN ROUTES (Authentication Required)
// =====================================================

/**
 * POST /api/campaigns
 * Creates a new campaign and reward tiers
 * PROTECTED ACCESS - Requires authentication
 */
router.post('/',
  authenticateToken,
  uploadSingle,
  handleUploadError,
  [
    body('title').trim().isLength({ min: 1, max: 255 }).withMessage('Title is required and must be less than 255 characters'),
    body('tagline').trim().isLength({ min: 1, max: 500 }).withMessage('Tagline is required and must be less than 500 characters'),
    body('description').trim().isLength({ min: 1, max: 2000 }).withMessage('Description is required and must be less than 2000 characters'),
    body('story').trim().isLength({ min: 1 }).withMessage('Story is required'),
    body('categoryId').notEmpty().withMessage('Category is required'),
    body('fundingGoal').isNumeric().withMessage('Funding goal must be a number'),
    body('minimumPledge').optional().isNumeric().withMessage('Minimum pledge must be a number'),
    body('fundingType').isIn(['all-or-nothing', 'keep-it-all']).withMessage('Invalid funding type'),
    body('durationDays').isNumeric().withMessage('Duration must be a number'),
    body('location').optional().trim().isLength({ max: 255 }),
    body('mainImageUrl').optional().isURL().withMessage('Main image must be a valid URL'),
    body('videoUrl').optional().isURL().withMessage('Video URL must be a valid URL'),
    body('rewardTiers').custom((value) => {
      try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error('At least one reward tier is required');
        }
        return true;
      } catch (error) {
        throw new Error('Invalid reward tiers format');
      }
    })
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: errors.array()
        });
        return;
      }

      const userId = (req.user as JWTPayload)!.userId;
      const {
        title,
        tagline,
        description,
        story,
        categoryId,
        fundingGoal,
        minimumPledge = 1,
        fundingType,
        durationDays,
        location,
        mainImageUrl,
        videoUrl,
        rewardTiers
      } = req.body;

      // Convert category name to UUID (get category ID from database)
      let categoryUuid = categoryId;
      if (!categoryId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        // It's a category name, not UUID - find the UUID
        const { data: category, error: categoryError } = await supabase
          .from('categories')
          .select('id')
          .eq('name', categoryId)
          .single();

        if (categoryError || !category) {
          res.status(400).json({
            error: 'Validation Error',
            message: 'Invalid category name'
          });
          return;
        }
        categoryUuid = category.id;
      }

      // Parse reward tiers if it's a string
      let parsedRewardTiers = rewardTiers;
      if (typeof rewardTiers === 'string') {
        try {
          parsedRewardTiers = JSON.parse(rewardTiers);
        } catch (error) {
          res.status(400).json({
            error: 'Validation Error',
            message: 'Invalid reward tiers format'
          });
          return;
        }
      }

      // Handle file upload if present
      let imageUrl = mainImageUrl;
      if (req.file) {
        try {
          imageUrl = await uploadFile(req.file.buffer, 'campaign-images');
        } catch (uploadError) {
          console.error('File upload error:', uploadError);
          res.status(500).json({
            error: 'Upload Error',
            message: 'Failed to upload campaign image'
          });
          return;
        }
      }

      // Calculate dates
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + parseInt(durationDays));
      

      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          creator_id: userId,
          category_id: categoryUuid,
          title,
          tagline,
          description,
          story,
          funding_goal: parseFloat(fundingGoal),
          minimum_pledge: parseFloat(minimumPledge),
          funding_type: fundingType,
          duration_days: parseInt(durationDays),
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          location,
          main_image_url: imageUrl,
          video_url: videoUrl,
          status: 'active',
          published_at: startDate.toISOString()
        })
        .select()
        .single();

      if (campaignError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to create campaign'
        });
        return;
      }

      // Create reward tiers
      const rewardTierData = parsedRewardTiers.map((tier: any, index: number) => ({
        campaign_id: campaign.id,
        amount: parseFloat(tier.amount) || 0,
        title: tier.title?.trim() || '',
        description: tier.description?.trim() || '',
        estimated_delivery_date: tier.estimatedDeliveryDate || null,
        quantity_limit: tier.quantityLimit ? parseInt(tier.quantityLimit) : null,
        is_limited: tier.isLimited || false,
        display_order: index
      }));

      // Validate reward tier data
      const validRewardTiers = rewardTierData.filter((tier: any) => 
        tier.amount > 0 && tier.title && tier.description
      );
      
      if (validRewardTiers.length === 0) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'At least one valid reward tier is required'
        });
        return;
      }

      const { data: createdTiers, error: tiersError } = await supabase
        .from('reward_tiers')
        .insert(validRewardTiers)
        .select();

      if (tiersError) {
        console.error('Reward tiers error:', tiersError);
        // Rollback campaign creation
        await supabase.from('campaigns').delete().eq('id', campaign.id);
        
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to create reward tiers',
          details: tiersError.message
        });
        return;
      }

      res.status(201).json({
        message: 'Campaign created successfully',
        campaign: {
          ...campaign,
          reward_tiers: createdTiers
        }
      });

    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create campaign'
      });
      return;
    }
  }
);

/**
 * PUT /api/campaigns/:id
 * Updates a campaign (Creator Action)
 * PROTECTED ACCESS - Requires authentication and creator ownership
 */
router.put('/:id',
  authenticateToken,
  uploadSingle,
  handleUploadError,
  [
    body('title').optional().trim().isLength({ min: 1, max: 255 }),
    body('tagline').optional().trim().isLength({ min: 1, max: 500 }),
    body('description').optional().trim().isLength({ min: 1, max: 2000 }),
    body('story').optional().trim().isLength({ min: 1 }),
    body('location').optional().trim().isLength({ max: 255 }),
    body('mainImageUrl').optional().isURL(),
    body('videoUrl').optional().isURL()
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: errors.array()
        });
        return;
      }

      const campaignId = req.params.id;
      const userId = (req.user as JWTPayload)!.userId;

      // Verify campaign ownership
      const { data: existingCampaign, error: fetchError } = await supabase
        .from('campaigns')
        .select('creator_id, status')
        .eq('id', campaignId)
        .single();

      if (fetchError || !existingCampaign) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Campaign not found'
        });
        return;
      }

      if (existingCampaign.creator_id !== userId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You can only update your own campaigns'
        });
        return;
      }

      // Only allow updates to draft campaigns
      if (existingCampaign.status !== 'draft') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Only draft campaigns can be updated'
        });
        return;
      }

      const updateData = { ...req.body };
      
      // Handle file upload if present
      if (req.file) {
        try {
          const imageUrl = await uploadFile(req.file.buffer, 'campaign-images');
          updateData.mainImageUrl = imageUrl;
        } catch (uploadError) {
          console.error('File upload error:', uploadError);
          res.status(500).json({
            error: 'Upload Error',
            message: 'Failed to upload campaign image'
          });
          return;
        }
      }
      
      // Update campaign
      const { data: campaign, error: updateError } = await supabase
        .from('campaigns')
        .update(updateData)
        .eq('id', campaignId)
        .select()
        .single();

      if (updateError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to update campaign'
        });
        return;
      }

      res.json({
        message: 'Campaign updated successfully',
        campaign
      });

    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update campaign'
      });
      return;
    }
  }
);

/**
 * POST /api/campaigns/:id/update
 * Creates a new update post (Creator Action)
 * PROTECTED ACCESS - Requires authentication and creator ownership
 */
router.post('/:id/update',
  authenticateToken,
  [
    body('title').trim().isLength({ min: 1, max: 255 }).withMessage('Title is required'),
    body('content').trim().isLength({ min: 1, max: 5000 }).withMessage('Content is required'),
    body('imageUrl').optional().isURL().withMessage('Image URL must be valid'),
    body('isPublic').optional().isBoolean()
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: errors.array()
        });
        return;
      }

      const campaignId = req.params.id;
      const userId = (req.user as JWTPayload)!.userId;
      const { title, content, imageUrl, isPublic = true } = req.body;

      // Verify campaign ownership
      const { data: campaign, error: fetchError } = await supabase
        .from('campaigns')
        .select('creator_id')
        .eq('id', campaignId)
        .single();

      if (fetchError || !campaign) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Campaign not found'
        });
        return;
      }

      if (campaign.creator_id !== userId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You can only create updates for your own campaigns'
        });
        return;
      }

      // Create campaign update
      const { data: update, error: updateError } = await supabase
        .from('campaign_updates')
        .insert({
          campaign_id: campaignId,
          title,
          content,
          image_url: imageUrl,
          is_public: isPublic
        })
        .select()
        .single();

      if (updateError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to create campaign update'
        });
        return;
      }

      res.status(201).json({
        message: 'Campaign update created successfully',
        update
      });

    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create campaign update'
      });
      return;
    }
  }
);

/**
 * GET /api/campaigns/:id/comments
 * Retrieves all comments for a specific campaign
 * PUBLIC ACCESS - No authentication required
 */
router.get('/:id/comments',
  [
    param('id').isUUID().withMessage('Invalid campaign ID')
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request parameters',
          details: errors.array()
        });
        return;
      }

      const campaignId = req.params.id;

      // Check if campaign exists
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('id, title')
        .eq('id', campaignId)
        .single();

      if (campaignError || !campaign) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Campaign not found'
        });
        return;
      }

      // Fetch comments first
      const { data: comments, error: commentsError } = await supabase
        .from('campaign_comments')
        .select('id, content, created_at, updated_at, user_id')
        .eq('campaign_id', campaignId)
        .eq('is_public', true)
        .order('created_at', { ascending: true });

      if (commentsError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to retrieve comments'
        });
        return;
      }

      // Fetch user data for all commenters
      const userIds = [...new Set(comments?.map(c => c.user_id) || [])];
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, display_name, first_name, last_name, avatar_url')
        .in('id', userIds);

      if (usersError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to retrieve user data'
        });
        return;
      }

      // Create a map of user data for quick lookup
      const userMap = new Map(users?.map(user => [user.id, user]) || []);

      // Format the response
      const formattedComments = comments?.map(comment => {
        const user = userMap.get(comment.user_id);
        return {
          id: comment.id,
          content: comment.content,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
          user: {
            id: user?.id,
            display_name: user?.display_name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Anonymous User',
            avatar_url: user?.avatar_url
          }
        };
      }) || [];

      res.json({
        comments: formattedComments,
        campaign: {
          id: campaign.id,
          title: campaign.title
        }
      });

    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve comments'
      });
      return;
    }
  }
);

/**
 * POST /api/campaigns/:id/comments
 * Creates a new comment for a specific campaign
 * PROTECTED ACCESS - Requires authentication
 */
router.post('/:id/comments',
  authenticateToken,
  [
    param('id').isUUID().withMessage('Invalid campaign ID'),
    body('content').isString().isLength({ min: 1, max: 1000 }).withMessage('Comment content must be between 1 and 1000 characters')
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request parameters',
          details: errors.array()
        });
        return;
      }

      const campaignId = req.params.id;
      const userId = (req.user as JWTPayload)!.userId;
      const { content } = req.body;

      // Check if campaign exists
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('id, title')
        .eq('id', campaignId)
        .single();

      if (campaignError || !campaign) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Campaign not found'
        });
        return;
      }

      // Insert the new comment
      const { data: newComment, error: insertError } = await supabase
        .from('campaign_comments')
        .insert({
          campaign_id: campaignId,
          user_id: userId,
          content: content.trim(),
          is_public: true
        })
        .select('id, content, created_at, updated_at, user_id')
        .single();

      if (insertError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to create comment'
        });
        return;
      }

      // Fetch user data for the commenter
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, display_name, first_name, last_name, avatar_url')
        .eq('id', userId)
        .single();

      if (userError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to retrieve user data'
        });
        return;
      }

      // Format the response
      const formattedComment = {
        id: newComment.id,
        content: newComment.content,
        created_at: newComment.created_at,
        updated_at: newComment.updated_at,
        user: {
          id: user?.id,
          display_name: user?.display_name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Anonymous User',
          avatar_url: user?.avatar_url
        }
      };

      res.status(201).json({
        comment: formattedComment,
        message: 'Comment created successfully'
      });

    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create comment'
      });
      return;
    }
  }
);

/**
 * POST /api/campaigns/:id/send-tracking
 * Sends reward tracking emails to all backers
 * PROTECTED ACCESS - Requires authentication and creator ownership
 */
router.post('/:id/send-tracking',
  authenticateToken,
  requireCreator,
  [
    param('id').isUUID().withMessage('Invalid campaign ID'),
    body('trackingNumber').notEmpty().withMessage('Tracking number is required'),
    body('carrierName').notEmpty().withMessage('Carrier name is required'),
    body('trackingUrl').optional().isURL().withMessage('Tracking URL must be valid')
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: errors.array()
        });
        return;
      }

      const campaignId = req.params.id;
      const userId = (req.user as JWTPayload)!.userId;
      const { trackingNumber, carrierName, trackingUrl } = req.body;

      // Verify campaign exists and user is the creator
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('id, title, creator_id')
        .eq('id', campaignId)
        .eq('creator_id', userId)
        .single();

      if (campaignError || !campaign) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Campaign not found or you are not the creator'
        });
        return;
      }

      // Get all confirmed pledges for this campaign
      const { data: pledges, error: pledgesError } = await supabase
        .from('pledges')
        .select(`
          id,
          backer_id,
          users!backer_id(
            email,
            first_name,
            last_name
          )
        `)
        .eq('campaign_id', campaignId)
        .eq('status', 'confirmed');

      if (pledgesError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to retrieve pledges'
        });
        return;
      }

      if (!pledges || pledges.length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'No confirmed pledges found for this campaign'
        });
        return;
      }

      // Send tracking emails to all backers
      const emailPromises = pledges.map(async (pledge) => {
        const backer = Array.isArray(pledge.users) ? pledge.users[0] : pledge.users;
        if (backer && backer.email) {
          const trackingDetails = {
            campaignTitle: campaign.title,
            trackingNumber,
            carrierName,
            trackingUrl: trackingUrl || `https://www.google.com/search?q=${carrierName}+tracking+${trackingNumber}`,
            backerName: backer.first_name || 'Backer'
          };

          try {
            await sendRewardTracking(backer.email, trackingDetails);
            return { success: true, email: backer.email };
          } catch (error: any) {
            console.error(`Failed to send tracking email to ${backer.email}:`, error);
            return { success: false, email: backer.email, error: error.message };
          }
        }
        return { success: false, email: null, error: 'No email found' };
      });

      const results = await Promise.all(emailPromises);
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      res.json({
        message: `Tracking emails sent to ${successful} backers`,
        results: {
          total: pledges.length,
          successful,
          failed,
          details: results
        }
      });

    } catch (error) {
      console.error('Error sending tracking emails:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to send tracking emails'
      });
      return;
    }
  }
);

export default router;
