-- ================================================================
-- SEED DATA FOR DEVELOPMENT/TESTING
-- Run this after schema.sql
-- ================================================================

-- More Organizations
INSERT INTO organizations (id, name, category, subscription_plan, branding, settings) VALUES
('550e8400-e29b-41d4-a716-446655440011', 'MindWell Wellness', 'wellness', 'basic', 
 '{"primaryColor": "#4CAF50", "logo": "🧘", "tagline": "Balance Mind, Body & Soul"}',
 '{"timezone": "Asia/Kolkata", "currency": "INR", "language": "en"}'),
('550e8400-e29b-41d4-a716-446655440012', 'NutriPath Nutrition', 'nutrition', 'premium', 
 '{"primaryColor": "#FF9800", "logo": "🥗", "tagline": "Your Journey to Healthy Eating"}',
 '{"timezone": "Asia/Kolkata", "currency": "INR", "language": "en"}'),
('550e8400-e29b-41d4-a716-446655440013', 'SkillMaster Academy', 'tuition', 'enterprise', 
 '{"primaryColor": "#2196F3", "logo": "📚", "tagline": "Excellence in Education"}',
 '{"timezone": "Asia/Kolkata", "currency": "INR", "language": "en"}');

-- More Coaches
INSERT INTO users (id, primary_org_id, email, phone, full_name, role, is_verified, is_active, metadata) VALUES
('550e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440011', 
 'meditation@mindwell.com', '+919876543220', 'Amit Verma', 'coach', true, true,
 '{"bio": "Meditation & Mindfulness Expert", "certifications": ["Vipassana Teacher"]}'),
('550e8400-e29b-41d4-a716-446655440022', '550e8400-e29b-41d4-a716-446655440012', 
 'dietitian@nutripath.com', '+919876543221', 'Dr. Kavita Rao', 'coach', true, true,
 '{"bio": "Registered Dietitian & Nutritionist", "certifications": ["RD", "MSc Nutrition"]}'),
('550e8400-e29b-41d4-a716-446655440023', '550e8400-e29b-41d4-a716-446655440013', 
 'teacher@skillmaster.com', '+919876543222', 'Rajesh Gupta', 'coach', true, true,
 '{"bio": "Mathematics & Physics Tutor", "certifications": ["B.Tech IIT", "PhD Physics"]}');

-- More Clients
INSERT INTO users (id, primary_org_id, email, phone, full_name, role, is_verified, is_active, metadata) VALUES
('550e8400-e29b-41d4-a716-446655440031', '550e8400-e29b-41d4-a716-446655440001', 
 'vikram@example.com', '+919876543231', 'Vikram Singh', 'client', true, true, 
 '{"age": 32, "goals": ["weight_loss", "muscle_gain"]}'),
('550e8400-e29b-41d4-a716-446655440032', '550e8400-e29b-41d4-a716-446655440001', 
 'meera@example.com', '+919876543232', 'Meera Patel', 'client', true, true,
 '{"age": 28, "goals": ["flexibility", "stress_relief"]}'),
('550e8400-e29b-41d4-a716-446655440033', '550e8400-e29b-41d4-a716-446655440011', 
 'arjun@example.com', '+919876543233', 'Arjun Nair', 'client', true, true,
 '{"age": 35, "goals": ["meditation", "anxiety_management"]}'),
('550e8400-e29b-41d4-a716-446655440034', '550e8400-e29b-41d4-a716-446655440012', 
 'sneha@example.com', '+919876543234', 'Sneha Reddy', 'client', true, true,
 '{"age": 26, "goals": ["healthy_eating", "weight_management"]}');

-- Session Templates
INSERT INTO session_templates (id, org_id, created_by, name, description, duration_minutes, structure, is_active) VALUES
('550e8400-e29b-41d4-a716-446655440041', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440002', 'Strength Training', 'Full body strength workout', 60,
 '{"phases": [{"name": "Warmup", "duration": 10}, {"name": "Strength Sets", "duration": 45}, {"name": "Cooldown", "duration": 5}]}', true),
