import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { supabase } from '../db';
import { authenticateToken, requireCreator } from '../middleware/authMiddleware';
import { sendPledgeConfirmation } from '../utils/emailService';
import { JWTPayload } from '../utils/auth';
import { createPledgeOrder, capturePayment } from '../utils/paypal';

// =====================================================
// Pledge Routes
// =====================================================
// Handles pledge creation, management, and history.
// All routes require authentication due to financial nature.
// =====================================================

const router = Router();

// =====================================================
// PLEDGE CREATION AND MANAGEMENT (PROTECTED)
// =====================================================

/**
 * POST /api/pledges
 * Submits a new pledge (Financial Transaction)
 * PROTECTED ACCESS - Requires authentication
 */
router.post('/',
  authenticateToken,
  [
    body('campaignId').isUUID().withMessage('Valid campaign ID is required'),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be at least $1'),
    body('rewardTierId').optional().isUUID().withMessage('Reward tier ID must be valid'),
    body('shippingAddress').optional().isObject().withMessage('Shipping address must be an object'),
    body('shippingAddress.name').optional().trim().isLength({ min: 1 }),
    body('shippingAddress.street').optional().trim().isLength({ min: 1 }),
    body('shippingAddress.city').optional().trim().isLength({ min: 1 }),
    body('shippingAddress.state').optional().trim().isLength({ min: 2, max: 2 }),
    body('shippingAddress.zip').optional().trim().isLength({ min: 5, max: 10 }),
    body('shippingAddress.country').optional().trim().isLength({ min: 2, max: 2 })
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
      const { campaignId, amount, rewardTierId, shippingAddress } = req.body;

      // Verify campaign exists and is active
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('id, status, end_date, funding_goal, minimum_pledge')
        .eq('id', campaignId)
        .single();

      if (campaignError || !campaign) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Campaign not found'
        });
        return;
      }

      // Check if campaign is active
      if (campaign.status !== 'active') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Campaign is not accepting pledges'
        });
        return;
      }

      // Check if campaign has ended
      const now = new Date();
      const endDate = new Date(campaign.end_date);
      if (now > endDate) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Campaign has ended'
        });
        return;
      }

      // Validate minimum pledge amount
      if (amount < campaign.minimum_pledge) {
        res.status(400).json({
          error: 'Bad Request',
          message: `Minimum pledge amount is $${campaign.minimum_pledge}`
        });
        return;
      }

      // Verify reward tier if provided
      if (rewardTierId) {
        const { data: rewardTier, error: tierError } = await supabase
          .from('reward_tiers')
          .select('id, amount, quantity_limit, quantity_claimed')
          .eq('id', rewardTierId)
          .eq('campaign_id', campaignId)
          .single();

        if (tierError || !rewardTier) {
          res.status(404).json({
            error: 'Not Found',
            message: 'Reward tier not found'
          });
          return;
        }

        // Check if reward tier is available
        if (rewardTier.quantity_limit && rewardTier.quantity_claimed >= rewardTier.quantity_limit) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'Reward tier is sold out'
          });
          return;
        }

        // Validate pledge amount matches reward tier
        if (amount < rewardTier.amount) {
          res.status(400).json({
            error: 'Bad Request',
            message: `Pledge amount must be at least $${rewardTier.amount} for this reward tier`
          });
          return;
        }
      }

      // Check if user already has a pending pledge for this campaign
      const { data: existingPledge, error: existingError } = await supabase
        .from('pledges')
        .select('id, status')
        .eq('campaign_id', campaignId)
        .eq('backer_id', userId)
        .in('status', ['pending', 'confirmed'])
        .single();

      if (existingPledge && !existingError) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'You already have a pledge for this campaign'
        });
        return;
      }

      // Create pledge
      const { data: pledge, error: pledgeError } = await supabase
        .from('pledges')
        .insert({
          campaign_id: campaignId,
          backer_id: userId,
          reward_tier_id: rewardTierId,
          amount,
          status: 'pending',
          fulfillment_status: 'pending',
          shipping_address: shippingAddress,
          estimated_delivery_date: rewardTierId ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined
        })
        .select()
        .single();

      if (pledgeError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to create pledge'
        });
        return;
      }

      // Update reward tier quantity if applicable
      if (rewardTierId) {
        await supabase.rpc('increment_quantity_claimed', {
          tier_id: rewardTierId
        });
      }

      // Send pledge confirmation email
      try {
        // Get backer and campaign details for email
        const { data: backerData, error: backerError } = await supabase
          .from('users')
          .select('email, first_name, last_name')
          .eq('id', userId)
          .single();

        const { data: campaignData, error: campaignError } = await supabase
          .from('campaigns')
          .select('title')
          .eq('id', campaignId)
          .single();

        if (!backerError && !campaignError && backerData && campaignData) {
          const receiptDetails = {
            campaignTitle: campaignData.title,
            amount: parseFloat(amount),
            date: new Date().toLocaleDateString(),
            pledgeId: pledge.id,
            backerName: backerData.first_name || 'Backer'
          };

          await sendPledgeConfirmation(backerData.email, receiptDetails);
        }
      } catch (emailError) {
        // Log email error but don't fail the pledge creation
        console.error('Failed to send pledge confirmation email:', emailError);
      }

      res.status(201).json({
        message: 'Pledge created successfully',
        pledge
      });

    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create pledge'
      });
      return;
    }
  }
);

