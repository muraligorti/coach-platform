-- ================================================================
-- COACHFLOW V2 MIGRATION (FIXED) — Handles pre-existing tables
-- Run against existing coach_platform database
-- ================================================================

-- Fix: Drop old leads table that was created without org_id
DROP TABLE IF EXISTS leads CASCADE;

-- Leads Pipeline (fresh create)
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    interest VARCHAR(100),
    source VARCHAR(100),
    temperature VARCHAR(20) DEFAULT 'warm' CHECK (temperature IN ('hot', 'warm', 'cold', 'converted')),
    notes TEXT,
    converted_client_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_leads_org ON leads(org_id);
CREATE INDEX idx_leads_coach ON leads(coach_id);
CREATE INDEX idx_leads_temp ON leads(temperature);

-- Coach Availability (working days + recurring config)
DROP TABLE IF EXISTS coach_availability CASCADE;
CREATE TABLE coach_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    working_days JSONB DEFAULT '[0,1,2,3,4]'::jsonb,
    recurring_type VARCHAR(20) DEFAULT 'weekly' CHECK (recurring_type IN ('weekly', 'biweekly', 'custom')),
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(coach_id)
);

-- Time Slots
DROP TABLE IF EXISTS coach_availability_slots CASCADE;
CREATE TABLE coach_availability_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(100),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_avail_slots_coach ON coach_availability_slots(coach_id);

-- Holidays / Leaves
DROP TABLE IF EXISTS coach_holidays CASCADE;
CREATE TABLE coach_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    type VARCHAR(20) DEFAULT 'holiday' CHECK (type IN ('holiday', 'leave')),
    note VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_holidays_coach ON coach_holidays(coach_id, date);

-- Payment records
DROP TABLE IF EXISTS coach_payments CASCADE;
CREATE TABLE coach_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_type VARCHAR(20) DEFAULT 'monthly' CHECK (payment_type IN ('monthly', 'sessions', 'one_time')),
    session_count INT,
    sessions_used INT DEFAULT 0,
    billing_start VARCHAR(20) DEFAULT 'attendance',
    status VARCHAR(20) DEFAULT 'due' CHECK (status IN ('paid', 'partial', 'due', 'overdue')),
    cycle_note VARCHAR(255),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_coach_payments_org ON coach_payments(org_id);
CREATE INDEX idx_coach_payments_coach ON coach_payments(coach_id);
CREATE INDEX idx_coach_payments_client ON coach_payments(client_id);
CREATE INDEX idx_coach_payments_status ON coach_payments(status);

-- Add missing columns to organizations
DO $$ BEGIN
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slug VARCHAR(100);
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50);
EXCEPTION WHEN others THEN NULL;
END $$;

-- Ensure metadata column default on scheduled_sessions
DO $$ BEGIN
    ALTER TABLE scheduled_sessions ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;
EXCEPTION WHEN others THEN NULL;
END $$;

SELECT 'V2 migration complete' AS status;