('550e8400-e29b-41d4-a716-446655440042', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440002', 'Yoga Flow', 'Vinyasa yoga session', 75,
 '{"phases": [{"name": "Pranayama", "duration": 10}, {"name": "Asanas", "duration": 55}, {"name": "Savasana", "duration": 10}]}', true),
('550e8400-e29b-41d4-a716-446655440043', '550e8400-e29b-41d4-a716-446655440011',
 '550e8400-e29b-41d4-a716-446655440021', 'Guided Meditation', 'Mindfulness meditation', 45,
 '{"phases": [{"name": "Settling", "duration": 5}, {"name": "Body Scan", "duration": 15}, {"name": "Meditation", "duration": 20}, {"name": "Integration", "duration": 5}]}', true),
('550e8400-e29b-41d4-a716-446655440044', '550e8400-e29b-41d4-a716-446655440012',
 '550e8400-e29b-41d4-a716-446655440022', 'Nutrition Consultation', 'Personalized diet planning', 60,
 '{"phases": [{"name": "Assessment", "duration": 20}, {"name": "Plan Creation", "duration": 30}, {"name": "Q&A", "duration": 10}]}', true);

-- Scheduled Sessions (Mix of past, present, future)
INSERT INTO scheduled_sessions (id, org_id, session_template_id, coach_id, client_id, scheduled_at, status, completed_at) VALUES
-- Completed sessions
('550e8400-e29b-41d4-a716-446655440051', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440041', '550e8400-e29b-41d4-a716-446655440002',
 '550e8400-e29b-41d4-a716-446655440003', NOW() - INTERVAL '5 days', 'completed', NOW() - INTERVAL '5 days'),
('550e8400-e29b-41d4-a716-446655440052', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440042', '550e8400-e29b-41d4-a716-446655440002',
 '550e8400-e29b-41d4-a716-446655440004', NOW() - INTERVAL '3 days', 'completed', NOW() - INTERVAL '3 days'),
('550e8400-e29b-41d4-a716-446655440053', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440002',
 '550e8400-e29b-41d4-a716-446655440031', NOW() - INTERVAL '2 days', 'completed', NOW() - INTERVAL '2 days'),
-- Scheduled sessions
('550e8400-e29b-41d4-a716-446655440061', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440041', '550e8400-e29b-41d4-a716-446655440002',
 '550e8400-e29b-41d4-a716-446655440031', NOW() + INTERVAL '1 day', 'scheduled', NULL),
('550e8400-e29b-41d4-a716-446655440062', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440042', '550e8400-e29b-41d4-a716-446655440002',
 '550e8400-e29b-41d4-a716-446655440004', NOW() + INTERVAL '2 days', 'scheduled', NULL),
('550e8400-e29b-41d4-a716-446655440063', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440002',
 '550e8400-e29b-41d4-a716-446655440032', NOW() + INTERVAL '3 days', 'scheduled', NULL);

-- Session Grades
INSERT INTO session_grades (id, session_id, client_id, coach_id, grade_value, numeric_score, comments, criteria_scores) VALUES
('550e8400-e29b-41d4-a716-446655440071', '550e8400-e29b-41d4-a716-446655440051',
 '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002',
 'B+', 85.0, 'Good form on most exercises. Need to work on core stability.',
 '{"effort": 90, "technique": 80, "progress": 85}'),
('550e8400-e29b-41d4-a716-446655440072', '550e8400-e29b-41d4-a716-446655440052',
 '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002',
 'A', 92.0, 'Excellent flexibility and breath control. Very focused.',
 '{"effort": 95, "technique": 90, "progress": 92}');

-- Skill Grades
INSERT INTO skill_grades (id, org_id, client_id, coach_id, skill_key, skill_name, grade_value, numeric_score, rationale) VALUES
('550e8400-e29b-41d4-a716-446655440081', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002',
 'strength', 'Strength', 'B', 78.0, 'Consistent improvement in compound lifts'),
