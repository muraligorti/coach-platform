-- ================================================================
-- COACH-CLIENT ENGAGEMENT PLATFORM - DATABASE SCHEMA (AZURE COMPATIBLE)
-- PostgreSQL 14+ for Azure Flexible Server
-- Multi-tenant | Secure | Auditable | Extensible
-- ================================================================

-- Note: Azure PostgreSQL doesn't allow uuid-ossp extension for regular users
-- We'll use gen_random_uuid() which is built-in to PostgreSQL 13+

-- ================================================================
-- CORE TABLES
-- ================================================================

-- Organizations (Multi-tenant root)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('fitness', 'wellness', 'nutrition', 'tuition', 'skill_coaching')),
    subscription_plan VARCHAR(50) DEFAULT 'free' CHECK (subscription_plan IN ('free', 'basic', 'premium', 'enterprise')),
    branding JSONB DEFAULT '{}'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_organizations_category ON organizations(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_active ON organizations(is_active) WHERE deleted_at IS NULL;

-- Users (Coaches, Clients, Admins)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    phone_country_code VARCHAR(5) DEFAULT '+91',
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('platform_admin', 'org_owner', 'coach', 'client')),
    password_hash VARCHAR(255),
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    preferences JSONB DEFAULT '{}'::jsonb,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_users_org ON users(primary_org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_phone ON users(phone) WHERE deleted_at IS NULL;

-- User-Organization Relationships
CREATE TABLE user_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role_in_org VARCHAR(50) NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, org_id)
);

CREATE INDEX idx_user_orgs_user ON user_organizations(user_id);
CREATE INDEX idx_user_orgs_org ON user_organizations(org_id);

-- ================================================================
-- AUTHENTICATION & SESSIONS
-- ================================================================

-- OTP Verification
CREATE TABLE otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) NOT NULL,
    phone_country_code VARCHAR(5) DEFAULT '+91',
    otp_code VARCHAR(6) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    purpose VARCHAR(50) NOT NULL CHECK (purpose IN ('login', 'signup', 'verify_phone', 'password_reset')),
    is_verified BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    attempts INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_otp_phone ON otp_verifications(phone, is_verified, expires_at);

-- Refresh Tokens
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    device_info JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash) WHERE revoked_at IS NULL;

-- ================================================================
-- SESSION MANAGEMENT
-- ================================================================