/**
 * GET /api/pledges/history
 * Retrieves complete list of pledges made by the current user
 * PROTECTED ACCESS - Requires authentication
 */
router.get('/history',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('status').optional().isIn(['pending', 'confirmed', 'cancelled', 'refunded'])
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

      const userId = (req.user as JWTPayload)!.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      const { status } = req.query;

      // Build query using basic select
      let query = supabase
        .from('pledges')
        .select('*')
        .eq('backer_id', userId);

      // Apply status filter
      if (status) {
        query = query.eq('status', status);
      }

      // Apply pagination and ordering
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data: pledges, error } = await query;

      if (error) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to retrieve pledge history'
        });
        return;
      }

      res.json({
        pledges,
        pagination: {
          page,
          limit,
          total: pledges.length
        }
      });

    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve pledge history'
      });
      return;
    }
  }
);

/**
 * GET /api/pledges/user-activity
 * Retrieves user activity summary for profile page
 * PROTECTED ACCESS - Requires authentication
 */
router.get('/user-activity',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = (req.user as JWTPayload)!.userId;

      // Get user's pledge history with campaign details
      const { data: pledges, error: pledgesError } = await supabase
        .from('pledges')
        .select(`
          id,
          amount,
          status,
          created_at,
          campaigns!campaign_id(
            id,
            title,
            status,
            end_date
          )
        `)
        .eq('backer_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (pledgesError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to retrieve user activity'
        });
        return;
      }

      // Get user's created campaigns
      const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select(`
          id,
          title,
          status,
          funding_goal,
          created_at,
          end_date
        `)
        .eq('creator_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (campaignsError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to retrieve user campaigns'
        });
        return;
      }

      // Calculate totals
      const totalPledged = pledges
        ?.filter(p => p.status === 'confirmed')
        ?.reduce((sum, pledge) => sum + parseFloat(pledge.amount), 0) || 0;

      const totalRaised = await Promise.all(
        campaigns.map(async (campaign) => {
          const { data: campaignPledges, error: campaignPledgesError } = await supabase
            .from('pledges')
            .select('amount')
            .eq('campaign_id', campaign.id)
            .eq('status', 'confirmed');

          if (campaignPledgesError) {
            return 0;
          }

          return campaignPledges?.reduce((sum, pledge) => sum + parseFloat(pledge.amount), 0) || 0;
        })
      );

      const totalRaisedSum = totalRaised.reduce((sum, amount) => sum + amount, 0);

      // Format pledge data for frontend
      const formattedPledges = pledges?.map(pledge => {
        const campaign = Array.isArray(pledge.campaigns) ? pledge.campaigns[0] : pledge.campaigns;
        return {
          id: pledge.id,
          title: campaign?.title || 'Unknown Campaign',
          date: new Date(pledge.created_at).toLocaleDateString(),
          status: campaign?.status === 'active' ? 'In Progress' : 
                  campaign?.status === 'completed' ? 'Reward Sent' : 'In Progress',
          amount: parseFloat(pledge.amount)
        };
      }) || [];

      // Format campaign data for frontend
      const formattedCampaigns = campaigns.map((campaign, index) => ({
        id: campaign.id,
        title: campaign.title,
        status: campaign.status === 'active' ? 'Active' :
                campaign.status === 'completed' ? 'Completed' :
                campaign.status === 'draft' ? 'Draft' : 'Active',
        raised: totalRaised[index] || 0,
        goal: parseFloat(campaign.funding_goal)
      }));

      res.json({
        backerActivity: {
          totalPledged,
          recentPledges: formattedPledges
        },
        creatorActivity: {
          totalRaised: totalRaisedSum,
          launchedCampaigns: formattedCampaigns
        }
      });

    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve user activity'
      });
      return;
    }
  }
);

