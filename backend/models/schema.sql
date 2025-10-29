-- =====================================================
-- WeRaise Crowdfunding Platform - PostgreSQL Schema
-- =====================================================
-- This schema supports all frontend features including:
-- - User authentication and profile management
-- - Campaign creation and management
-- - Pledge tracking and history
-- - Payment methods and transactions
-- - Notifications and updates
-- =====================================================

-- Enable UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. USER MANAGEMENT TABLES
-- =====================================================

-- Users table - Core user identity and authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- Made nullable for OAuth users
    google_id VARCHAR(255) UNIQUE, -- Google OAuth ID
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100),
    bio TEXT,
    avatar_url VARCHAR(500), -- Store Google profile picture
    location VARCHAR(255),
    is_creator BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,   
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    email_verification_expires TIMESTAMP WITH TIME ZONE,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- JWT tokens are stateless - no server-side session storage needed
-- JWT tokens contain: { userId, email, isCreator, exp, iat }
-- Token validation happens at the application level, not database level

-- Payment methods for backers (funding campaigns)
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('card', 'paypal', 'apple_pay', 'google_pay')),
    provider VARCHAR(50) NOT NULL, -- 'visa', 'mastercard', 'paypal', etc.
    last_four_digits VARCHAR(4) NOT NULL,
    expiry_month INTEGER,
    expiry_year INTEGER,
    cardholder_name VARCHAR(255),
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payout accounts for creators (receiving funds)
CREATE TABLE payout_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('bank_account', 'paypal')),
    bank_name VARCHAR(255),
    account_number_encrypted TEXT, -- Encrypted for security
    routing_number_encrypted TEXT, -- Encrypted for security
    account_holder_name VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. CAMPAIGN MANAGEMENT TABLES
-- =====================================================

-- Campaign categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon_name VARCHAR(50), -- Lucide React icon name (e.g., 'settings', 'book-open')
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default categories based on frontend
INSERT INTO categories (name, description, icon_name) VALUES
('Technology', 'Innovation and tech projects', 'settings'),
('Education', 'Learning and knowledge sharing', 'book-open'),
('Community', 'Local community initiatives', 'users'),
('Environment', 'Environmental and sustainability projects', 'leaf'),
('Arts & Culture', 'Creative and cultural projects', 'palette'),
('Wellness', 'Health and wellness initiatives', 'heart'),
('Food & Beverage', 'Culinary and beverage projects', 'utensils'),
('Fashion & Design', 'Fashion and design projects', 'shirt');

-- Campaigns table - Core project data
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id),
    title VARCHAR(255) NOT NULL,
    tagline VARCHAR(500),
    description TEXT NOT NULL,
    story TEXT NOT NULL,
    main_image_url VARCHAR(500),
    video_url VARCHAR(500),
    funding_goal DECIMAL(12,2) NOT NULL,
    minimum_pledge DECIMAL(10,2) DEFAULT 1.00,
    funding_type VARCHAR(20) NOT NULL CHECK (funding_type IN ('all-or-nothing', 'keep-it-all')),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'active', 'completed', 'failed', 'cancelled')),
    location VARCHAR(255),
    duration_days INTEGER NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE
);

-- Campaign media (additional images/videos)
CREATE TABLE campaign_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('image', 'video')),
    url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Reward tiers for campaigns
CREATE TABLE reward_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    estimated_delivery_date DATE,
    quantity_limit INTEGER,
    quantity_claimed INTEGER DEFAULT 0,
    is_limited BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Campaign updates (creator posts)
CREATE TABLE campaign_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    image_url VARCHAR(500),
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Campaign comments
CREATE TABLE campaign_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES campaign_comments(id) ON DELETE CASCADE, -- For replies
    content TEXT NOT NULL,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 3. PLEDGING AND TRANSACTIONS
-- =====================================================

-- Pledges table - Individual contributions
CREATE TABLE pledges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    backer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_tier_id UUID REFERENCES reward_tiers(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'refunded')),
    fulfillment_status VARCHAR(20) DEFAULT 'pending' CHECK (fulfillment_status IN ('pending', 'processing', 'shipped', 'delivered', 'delayed', 'refunded')),
    estimated_delivery_date DATE,
    shipping_address JSONB, -- Store shipping details
    paypal_order_id VARCHAR(255), -- PayPal order ID for transaction tracking
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE
);