('550e8400-e29b-41d4-a716-446655440082', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002',
 'endurance', 'Endurance', 'B+', 82.0, 'Good cardiovascular capacity'),
('550e8400-e29b-41d4-a716-446655440083', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002',
 'flexibility', 'Flexibility', 'A', 92.0, 'Exceptional range of motion'),
('550e8400-e29b-41d4-a716-446655440084', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002',
 'balance', 'Balance', 'A-', 88.0, 'Strong core stability');

-- Overall Grades
INSERT INTO overall_grades (client_id, org_id, grade_value, numeric_score, explanation, last_updated_by) VALUES
('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001',
 'B+', 78.0, 'Rahul has shown consistent progress. Strength and endurance improving steadily.',
 '550e8400-e29b-41d4-a716-446655440002'),
('550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001',
 'A', 92.0, 'Anita is an exceptional student with excellent form and dedication.',
 '550e8400-e29b-41d4-a716-446655440002'),
('550e8400-e29b-41d4-a716-446655440031', '550e8400-e29b-41d4-a716-446655440001',
 'B', 65.0, 'Vikram needs to work on consistency. Good potential when focused.',
 '550e8400-e29b-41d4-a716-446655440002'),
('550e8400-e29b-41d4-a716-446655440032', '550e8400-e29b-41d4-a716-446655440001',
 'A-', 88.0, 'Meera shows great improvement in flexibility and mindfulness.',
 '550e8400-e29b-41d4-a716-446655440002');

-- Progress Entries
INSERT INTO progress_entries (id, org_id, client_id, session_id, entry_type, payload, visibility) VALUES
('550e8400-e29b-41d4-a716-446655440091', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440052',
 'photo', '{"description": "Week 8 progress photo - visible muscle definition!", "tags": ["progress", "milestone"]}', 'coach_only'),
('550e8400-e29b-41d4-a716-446655440092', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440003', NULL,
 'measurement', '{"weight_kg": 76.5, "body_fat_percentage": 18.2, "notes": "Lost 2kg this month!"}', 'coach_only'),
('550e8400-e29b-41d4-a716-446655440093', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440032', NULL,
 'achievement', '{"title": "First Headstand!", "description": "Finally nailed the headstand pose!", "date": "2026-02-05"}', 'shared');

-- Payment Plans
INSERT INTO payment_plans (id, org_id, name, description, amount, currency, billing_cycle, session_count, validity_days, is_active) VALUES
('550e8400-e29b-41d4-a716-446655440101', '550e8400-e29b-41d4-a716-446655440001',
 'Basic Monthly', '8 sessions per month', 3999.00, 'INR', 'monthly', 8, 30, true),
('550e8400-e29b-41d4-a716-446655440102', '550e8400-e29b-41d4-a716-446655440001',
 'Premium Monthly', '12 sessions per month + nutrition plan', 5999.00, 'INR', 'monthly', 12, 30, true),
('550e8400-e29b-41d4-a716-446655440103', '550e8400-e29b-41d4-a716-446655440001',
 'Unlimited Monthly', 'Unlimited sessions', 9999.00, 'INR', 'monthly', NULL, 30, true),
('550e8400-e29b-41d4-a716-446655440104', '550e8400-e29b-41d4-a716-446655440001',
 'Quarterly Package', '36 sessions (3 months)', 10999.00, 'INR', 'quarterly', 36, 90, true);

-- Client Subscriptions
INSERT INTO client_subscriptions (id, org_id, client_id, payment_plan_id, status, start_date, end_date, sessions_remaining, auto_renew) VALUES
('550e8400-e29b-41d4-a716-446655440111', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440101',
 'active', '2026-02-01', '2026-03-01', 5, true),
('550e8400-e29b-41d4-a716-446655440112', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440102',
 'active', '2026-02-01', '2026-03-01', 9, true),