/**
 * GET /api/pledges/campaign/:id
 * Retrieves all backers/pledges for a specific campaign (Creator View)
 * PROTECTED ACCESS - Requires authentication and creator ownership
 */
router.get('/campaign/:id',
  authenticateToken,
  requireCreator,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['pending', 'confirmed', 'cancelled', 'refunded'])
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

      const campaignId = req.params.id;
      const userId = (req.user as JWTPayload)!.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;
      const { status } = req.query;

      // Verify campaign ownership
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('creator_id')
        .eq('id', campaignId)
        .single();

      if (campaignError || !campaign) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Campaign not found'
        });
        return;
      }

      if (campaign.creator_id !== userId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You can only view pledges for your own campaigns'
        });
        return;
      }

      // Build query for pledges
      let query = supabase
        .from('pledges')
        .select(`
          *,
          backer:users!backer_id(id, display_name, email, avatar_url),
          reward_tier:reward_tiers(id, title, amount)
        `)
        .eq('campaign_id', campaignId);

      // Apply status filter
      if (status) {
        query = query.eq('status', status);
      }

      // Apply pagination and ordering
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data: pledges, error: pledgesError } = await query;

      if (pledgesError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to retrieve campaign pledges'
        });
        return;
      }

      // Get pledge statistics
      const { data: stats, error: statsError } = await supabase
        .from('pledges')
        .select('amount, status')
        .eq('campaign_id', campaignId);

      if (statsError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to retrieve pledge statistics'
        });
        return;
      }

      const totalRaised = stats
        ?.filter(p => p.status === 'confirmed')
        ?.reduce((sum, pledge) => sum + parseFloat(pledge.amount), 0) || 0;

      const confirmedCount = stats?.filter(p => p.status === 'confirmed').length || 0;
      const pendingCount = stats?.filter(p => p.status === 'pending').length || 0;

      res.json({
        pledges,
        statistics: {
          total_raised: totalRaised,
          confirmed_pledges: confirmedCount,
          pending_pledges: pendingCount,
          total_pledges: stats?.length || 0
        },
        pagination: {
          page,
          limit,
          total: pledges.length
        }
      });

    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve campaign pledges'
      });
      return;
    }
  }
);

/**
 * GET /api/pledges/creator/all
 * Retrieves all backers/pledges for all campaigns created by the logged-in user
 * PROTECTED ACCESS - Requires authentication and creator role
 */
