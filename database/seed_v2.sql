-- ================================================================
-- COACHFLOW V2 — SEED DATA FOR TEST ORG
-- Maps all data to default test org + test coach
-- ================================================================

-- Ensure test org exists
INSERT INTO organizations (id, name, slug, subscription_tier, is_active, created_at)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'FitForge Coaching', 'fitforge', 'pro', true, NOW())
ON CONFLICT (id) DO UPDATE SET name = 'FitForge Coaching', slug = 'fitforge';

-- Test coach (password: coach123)
INSERT INTO users (id, primary_org_id, full_name, email, phone, role, password_hash, is_active, is_verified, metadata, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000010'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Coach Ravi', 'ravi@fitforge.in', '+91 99999 00000', 'coach',
  encode(sha256('coach123'::bytea), 'hex'),
  true, true,
  '{"specialization": "gym", "experience_years": 8}'::jsonb,
  NOW()
) ON CONFLICT (id) DO UPDATE SET full_name = 'Coach Ravi';

-- Test clients
INSERT INTO users (id, primary_org_id, full_name, email, phone, role, is_active, is_verified, metadata, created_at) VALUES
('00000000-0000-0000-0000-000000000101'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Arjun Mehta', 'arjun@mail.com', '+91 98765 43210', 'client', true, true, '{"goal":"Muscle Gain","level":"Intermediate","type":"Offline","weight":78,"height":175}'::jsonb, NOW()),
('00000000-0000-0000-0000-000000000102'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Priya Sharma', 'priya@mail.com', '+91 87654 32109', 'client', true, true, '{"goal":"Weight Loss","level":"Beginner","type":"Offline","weight":62,"height":160,"medical":"Mild knee pain"}'::jsonb, NOW()),
('00000000-0000-0000-0000-000000000103'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Rahul Verma', 'rahul@mail.com', '+91 76543 21098', 'client', true, true, '{"goal":"Strength","level":"Advanced","type":"Online","weight":85,"height":180}'::jsonb, NOW()),
('00000000-0000-0000-0000-000000000104'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Sneha Patel', 'sneha@mail.com', '+91 65432 10987', 'client', true, true, '{"goal":"Flexibility","level":"Intermediate","type":"Offline","weight":55,"height":158,"medical":"Lower back strain"}'::jsonb, NOW()),
('00000000-0000-0000-0000-000000000105'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Vikram Singh', 'vikram@mail.com', '+91 54321 09876', 'client', false, true, '{"goal":"Endurance","level":"Beginner","type":"Online","weight":70,"height":172}'::jsonb, NOW())
ON CONFLICT (id) DO NOTHING;

-- Coach availability
INSERT INTO coach_availability (coach_id, org_id, working_days, recurring_type)
VALUES ('00000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '[0,1,2,3,4]'::jsonb, 'weekly')
ON CONFLICT (coach_id) DO UPDATE SET working_days = '[0,1,2,3,4]'::jsonb;

-- Time slots
INSERT INTO coach_availability_slots (coach_id, label, start_time, end_time) VALUES
('00000000-0000-0000-0000-000000000010'::uuid, 'Early Morning', '06:00', '09:00'),
('00000000-0000-0000-0000-000000000010'::uuid, 'Mid-Morning', '09:30', '12:30'),
('00000000-0000-0000-0000-000000000010'::uuid, 'Afternoon', '14:00', '17:00'),
('00000000-0000-0000-0000-000000000010'::uuid, 'Evening', '17:30', '19:00');

-- Holidays
INSERT INTO coach_holidays (coach_id, date, type, note) VALUES
('00000000-0000-0000-0000-000000000010'::uuid, '2026-02-18', 'holiday', 'Maha Shivaratri');

-- Workout templates
INSERT INTO session_templates (id, org_id, created_by, name, description, session_type, duration_minutes, structure, is_active) VALUES
('00000000-0000-0000-0000-000000000201'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid,
 'Push Day — Hypertrophy', 'Chest, shoulders, triceps', 'strength', 60,
 '{"exercises":[{"name":"Bench Press","sets":4,"reps":"8-10","weight":"80kg","last_weight":"77.5kg","rest":120},{"name":"Incline DB Press","sets":3,"reps":"10-12","weight":"30kg","last_weight":"30kg","rest":90},{"name":"Cable Flyes","sets":3,"reps":"12-15","weight":"15kg","last_weight":"12.5kg","rest":60},{"name":"OHP","sets":4,"reps":"8-10","weight":"50kg","last_weight":"50kg","rest":120},{"name":"Lat Raises","sets":3,"reps":"15","weight":"10kg","last_weight":"10kg","rest":60},{"name":"Tricep Pushdowns","sets":3,"reps":"12-15","weight":"25kg","last_weight":"22.5kg","rest":60}]}'::jsonb, true),
('00000000-0000-0000-0000-000000000202'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid,
 'Full Body — Fat Burn', 'HIIT circuit', 'cardio', 45,
 '{"exercises":[{"name":"Goblet Squats","sets":3,"reps":"15","weight":"16kg","last_weight":"14kg","rest":45},{"name":"KB Swings","sets":3,"reps":"20","weight":"16kg","last_weight":"16kg","rest":30},{"name":"Squat","sets":3,"reps":"12","weight":"40kg","last_weight":"35kg","rest":60}]}'::jsonb, true),
('00000000-0000-0000-0000-000000000203'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid,
 'Heavy Compound', 'Strength focus', 'strength', 75,
 '{"exercises":[{"name":"Deadlift","sets":5,"reps":"5","weight":"120kg","last_weight":"115kg","rest":180},{"name":"Squat","sets":5,"reps":"5","weight":"100kg","last_weight":"95kg","rest":180},{"name":"Bench Press","sets":4,"reps":"6","weight":"90kg","last_weight":"87.5kg","rest":150},{"name":"Barbell Row","sets":4,"reps":"8","weight":"70kg","last_weight":"67.5kg","rest":120}]}'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

-- Today's sessions
INSERT INTO scheduled_sessions (org_id, coach_id, client_id, session_template_id, scheduled_at, duration_minutes, status, location) VALUES
('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000101'::uuid, '00000000-0000-0000-0000-000000000201'::uuid, CURRENT_DATE + '09:00'::time, 60, 'confirmed', 'offline'),
('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000102'::uuid, '00000000-0000-0000-0000-000000000202'::uuid, CURRENT_DATE + '10:30'::time, 45, 'confirmed', 'offline'),
('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000103'::uuid, '00000000-0000-0000-0000-000000000203'::uuid, CURRENT_DATE + '12:00'::time, 75, 'scheduled', 'online'),
('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000104'::uuid, NULL, CURRENT_DATE + '14:00'::time, 60, 'confirmed', 'offline'),
('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000105'::uuid, NULL, CURRENT_DATE + '16:00'::time, 60, 'scheduled', 'online');

-- Leads
INSERT INTO leads (org_id, coach_id, name, phone, interest, source, temperature, notes) VALUES
('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, 'Kavita Nair', '+91 99887 66554', 'Weight Loss', 'Referral', 'hot', 'Referred by Priya'),
('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, 'Deepak Joshi', '+91 88776 55443', 'Muscle Gain', 'Instagram', 'hot', ''),
('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, 'Anil Kumar', '+91 77665 44332', 'Rehab', 'Google', 'warm', ''),
('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, 'Suresh Bhat', '+91 66554 33221', 'General Fitness', 'Website', 'cold', '');

-- Payments
INSERT INTO coach_payments (org_id, coach_id, client_id, amount, payment_type, session_count, sessions_used, billing_start, status, cycle_note, paid_at) VALUES
('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000101'::uuid, 8000, 'monthly', NULL, 0, 'attendance', 'paid', 'From 1st attendance', NOW()),
('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000102'::uuid, 12000, 'sessions', 24, 6, 'attendance', 'paid', '24 sessions (18 left)', NOW()),
('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000103'::uuid, 10000, 'monthly', NULL, 0, 'agreed', 'paid', 'From agreed date', NOW()),
('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000104'::uuid, 6000, 'monthly', NULL, 0, 'attendance', 'due', 'From 1st attendance', NULL),
('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000105'::uuid, 6000, 'sessions', 12, 9, 'attendance', 'partial', '12 sessions (3 left)', NULL);

SELECT 'Seed data loaded successfully' AS status;