-- Financial transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pledge_id UUID NOT NULL REFERENCES pledges(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('pledge', 'refund', 'payout', 'fee')),
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    payment_method_id UUID REFERENCES payment_methods(id),
    stripe_payment_intent_id VARCHAR(255),
    stripe_transfer_id VARCHAR(255),
    platform_fee DECIMAL(10,2) DEFAULT 0,
    processing_fee DECIMAL(10,2) DEFAULT 0,
    net_amount DECIMAL(12,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- 4. NOTIFICATIONS AND ALERTS
-- =====================================================

-- Notification preferences
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign_updates BOOLEAN DEFAULT TRUE,
    platform_news BOOLEAN DEFAULT TRUE,
    new_comments BOOLEAN DEFAULT TRUE,
    pledge_updates BOOLEAN DEFAULT TRUE,
    email_frequency VARCHAR(20) DEFAULT 'immediate' CHECK (email_frequency IN ('immediate', 'daily', 'weekly')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('campaign_update', 'pledge_update', 'comment', 'system')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    related_entity_type VARCHAR(50), -- 'campaign', 'pledge', 'comment'
    related_entity_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- 5. ANALYTICS AND TRACKING
-- =====================================================

-- Campaign analytics
CREATE TABLE campaign_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    views INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    pledges_count INTEGER DEFAULT 0,
    pledges_amount DECIMAL(12,2) DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(campaign_id, date)
);

-- User activity tracking
CREATE TABLE user_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN ('login', 'campaign_view', 'pledge_made', 'profile_update')),
    entity_type VARCHAR(50), -- 'campaign', 'user'
    entity_id UUID,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 6. INDEXES FOR PERFORMANCE
-- =====================================================

-- User indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_creator ON users(is_creator);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_last_login ON users(last_login);

-- Campaign indexes
CREATE INDEX idx_campaigns_creator ON campaigns(creator_id);
CREATE INDEX idx_campaigns_category ON campaigns(category_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_end_date ON campaigns(end_date);
CREATE INDEX idx_campaigns_created_at ON campaigns(created_at);

-- Pledge indexes
CREATE INDEX idx_pledges_campaign ON pledges(campaign_id);
CREATE INDEX idx_pledges_backer ON pledges(backer_id);
CREATE INDEX idx_pledges_status ON pledges(status);
CREATE INDEX idx_pledges_created_at ON pledges(created_at);

-- Transaction indexes
CREATE INDEX idx_transactions_pledge ON transactions(pledge_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

-- Notification indexes
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- =====================================================
-- 7. TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Update updated_at timestamp on users
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pledges_updated_at BEFORE UPDATE ON pledges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payout_accounts_updated_at BEFORE UPDATE ON payout_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. VIEWS FOR COMMON QUERIES
-- =====================================================

-- Campaign summary view
CREATE VIEW campaign_summary AS
SELECT 
    c.id,
    c.title,
    c.tagline,
    c.funding_goal,
    c.status,
    c.start_date,
    c.end_date,
    c.duration_days,
    u.display_name as creator_name,
    cat.name as category_name,
    COALESCE(SUM(p.amount), 0) as total_raised,
    COUNT(DISTINCT p.backer_id) as backer_count,
    COUNT(DISTINCT rt.id) as reward_tier_count,
    CASE 
        WHEN c.end_date < CURRENT_TIMESTAMP THEN 'expired'
        WHEN c.status = 'active' THEN 'active'
        ELSE c.status
    END as campaign_status
FROM campaigns c
LEFT JOIN users u ON c.creator_id = u.id
LEFT JOIN categories cat ON c.category_id = cat.id
LEFT JOIN pledges p ON c.id = p.campaign_id AND p.status = 'confirmed'
LEFT JOIN reward_tiers rt ON c.id = rt.campaign_id
GROUP BY c.id, c.title, c.tagline, c.funding_goal, c.status, c.start_date, c.end_date, c.duration_days, u.display_name, cat.name;

-- User pledge history view
CREATE VIEW user_pledge_history AS
SELECT 
    p.id as pledge_id,
    p.backer_id,
    p.amount,
    p.status,
    p.fulfillment_status,
    p.created_at as pledge_date,
    c.title as campaign_title,
    c.id as campaign_id,
    u.display_name as creator_name,
    rt.title as reward_tier_title,
    rt.estimated_delivery_date
FROM pledges p
JOIN campaigns c ON p.campaign_id = c.id
JOIN users u ON c.creator_id = u.id
LEFT JOIN reward_tiers rt ON p.reward_tier_id = rt.id
ORDER BY p.created_at DESC;