router.get('/creator/all',
  authenticateToken,
  requireCreator,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['pending', 'confirmed', 'cancelled', 'refunded']),
    query('campaignId').optional().isUUID()
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

      const userId = (req.user as JWTPayload)!.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;
      const { status, campaignId } = req.query;

      // Build query for pledges from all creator's campaigns
      let query = supabase
        .from('pledges')
        .select(`
          *,
          backer:users!backer_id(id, display_name, email, avatar_url),
          reward_tier:reward_tiers(id, title, amount),
          campaign:campaigns!campaign_id(id, title, status, creator_id)
        `)
        .eq('campaign.creator_id', userId);

      // Apply campaign filter if specified
      if (campaignId) {
        query = query.eq('campaign_id', campaignId);
      }

      // Apply status filter
      if (status) {
        query = query.eq('status', status);
      }

      // Apply pagination and ordering
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data: pledges, error: pledgesError } = await query;

      if (pledgesError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to retrieve creator pledges'
        });
        return;
      }

      // Get pledge statistics for all creator's campaigns
      const { data: creatorCampaigns, error: creatorCampaignsError } = await supabase
        .from('campaigns')
        .select('id')
        .eq('creator_id', userId);

      if (creatorCampaignsError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to retrieve creator campaigns'
        });
        return;
      }

      const campaignIds = creatorCampaigns?.map(c => c.id) || [];

      const { data: stats, error: statsError } = await supabase
        .from('pledges')
        .select('amount, status, campaign_id, fulfillment_status')
        .in('campaign_id', campaignIds);

      if (statsError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to retrieve pledge statistics'
        });
        return;
      }

      const totalRaised = stats
        ?.filter(p => p.status === 'confirmed')
        ?.reduce((sum, pledge) => sum + parseFloat(pledge.amount), 0) || 0;

      const confirmedCount = stats?.filter(p => p.status === 'confirmed').length || 0;
      const pendingCount = stats?.filter(p => p.status === 'pending').length || 0;
      const pendingFulfillmentCount = stats?.filter(p => 
        p.status === 'confirmed' && 
        (p.fulfillment_status === 'pending' || p.fulfillment_status === 'processing' || p.fulfillment_status === 'delayed')
      ).length || 0;

      // Get unique campaigns for filtering
      const { data: campaigns, error: campaignsListError } = await supabase
        .from('campaigns')
        .select('id, title, status')
        .eq('creator_id', userId)
        .order('title');

      if (campaignsListError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to retrieve campaigns'
        });
        return;
      }

      res.json({
        pledges,
        campaigns,
        statistics: {
          total_raised: totalRaised,
          confirmed_pledges: confirmedCount,
          pending_pledges: pendingCount,
          pending_fulfillment: pendingFulfillmentCount,
          total_pledges: stats?.length || 0
        },
        pagination: {
          page,
          limit,
          total: pledges.length
        }
      });

    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve creator pledges'
      });
      return;
    }
  }
);

/**
 * PUT /api/pledges/:id
 * Manages/updates a specific pledge
 * PROTECTED ACCESS - Requires authentication
 */
router.put('/:id',
  authenticateToken,
  [
    body('status').optional().isIn(['pending', 'confirmed', 'cancelled', 'refunded']),
    body('fulfillmentStatus').optional().isIn(['pending', 'processing', 'shipped', 'delivered', 'delayed', 'refunded']),
    body('shippingAddress').optional().isObject(),
    body('estimatedDeliveryDate').optional().isISO8601()
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

      const pledgeId = req.params.id;
      const userId = (req.user as JWTPayload)!.userId;
      const { status, fulfillmentStatus, shippingAddress, estimatedDeliveryDate } = req.body;

      // Get existing pledge
      const { data: existingPledge, error: fetchError } = await supabase
        .from('pledges')
        .select(`
          *,
          campaign:campaigns!campaign_id(creator_id, status)
        `)
        .eq('id', pledgeId)
        .single();

      if (fetchError || !existingPledge) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Pledge not found'
        });
        return;
      }

      // Check permissions
      const isOwner = existingPledge.backer_id === userId;
      const isCreator = existingPledge.campaign.creator_id === userId;

      if (!isOwner && !isCreator) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You can only update your own pledges or pledges for your campaigns'
        });
        return;
      }

      // Build update data
      const updateData: any = {};
      
      if (status !== undefined) {
        // Only creators can change pledge status to confirmed
        if (status === 'confirmed' && !isCreator) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'Only campaign creators can confirm pledges'
          });
          return;
        }
        
        // Only backers can cancel their own pledges
        if (status === 'cancelled' && !isOwner) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'Only pledge owners can cancel pledges'
          });
          return;
        }
        
        updateData.status = status;
        
        if (status === 'confirmed') {
          updateData.confirmed_at = new Date().toISOString();
        } else if (status === 'cancelled') {
          updateData.cancelled_at = new Date().toISOString();
        }
      }

      if (fulfillmentStatus !== undefined && isCreator) {
        updateData.fulfillment_status = fulfillmentStatus;
      }

      if (shippingAddress !== undefined && isCreator) {
        updateData.shipping_address = shippingAddress;
      }

      if (estimatedDeliveryDate !== undefined && isCreator) {
        updateData.estimated_delivery_date = estimatedDeliveryDate;
      }

      // Update pledge
      const { data: updatedPledge, error: updateError } = await supabase
        .from('pledges')
        .update(updateData)
        .eq('id', pledgeId)
        .select()
        .single();

      if (updateError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to update pledge'
        });
        return;
      }

      res.json({
        message: 'Pledge updated successfully',
        pledge: updatedPledge
      });

    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update pledge'
      });
      return;
    }
  }
);