('550e8400-e29b-41d4-a716-446655440113', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440031', '550e8400-e29b-41d4-a716-446655440103',
 'active', '2026-01-15', '2026-02-15', NULL, true),
('550e8400-e29b-41d4-a716-446655440114', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440032', '550e8400-e29b-41d4-a716-446655440104',
 'active', '2025-12-01', '2026-03-01', 24, false);

-- Payment Transactions
INSERT INTO payment_transactions (id, org_id, client_id, subscription_id, amount, currency, payment_method, payment_gateway_id, status, paid_at) VALUES
('550e8400-e29b-41d4-a716-446655440121', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440111',
 3999.00, 'INR', 'razorpay', 'pay_123abc456def', 'success', NOW() - INTERVAL '5 days'),
('550e8400-e29b-41d4-a716-446655440122', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440112',
 5999.00, 'INR', 'razorpay', 'pay_789ghi012jkl', 'success', NOW() - INTERVAL '4 days'),
('550e8400-e29b-41d4-a716-446655440123', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440031', '550e8400-e29b-41d4-a716-446655440113',
 9999.00, 'INR', 'upi', NULL, 'success', NOW() - INTERVAL '20 days');

-- Referral Invites
INSERT INTO referral_invites (id, org_id, referrer_id, referee_contact, referee_name, invite_code, status, reward_type, reward_value, expires_at) VALUES
('550e8400-e29b-41d4-a716-446655440131', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440004', '+919876543240', 'Sneha Reddy', 'REF-ANITA-001', 'pending',
 'discount', 500.00, NOW() + INTERVAL '30 days'),
('550e8400-e29b-41d4-a716-446655440132', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440003', '+919876543241', 'Arjun Mehta', 'REF-RAHUL-001', 'converted',
 'free_session', 1.00, NOW() + INTERVAL '30 days'),
('550e8400-e29b-41d4-a716-446655440133', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440032', '+919876543242', 'Priya Joshi', 'REF-MEERA-001', 'pending',
 'discount', 500.00, NOW() + INTERVAL '30 days');

-- Feedback Responses
INSERT INTO feedback_responses (id, org_id, respondent_id, subject_type, subject_id, rating, comments, sentiment) VALUES
('550e8400-e29b-41d4-a716-446655440141', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440004', 'coach', '550e8400-e29b-41d4-a716-446655440002',
 5, 'Priya is an amazing coach! Very motivating and knowledgeable.', 'positive'),
('550e8400-e29b-41d4-a716-446655440142', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440003', 'session', '550e8400-e29b-41d4-a716-446655440051',
 4, 'Great workout! Really felt the burn. Could use more cooldown time.', 'positive'),
('550e8400-e29b-41d4-a716-446655440143', '550e8400-e29b-41d4-a716-446655440001',
 '550e8400-e29b-41d4-a716-446655440032', 'organization', '550e8400-e29b-41d4-a716-446655440001',
 5, 'Love the platform! Easy to track progress and book sessions.', 'positive');

-- Communities
INSERT INTO communities (id, name, description, scope, created_by, is_active, member_count) VALUES
('550e8400-e29b-41d4-a716-446655440151', 'Fitness Coaches Network', 
 'Connect with fellow fitness professionals, share tips and best practices', 
 'coaches_only', '550e8400-e29b-41d4-a716-446655440002', true, 247),
('550e8400-e29b-41d4-a716-446655440152', 'Nutrition & Wellness', 
 'Discussion forum for nutrition coaches and dietitians', 
 'coaches_only', '550e8400-e29b-41d4-a716-446655440022', true, 156),
('550e8400-e29b-41d4-a716-446655440153', 'FitLife Client Community', 
 'Share your fitness journey with fellow FitLife members', 
 'org_specific', '550e8400-e29b-41d4-a716-446655440002', true, 89);