-- Session Templates
CREATE TABLE session_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    session_type VARCHAR(50),
    duration_minutes INT DEFAULT 60,
    structure JSONB DEFAULT '{}'::jsonb,
    content_refs JSONB DEFAULT '[]'::jsonb,
    default_location VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_session_templates_org ON session_templates(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_session_templates_active ON session_templates(is_active) WHERE deleted_at IS NULL;

-- Scheduled Sessions
CREATE TABLE scheduled_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    session_template_id UUID REFERENCES session_templates(id) ON DELETE SET NULL,
    coach_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INT DEFAULT 60,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
    location VARCHAR(255),
    meeting_link TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    cancelled_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_sessions_org ON scheduled_sessions(org_id);
CREATE INDEX idx_scheduled_sessions_coach ON scheduled_sessions(coach_id, scheduled_at);
CREATE INDEX idx_scheduled_sessions_client ON scheduled_sessions(client_id, scheduled_at);
CREATE INDEX idx_scheduled_sessions_status ON scheduled_sessions(status);
CREATE INDEX idx_scheduled_sessions_date ON scheduled_sessions(scheduled_at);

-- ================================================================
-- CONTENT & MEDIA
-- ================================================================

-- Media Assets
CREATE TABLE media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    storage_provider VARCHAR(50) DEFAULT 'azure_blob',
    file_name VARCHAR(255) NOT NULL,
    media_type VARCHAR(50) NOT NULL CHECK (media_type IN ('video', 'image', 'document', 'audio')),
    mime_type VARCHAR(100),
    file_size_bytes BIGINT,
    duration_seconds INT,
    thumbnail_path TEXT,
    is_encrypted BOOLEAN DEFAULT true,
    encryption_key_id VARCHAR(255),
    access_level VARCHAR(50) DEFAULT 'private' CHECK (access_level IN ('private', 'org', 'public')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_media_org ON media_assets(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_media_owner ON media_assets(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_media_type ON media_assets(media_type) WHERE deleted_at IS NULL;

-- Content Library
CREATE TABLE content_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content_type VARCHAR(50) CHECK (content_type IN ('workout_plan', 'nutrition_guide', 'study_material', 'skill_tutorial')),
    media_asset_ids JSONB DEFAULT '[]'::jsonb,
    tags JSONB DEFAULT '[]'::jsonb,
    is_published BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_content_org ON content_library(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_content_published ON content_library(is_published) WHERE deleted_at IS NULL;

-- ================================================================
-- PROGRESS TRACKING
-- ================================================================

-- Progress Entries
CREATE TABLE progress_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES scheduled_sessions(id) ON DELETE SET NULL,
    entry_type VARCHAR(50) NOT NULL CHECK (entry_type IN ('photo', 'video', 'measurement', 'note', 'achievement')),
    payload JSONB NOT NULL,
    media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    visibility VARCHAR(50) DEFAULT 'coach_only' CHECK (visibility IN ('private', 'coach_only', 'shared')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_progress_org ON progress_entries(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_progress_client ON progress_entries(client_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_progress_session ON progress_entries(session_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_progress_type ON progress_entries(entry_type) WHERE deleted_at IS NULL;

-- ================================================================
-- GRADING SYSTEM
-- ================================================================

-- Session Grades
CREATE TABLE session_grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES scheduled_sessions(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    grade_value VARCHAR(10) NOT NULL,
    numeric_score DECIMAL(5,2),
    comments TEXT,
    criteria_scores JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, client_id)
);

CREATE INDEX idx_session_grades_client ON session_grades(client_id);
CREATE INDEX idx_session_grades_session ON session_grades(session_id);

-- Skill Grades
CREATE TABLE skill_grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_key VARCHAR(100) NOT NULL,
    skill_name VARCHAR(255) NOT NULL,
    grade_value VARCHAR(10) NOT NULL,
    numeric_score DECIMAL(5,2),
    rationale TEXT,
    evidence JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, client_id, skill_key)
);

CREATE INDEX idx_skill_grades_client ON skill_grades(client_id);
CREATE INDEX idx_skill_grades_org ON skill_grades(org_id);

-- Overall Grades
CREATE TABLE overall_grades (
    client_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    grade_value VARCHAR(10) NOT NULL,
    numeric_score DECIMAL(5,2),
    explanation TEXT,
    computed_from JSONB DEFAULT '{}'::jsonb,
    last_updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_overall_grades_org ON overall_grades(org_id);

-- ================================================================
-- PAYMENTS & BILLING
-- ================================================================

-- Payment Plans
CREATE TABLE payment_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    billing_cycle VARCHAR(50) CHECK (billing_cycle IN ('one_time', 'monthly', 'quarterly', 'yearly')),
    session_count INT,
    validity_days INT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_payment_plans_org ON payment_plans(org_id) WHERE deleted_at IS NULL;

-- Client Subscriptions
CREATE TABLE client_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payment_plan_id UUID REFERENCES payment_plans(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
    start_date DATE NOT NULL,
    end_date DATE,
    sessions_remaining INT,
    auto_renew BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_client ON client_subscriptions(client_id);
CREATE INDEX idx_subscriptions_org ON client_subscriptions(org_id);
CREATE INDEX idx_subscriptions_status ON client_subscriptions(status);

-- Payment Transactions
CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES client_subscriptions(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    payment_method VARCHAR(50) CHECK (payment_method IN ('razorpay', 'stripe', 'cash', 'bank_transfer', 'upi')),
    payment_gateway_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
    metadata JSONB DEFAULT '{}'::jsonb,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_client ON payment_transactions(client_id);
CREATE INDEX idx_transactions_org ON payment_transactions(org_id);
CREATE INDEX idx_transactions_status ON payment_transactions(status);
CREATE INDEX idx_transactions_date ON payment_transactions(paid_at DESC);

-- ================================================================
-- MESSAGING & WHATSAPP
-- ================================================================

-- Message Queue
CREATE TABLE message_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipient_phone VARCHAR(20),
    recipient_email VARCHAR(255),
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email')),
    message_type VARCHAR(50),
    message_template VARCHAR(100),
    message_content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'delivered')),
    provider_message_id VARCHAR(255),
    scheduled_for TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_reason TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_org ON message_queue(org_id);
CREATE INDEX idx_messages_recipient ON message_queue(recipient_id);
CREATE INDEX idx_messages_status ON message_queue(status);
CREATE INDEX idx_messages_scheduled ON message_queue(scheduled_for) WHERE status = 'queued';

-- WhatsApp Conversations
CREATE TABLE whatsapp_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    message_direction VARCHAR(10) CHECK (message_direction IN ('inbound', 'outbound')),
    message_text TEXT,
    detected_intent VARCHAR(100),
    intent_confidence DECIMAL(3,2),
    extracted_entities JSONB DEFAULT '{}'::jsonb,
    suggested_action VARCHAR(100),
    ai_model_used VARCHAR(50),
    provider_message_id VARCHAR(255),
    received_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_org ON whatsapp_conversations(org_id);
CREATE INDEX idx_whatsapp_user ON whatsapp_conversations(user_id);
CREATE INDEX idx_whatsapp_date ON whatsapp_conversations(received_at DESC);

-- ================================================================
-- FEEDBACK & RATINGS
-- ================================================================

-- Feedback Responses
CREATE TABLE feedback_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    respondent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_type VARCHAR(50) NOT NULL CHECK (subject_type IN ('session', 'coach', 'organization', 'content')),
    subject_id UUID NOT NULL,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comments TEXT,
    sentiment VARCHAR(50),
    is_anonymous BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_org ON feedback_responses(org_id);
CREATE INDEX idx_feedback_subject ON feedback_responses(subject_type, subject_id);
CREATE INDEX idx_feedback_rating ON feedback_responses(rating);

-- ================================================================
-- REFERRAL SYSTEM
-- ================================================================

-- Referral Invites
CREATE TABLE referral_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referee_contact VARCHAR(255) NOT NULL,
    referee_name VARCHAR(255),
    invite_code VARCHAR(20) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'converted', 'expired')),
    referred_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reward_type VARCHAR(50),
    reward_value DECIMAL(10,2),
    reward_claimed BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_referrals_org ON referral_invites(org_id);
CREATE INDEX idx_referrals_referrer ON referral_invites(referrer_id);
CREATE INDEX idx_referrals_code ON referral_invites(invite_code);
CREATE INDEX idx_referrals_status ON referral_invites(status);

-- ================================================================
-- COMMUNITY & COLLABORATION
-- ================================================================

-- Communities
CREATE TABLE communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    scope VARCHAR(50) CHECK (scope IN ('public', 'coaches_only', 'org_specific', 'invite_only')),
    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    member_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_communities_scope ON communities(scope) WHERE is_active = true;
CREATE INDEX idx_communities_org ON communities(org_id) WHERE is_active = true;

-- Community Members
CREATE TABLE community_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(community_id, user_id)
);

CREATE INDEX idx_community_members_community ON community_members(community_id);
CREATE INDEX idx_community_members_user ON community_members(user_id);

-- Community Posts
CREATE TABLE community_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    media_asset_ids JSONB DEFAULT '[]'::jsonb,
    post_type VARCHAR(50) DEFAULT 'discussion' CHECK (post_type IN ('discussion', 'question', 'announcement', 'resource')),
    metadata JSONB DEFAULT '{}'::jsonb,
    is_pinned BOOLEAN DEFAULT false,
    like_count INT DEFAULT 0,
    comment_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_posts_community ON community_posts(community_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_author ON community_posts(author_id) WHERE deleted_at IS NULL;

-- ================================================================
-- AUDIT & TRACEABILITY
-- ================================================================

-- Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    before_state JSONB,
    after_state JSONB,
    source VARCHAR(50),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_org ON audit_logs(org_id, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);

-- ================================================================
-- SYSTEM CONFIGURATION
-- ================================================================

-- System Settings
CREATE TABLE system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- FUNCTIONS & TRIGGERS
-- ================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_session_templates_updated_at BEFORE UPDATE ON session_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scheduled_sessions_updated_at BEFORE UPDATE ON scheduled_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_media_assets_updated_at BEFORE UPDATE ON media_assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_content_library_updated_at BEFORE UPDATE ON content_library FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_progress_entries_updated_at BEFORE UPDATE ON progress_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_session_grades_updated_at BEFORE UPDATE ON session_grades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_skill_grades_updated_at BEFORE UPDATE ON skill_grades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_overall_grades_updated_at BEFORE UPDATE ON overall_grades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_plans_updated_at BEFORE UPDATE ON payment_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_client_subscriptions_updated_at BEFORE UPDATE ON client_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_message_queue_updated_at BEFORE UPDATE ON message_queue FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_feedback_responses_updated_at BEFORE UPDATE ON feedback_responses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_referral_invites_updated_at BEFORE UPDATE ON referral_invites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_communities_updated_at BEFORE UPDATE ON communities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_community_posts_updated_at BEFORE UPDATE ON community_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- VIEWS
-- ================================================================

-- Active Clients per Organization
CREATE OR REPLACE VIEW v_active_clients AS
SELECT 
    o.id as org_id,
    o.name as org_name,
    COUNT(DISTINCT u.id) as active_client_count
FROM organizations o
LEFT JOIN users u ON u.primary_org_id = o.id AND u.role = 'client' AND u.is_active = true
WHERE o.deleted_at IS NULL AND o.is_active = true
GROUP BY o.id, o.name;

-- Upcoming Sessions
CREATE OR REPLACE VIEW v_upcoming_sessions AS
SELECT 
    ss.id,
    ss.org_id,
    o.name as org_name,
    ss.coach_id,
    coach.full_name as coach_name,
    ss.client_id,
    client.full_name as client_name,
    st.name as session_template_name,
    ss.scheduled_at,
    ss.duration_minutes,
    ss.status
FROM scheduled_sessions ss
JOIN organizations o ON ss.org_id = o.id
JOIN users coach ON ss.coach_id = coach.id
JOIN users client ON ss.client_id = client.id
LEFT JOIN session_templates st ON ss.session_template_id = st.id
WHERE ss.scheduled_at >= NOW() 
  AND ss.scheduled_at <= NOW() + INTERVAL '7 days'
  AND ss.status IN ('scheduled', 'confirmed')
ORDER BY ss.scheduled_at;

-- Client Progress Summary
CREATE OR REPLACE VIEW v_client_progress_summary AS
SELECT 
    u.id as client_id,
    u.full_name as client_name,
    u.primary_org_id as org_id,
    COUNT(DISTINCT ss.id) as total_sessions,
    COUNT(DISTINCT ss.id) FILTER (WHERE ss.status = 'completed') as completed_sessions,
    og.grade_value as overall_grade,
    og.numeric_score as overall_score,
    MAX(ss.scheduled_at) as last_session_date
FROM users u
LEFT JOIN scheduled_sessions ss ON u.id = ss.client_id
LEFT JOIN overall_grades og ON u.id = og.client_id
WHERE u.role = 'client' AND u.deleted_at IS NULL
GROUP BY u.id, u.full_name, u.primary_org_id, og.grade_value, og.numeric_score;

-- ================================================================
-- END OF SCHEMA
-- ================================================================