// =====================================================
// PAYPAL PAYMENT ROUTES
// =====================================================

/**
 * POST /api/pledges/paypal/create-order
 * Creates a PayPal order for pledge payment
 * PROTECTED ACCESS - Requires authentication
 */
router.post('/paypal/create-order',
  authenticateToken,
  [
    body('campaignId').isUUID().withMessage('Valid campaign ID is required'),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be at least $1'),
    body('rewardTierId').optional({ nullable: true }).isUUID().withMessage('Reward tier ID must be valid')
  ],
  async (req: Request, res: Response) => {
    try {
      // Debug logging
      console.log('PayPal create order request body:', req.body);
      
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
      const { campaignId, amount, rewardTierId } = req.body;

      // Verify campaign exists and is active
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('id, title, status, end_date, funding_goal, minimum_pledge')
        .eq('id', campaignId)
        .single();

      if (campaignError || !campaign) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Campaign not found'
        });
        return;
      }

      // Check if campaign is active
      if (campaign.status !== 'active') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Campaign is not accepting pledges'
        });
        return;
      }

      // Check if campaign has ended
      const now = new Date();
      const endDate = new Date(campaign.end_date);
      if (now > endDate) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Campaign has ended'
        });
        return;
      }

      // Validate minimum pledge amount
      if (amount < campaign.minimum_pledge) {
        res.status(400).json({
          error: 'Bad Request',
          message: `Minimum pledge amount is $${campaign.minimum_pledge}`
        });
        return;
      }

      // Verify reward tier if provided
      if (rewardTierId) {
        const { data: rewardTier, error: tierError } = await supabase
          .from('reward_tiers')
          .select('id, amount, quantity_limit, quantity_claimed')
          .eq('id', rewardTierId)
          .eq('campaign_id', campaignId)
          .single();

        if (tierError || !rewardTier) {
          res.status(404).json({
            error: 'Not Found',
            message: 'Reward tier not found'
          });
          return;
        }

        // Check if reward tier is available
        if (rewardTier.quantity_limit && rewardTier.quantity_claimed >= rewardTier.quantity_limit) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'Reward tier is sold out'
          });
          return;
        }

        // Validate pledge amount matches reward tier
        if (amount < rewardTier.amount) {
          res.status(400).json({
            error: 'Bad Request',
            message: `Pledge amount must be at least $${rewardTier.amount} for this reward tier`
          });
          return;
        }
      }

      // Check if user already has a confirmed pledge for this campaign
      const { data: existingConfirmedPledge, error: existingError } = await supabase
        .from('pledges')
        .select('id, status')
        .eq('campaign_id', campaignId)
        .eq('backer_id', userId)
        .eq('status', 'confirmed')
        .single();

      if (existingConfirmedPledge && !existingError) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'You already have a confirmed pledge for this campaign'
        });
        return;
      }

      // Check for existing pending pledge and clean it up if it's old (older than 30 minutes)
      const { data: existingPendingPledge } = await supabase
        .from('pledges')
        .select('id, created_at')
        .eq('campaign_id', campaignId)
        .eq('backer_id', userId)
        .eq('status', 'pending')
        .single();

      if (existingPendingPledge) {
        const createdAt = new Date(existingPendingPledge.created_at);
        const now = new Date();
        const timeDiff = now.getTime() - createdAt.getTime();
        const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds

        // If pending pledge is older than 30 minutes, clean it up
        if (timeDiff > thirtyMinutes) {
          console.log(`Cleaning up old pending pledge: ${existingPendingPledge.id}`);
          await supabase
            .from('pledges')
            .delete()
            .eq('id', existingPendingPledge.id);
        } else {
          // If pending pledge is recent, create a new PayPal order for it
          const pledge = existingPendingPledge;
          
          // Generate PayPal URLs
          const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          const returnUrl = `${baseUrl}/pledge/success?pledgeId=${pledge.id}`;
          const cancelUrl = `${baseUrl}/pledge/cancel?pledgeId=${pledge.id}`;

          // Create PayPal order for existing pledge
          let paypalOrder;
          try {
            paypalOrder = await createPledgeOrder({
              amount,
              currency: 'USD', // Always use USD
              campaignTitle: campaign.title,
              pledgeId: pledge.id,
              returnUrl,
              cancelUrl
            });
          } catch (paypalError: any) {
            console.error('PayPal order creation failed for existing pledge:', paypalError);
            res.status(400).json({
              error: 'PayPal Order Creation Failed',
              message: paypalError.message || 'Failed to create PayPal order',
              details: paypalError.message
            });
            return;
          }

          res.status(201).json({
            orderID: paypalOrder.orderId,
            pledgeId: pledge.id,
            approvalUrl: paypalOrder.approvalUrl
          });
          return;
        }
      }

      // Create a temporary pledge record first
      const { data: pledge, error: pledgeError } = await supabase
        .from('pledges')
        .insert({
          campaign_id: campaignId,
          backer_id: userId,
          reward_tier_id: rewardTierId,
          amount,
          status: 'pending',
          fulfillment_status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (pledgeError) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to create pledge record'
        });
        return;
      }

      // Generate PayPal URLs
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const returnUrl = `${baseUrl}/pledge/success?pledgeId=${pledge.id}`;
      const cancelUrl = `${baseUrl}/pledge/cancel?pledgeId=${pledge.id}`;

      // Create PayPal order
      let paypalOrder;
      try {
        paypalOrder = await createPledgeOrder({
          amount,
          currency: 'USD', // Always use USD
          campaignTitle: campaign.title,
          pledgeId: pledge.id,
          returnUrl,
          cancelUrl
        });
      } catch (paypalError: any) {
        console.error('PayPal order creation failed:', paypalError);
        // Clean up the pledge if PayPal order creation fails
        await supabase
          .from('pledges')
          .delete()
          .eq('id', pledge.id);
        
        res.status(400).json({
          error: 'PayPal Order Creation Failed',
          message: paypalError.message || 'Failed to create PayPal order',
          details: paypalError.message
        });
        return;
      }

      res.status(201).json({
        orderID: paypalOrder.orderId,
        pledgeId: pledge.id,
        approvalUrl: paypalOrder.approvalUrl
      });

    } catch (error) {
      console.error('PayPal create order error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create PayPal order'
      });
      return;
    }
  }
);