-- Community Members
INSERT INTO community_members (community_id, user_id, role) VALUES
('550e8400-e29b-41d4-a716-446655440151', '550e8400-e29b-41d4-a716-446655440002', 'admin'),
('550e8400-e29b-41d4-a716-446655440151', '550e8400-e29b-41d4-a716-446655440021', 'member'),
('550e8400-e29b-41d4-a716-446655440151', '550e8400-e29b-41d4-a716-446655440023', 'member'),
('550e8400-e29b-41d4-a716-446655440152', '550e8400-e29b-41d4-a716-446655440022', 'admin'),
('550e8400-e29b-41d4-a716-446655440153', '550e8400-e29b-41d4-a716-446655440002', 'admin'),
('550e8400-e29b-41d4-a716-446655440153', '550e8400-e29b-41d4-a716-446655440003', 'member'),
('550e8400-e29b-41d4-a716-446655440153', '550e8400-e29b-41d4-a716-446655440004', 'member');

-- Community Posts
INSERT INTO community_posts (id, community_id, author_id, content, post_type, is_pinned, like_count, comment_count) VALUES
('550e8400-e29b-41d4-a716-446655440161', '550e8400-e29b-41d4-a716-446655440151',
 '550e8400-e29b-41d4-a716-446655440002', 
 'Just launched our new HIIT program! Getting amazing feedback from clients. Happy to share the structure if anyone is interested.',
 'discussion', false, 23, 8),
('550e8400-e29b-41d4-a716-446655440162', '550e8400-e29b-41d4-a716-446655440151',
 '550e8400-e29b-41d4-a716-446655440021', 
 'How do you all handle client cancellations? Looking for best practices on cancellation policies.',
 'question', false, 15, 12),
('550e8400-e29b-41d4-a716-446655440163', '550e8400-e29b-41d4-a716-446655440153',
 '550e8400-e29b-41d4-a716-446655440004', 
 'Hit a new PR today! 💪 Finally managed 10 consecutive push-ups! Thank you Priya for the encouragement!',
 'discussion', false, 45, 6);

-- Audit Log Sample Entries
INSERT INTO audit_logs (org_id, actor_id, action, entity_type, entity_id, after_state, source, ip_address) VALUES
('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002',
 'user.created', 'users', '550e8400-e29b-41d4-a716-446655440031',
 '{"full_name": "Vikram Singh", "role": "client"}', 'web', '103.21.244.5'),
('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002',
 'session.scheduled', 'scheduled_sessions', '550e8400-e29b-41d4-a716-446655440061',
 '{"client_id": "550e8400-e29b-41d4-a716-446655440031", "scheduled_at": "2026-02-09T10:00:00Z"}', 'web', '103.21.244.5'),
('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002',
 'grade.updated', 'session_grades', '550e8400-e29b-41d4-a716-446655440071',
 '{"grade_value": "B+", "numeric_score": 85.0}', 'web', '103.21.244.5');

-- System Settings
INSERT INTO system_settings (key, value, description, is_public) VALUES
('feature_flags', '{"ai_intent_enabled": true, "whatsapp_enabled": true, "community_enabled": true}', 
 'Feature toggles for the platform', false),
('default_session_reminder_hours', '24', 'Hours before session to send reminder', false),
('max_sessions_per_day', '10', 'Maximum sessions a coach can have per day', false),
('referral_reward_amount', '500', 'Default referral reward in INR', false);

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- Count records in key tables
SELECT 'organizations' as table_name, COUNT(*) as count FROM organizations
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'session_templates', COUNT(*) FROM session_templates
UNION ALL
SELECT 'scheduled_sessions', COUNT(*) FROM scheduled_sessions
UNION ALL
SELECT 'session_grades', COUNT(*) FROM session_grades
UNION ALL
SELECT 'overall_grades', COUNT(*) FROM overall_grades
UNION ALL
SELECT 'payment_plans', COUNT(*) FROM payment_plans
UNION ALL
SELECT 'referral_invites', COUNT(*) FROM referral_invites
UNION ALL
SELECT 'communities', COUNT(*) FROM communities
UNION ALL
SELECT 'feedback_responses', COUNT(*) FROM feedback_responses;