/**
 * POST /api/pledges/paypal/capture-order
 * Captures PayPal payment and finalizes the pledge
 * PROTECTED ACCESS - Requires authentication
 */
router.post('/paypal/capture-order',
  authenticateToken,
  [
    body('orderId').notEmpty().withMessage('PayPal order ID is required'),
    body('pledgeId').isUUID().withMessage('Valid pledge ID is required')
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
      const { orderId, pledgeId } = req.body;

      // Verify pledge exists and belongs to user
      const { data: pledge, error: pledgeError } = await supabase
        .from('pledges')
        .select(`
          *,
          campaign:campaigns!campaign_id(title, creator_id),
          backer:users!backer_id(email, first_name, last_name)
        `)
        .eq('id', pledgeId)
        .eq('backer_id', userId)
        .single();

      if (pledgeError || !pledge) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Pledge not found'
        });
        return;
      }

      // Check if pledge is still pending
      if (pledge.status !== 'pending') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Pledge has already been processed'
        });
        return;
      }

      // Capture PayPal payment
      let captureResult;
      try {
        captureResult = await capturePayment(orderId);
      } catch (error: any) {
        console.error('PayPal capture error:', error);
        res.status(400).json({
          error: 'Payment Capture Failed',
          message: error.message || 'Failed to capture PayPal payment',
          details: error.message
        });
        return;
      }

      // Additional validation - verify the captured amount matches the pledge amount
      try {
        const capturedAmount = parseFloat(captureResult.purchase_units[0].payments.captures[0].amount.value);
        const expectedAmount = parseFloat(pledge.amount);
        
        if (Math.abs(capturedAmount - expectedAmount) > 0.01) { // Allow for small rounding differences
          console.error(`Amount mismatch: expected ${expectedAmount}, captured ${capturedAmount}`);
          res.status(400).json({
            error: 'Payment Verification Failed',
            message: 'Captured amount does not match pledge amount',
            details: {
              expected: expectedAmount,
              captured: capturedAmount
            }
          });
          return;
        }
      } catch (validationError: any) {
        console.error('Amount validation error:', validationError);
        // Continue with the payment even if amount validation fails
        // This is to handle edge cases where PayPal response structure might be different
      }

      // Start database transaction
      const { error: updateError } = await supabase
        .from('pledges')
        .update({
          status: 'confirmed',
          paypal_order_id: orderId,
          confirmed_at: new Date().toISOString()
        })
        .eq('id', pledgeId);

      if (updateError) {
        console.error('Failed to update pledge:', updateError);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to confirm pledge'
        });
        return;
      }

      // Update reward tier quantity if applicable
      if (pledge.reward_tier_id) {
        await supabase.rpc('increment_quantity_claimed', {
          tier_id: pledge.reward_tier_id
        });
      }

      // Send pledge confirmation email
      try {
        const receiptDetails = {
          campaignTitle: pledge.campaign.title,
          amount: parseFloat(pledge.amount),
          date: new Date().toLocaleDateString(),
          pledgeId: pledge.id,
          backerName: pledge.backer.first_name || 'Backer'
        };

        await sendPledgeConfirmation(pledge.backer.email, receiptDetails);
      } catch (emailError) {
        // Log email error but don't fail the pledge confirmation
        console.error('Failed to send pledge confirmation email:', emailError);
      }

      res.status(200).json({
        message: 'Payment captured successfully',
        pledge: {
          id: pledge.id,
          amount: pledge.amount,
          status: 'confirmed',
          paypalOrderId: orderId
        },
        captureResult: {
          status: captureResult.status,
          amount: captureResult.purchase_units?.[0]?.payments?.captures?.[0]?.amount
        }
      });

    } catch (error) {
      console.error('PayPal capture order error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to capture PayPal payment'
      });
      return;
    }
  }
);

/**
 * POST /api/pledges/paypal/cancel-order
 * Handles cancelled PayPal payments and cleans up pending pledges
 * PROTECTED ACCESS - Requires authentication
 */
router.post('/paypal/cancel-order',
  authenticateToken,
  [
    body('pledgeId').isUUID().withMessage('Valid pledge ID is required')
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
      const { pledgeId } = req.body;

      // Verify pledge exists and belongs to user
      const { data: pledge, error: pledgeError } = await supabase
        .from('pledges')
        .select('id, status, backer_id')
        .eq('id', pledgeId)
        .eq('backer_id', userId)
        .single();

      if (pledgeError || !pledge) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Pledge not found'
        });
        return;
      }

      // Only cancel if still pending
      if (pledge.status === 'pending') {
        const { error: deleteError } = await supabase
          .from('pledges')
          .delete()
          .eq('id', pledgeId);

        if (deleteError) {
          console.error('Failed to delete cancelled pledge:', deleteError);
          res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to cancel pledge'
          });
          return;
        }
      }

      res.status(200).json({
        message: 'Payment cancelled successfully',
        pledgeId: pledgeId
      });

    } catch (error) {
      console.error('PayPal cancel order error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to cancel PayPal payment'
      });
      return;
    }
  }
);

/**
 * GET /api/pledges/paypal/test
 * Test PayPal connection and configuration
 * PROTECTED ACCESS - Requires authentication
 */
router.get('/paypal/test',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { testPayPalConnection } = await import('../utils/paypal');
      const isConnected = await testPayPalConnection();
      
      if (isConnected) {
        res.status(200).json({
          message: 'PayPal connection test successful',
          status: 'connected',
          environment: process.env.PAYPAL_ENVIRONMENT || 'sandbox'
        });
      } else {
        res.status(500).json({
          message: 'PayPal connection test failed',
          status: 'disconnected',
          environment: process.env.PAYPAL_ENVIRONMENT || 'sandbox'
        });
      }
    } catch (error: any) {
      console.error('PayPal test error:', error);
      res.status(500).json({
        error: 'PayPal Test Failed',
        message: error.message || 'Failed to test PayPal connection'
      });
    }
  }
);

export default router;
