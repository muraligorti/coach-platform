from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import List, Optional
import asyncpg
import os
from datetime import datetime, timedelta
import json

from models import *
from auth import *

router = APIRouter()

async def get_db():
    return await asyncpg.connect(
        host=os.getenv("DB_HOST", "coach-db-1770519048.postgres.database.azure.com"),
        port=5432,
        user=os.getenv("DB_USER", "dbadmin"),
        password=os.getenv("DB_PASSWORD", "CoachPlatform2026!SecureDB"),
        database=os.getenv("DB_NAME", "coach_platform"),
        ssl='require'
    )

async def get_or_create_org():
    """Get existing org or create default"""
    conn = await get_db()
    org = await conn.fetchrow("SELECT id FROM organizations WHERE deleted_at IS NULL LIMIT 1")
    if not org:
        org = await conn.fetchrow(
            "INSERT INTO organizations (name, category) VALUES ('Default Org', 'fitness') RETURNING id"
        )
    await conn.close()
    return org['id']

# ============================================================================
# AUTHENTICATION ENDPOINTS
# ============================================================================

@router.post("/auth/register")
async def register_user(user: UserRegister):
    """Register new user (coach or client)"""
    try:
        conn = await get_db()
        org_id = await get_or_create_org()
        
        # Check if user exists
        existing = await conn.fetchrow(
            "SELECT id FROM users WHERE phone = $1 AND deleted_at IS NULL",
            user.phone
        )
        if existing:
            raise HTTPException(status_code=400, detail="User with this phone already exists")
        
        # Hash password if provided
        password_hash = get_password_hash(user.password) if user.password else None
        
        # Create user
        query = """
            INSERT INTO users (primary_org_id, full_name, email, phone, phone_country_code, role, password_hash, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, true)
            RETURNING id::text, full_name, email, phone, role
        """
        new_user = await conn.fetchrow(
            query, org_id, user.full_name, user.email, user.phone, 
            user.phone_country_code, user.role, password_hash
        )
        
        await conn.close()
        
        # Generate token
        token = create_access_token(data={"sub": new_user['id'], "role": new_user['role']})
        
        return {
            "success": True,
            "access_token": token,
            "token_type": "bearer",
            "user": dict(new_user)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/auth/otp/send")
async def send_otp(request: OTPRequest):
    """Send OTP to phone via SMS/WhatsApp"""
    try:
        conn = await get_db()
        
        # Generate OTP
        otp_code = generate_otp()
        otp_hash = hash_otp(otp_code)
        expires_at = datetime.utcnow() + timedelta(minutes=5)
        
        # Save OTP to database
        await conn.execute("""
            INSERT INTO otp_verifications (phone, phone_country_code, otp_code, otp_hash, purpose, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6)
        """, request.phone, request.phone_country_code, otp_code, otp_hash, request.purpose, expires_at)
        
        await conn.close()
        
        # TODO: Send actual SMS/WhatsApp using Twilio
        # For now, return OTP in response (DEVELOPMENT ONLY!)
        
        return {
            "success": True,
            "message": "OTP sent successfully",
            "otp": otp_code,  # Remove this in production!
            "expires_in": 300
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/auth/otp/verify")
async def verify_otp(request: OTPVerify):
    """Verify OTP and login"""
    try:
        conn = await get_db()
        
        # Get latest OTP
        otp_record = await conn.fetchrow("""
            SELECT * FROM otp_verifications 
            WHERE phone = $1 AND is_verified = false AND expires_at > NOW()
            ORDER BY created_at DESC LIMIT 1
        """, request.phone)
        
        if not otp_record:
            raise HTTPException(status_code=400, detail="Invalid or expired OTP")
        
        # Verify OTP
        if otp_record['otp_code'] != request.otp_code:
            await conn.execute(
                "UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1",
                otp_record['id']
            )
            raise HTTPException(status_code=400, detail="Invalid OTP")
        
        # Mark as verified
        await conn.execute(
            "UPDATE otp_verifications SET is_verified = true, verified_at = NOW() WHERE id = $1",
            otp_record['id']
        )
        
        # Get or create user
        user = await conn.fetchrow(
            "SELECT id::text, full_name, email, phone, role FROM users WHERE phone = $1 AND deleted_at IS NULL",
            request.phone
        )
        
        if not user:
            # Create new user
            org_id = await get_or_create_org()
            user = await conn.fetchrow("""
                INSERT INTO users (primary_org_id, full_name, phone, phone_country_code, role, is_verified, is_active)
                VALUES ($1, $2, $3, $4, 'client', true, true)
                RETURNING id::text, full_name, email, phone, role
            """, org_id, f"User {request.phone}", request.phone, request.phone_country_code)
        
        await conn.close()
        
        # Generate token
        token = create_access_token(data={"sub": user['id'], "role": user['role']})
        
        return {
            "success": True,
            "access_token": token,
            "token_type": "bearer",
            "user": dict(user)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# CLIENT MANAGEMENT
# ============================================================================

@router.get("/clients")
async def get_clients():
    try:
        conn = await get_db()
        query = """
            SELECT 
                u.id::text as id,
                u.full_name as name,
                u.email,
                u.phone,
                u.created_at::text,
                COALESCE(og.numeric_score, 0)::int as progress,
                COUNT(DISTINCT ss.id)::int as sessions,
                COALESCE(og.grade_value, 'N/A') as overall_grade,
                CASE WHEN u.is_active THEN 'active' ELSE 'inactive' END as status
            FROM users u
            LEFT JOIN overall_grades og ON u.id = og.client_id
            LEFT JOIN scheduled_sessions ss ON u.id = ss.client_id
            WHERE u.role = 'client' AND u.deleted_at IS NULL
            GROUP BY u.id, u.full_name, u.email, u.phone, u.created_at, og.numeric_score, og.grade_value, u.is_active
            ORDER BY u.created_at DESC
        """
        rows = await conn.fetch(query)
        await conn.close()
        return {"success": True, "clients": [dict(row) for row in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/clients/{client_id}")
async def get_client(client_id: str):
    try:
        conn = await get_db()
        client = await conn.fetchrow("""
            SELECT 
                u.id::text, u.full_name as name, u.email, u.phone,
                u.created_at::text, u.metadata,
                og.grade_value as overall_grade, og.numeric_score as overall_score
            FROM users u
            LEFT JOIN overall_grades og ON u.id = og.client_id
            WHERE u.id = $1::uuid AND u.deleted_at IS NULL
        """, client_id)
        
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        await conn.close()
        return {"success": True, "client": dict(client)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/clients")
async def create_client(client: ClientCreate):
    try:
        conn = await get_db()
        org_id = await get_or_create_org()
        
        query = """
            INSERT INTO users (primary_org_id, full_name, email, phone, role, is_active, is_verified)
            VALUES ($1, $2, $3, $4, 'client', true, true)
            RETURNING id::text, full_name as name, email, phone
        """
        row = await conn.fetchrow(query, org_id, client.name, client.email, client.phone)
        await conn.close()
        
        return {"success": True, "client": dict(row)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/clients/{client_id}")
async def update_client(client_id: str, updates: ClientUpdate):
    try:
        conn = await get_db()
        
        update_fields = []
        values = []
        idx = 1
        
        if updates.name:
            update_fields.append(f"full_name = ${idx}")
            values.append(updates.name)
            idx += 1
        if updates.email:
            update_fields.append(f"email = ${idx}")
            values.append(updates.email)
            idx += 1
        if updates.phone:
            update_fields.append(f"phone = ${idx}")
            values.append(updates.phone)
            idx += 1
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        values.append(client_id)
        query = f"UPDATE users SET {', '.join(update_fields)}, updated_at = NOW() WHERE id = ${idx}::uuid RETURNING id::text"
        
        result = await conn.fetchrow(query, *values)
        await conn.close()
        
        if not result:
            raise HTTPException(status_code=404, detail="Client not found")
        
        return {"success": True, "message": "Client updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# SESSION MANAGEMENT
# ============================================================================

@router.get("/sessions")
async def get_sessions(status: Optional[str] = None, client_id: Optional[str] = None):
    try:
        conn = await get_db()
        
        conditions = ["ss.org_id IS NOT NULL"]
        if status:
            conditions.append(f"ss.status = '{status}'")
        if client_id:
            conditions.append(f"ss.client_id = '{client_id}'::uuid")
        
        where_clause = " AND ".join(conditions)
        
        query = f"""
            SELECT 
                ss.id::text,
                ss.scheduled_at::text,
                ss.status,
                ss.duration_minutes,
                ss.location,
                ss.notes,
                u.full_name as client_name,
                u.id::text as client_id,
                st.name as template_name,
                sg.grade_value
            FROM scheduled_sessions ss
            JOIN users u ON ss.client_id = u.id
            LEFT JOIN session_templates st ON ss.session_template_id = st.id
            LEFT JOIN session_grades sg ON ss.id = sg.session_id
            WHERE {where_clause}
            ORDER BY ss.scheduled_at DESC
            LIMIT 50
        """
        
        rows = await conn.fetch(query)
        await conn.close()
        
        return {"success": True, "sessions": [dict(row) for row in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sessions")
async def create_session(session: SessionCreate):
    try:
        conn = await get_db()
        org_id = await get_or_create_org()
        
        # Get a coach (just use first available for now)
        coach = await conn.fetchrow(
            "SELECT id FROM users WHERE role = 'coach' AND deleted_at IS NULL LIMIT 1"
        )
        
        if not coach:
            # Create a default coach
            coach = await conn.fetchrow("""
                INSERT INTO users (primary_org_id, full_name, role, phone, is_active)
                VALUES ($1, 'Default Coach', 'coach', '+910000000000', true)
                RETURNING id
            """, org_id)
        
        query = """
            INSERT INTO scheduled_sessions 
            (org_id, coach_id, client_id, session_template_id, scheduled_at, duration_minutes, location, notes, status)
            VALUES ($1, $2, $3::uuid, $4::uuid, $5, $6, $7, $8, 'scheduled')
            RETURNING id::text, scheduled_at::text, status
        """
        
        result = await conn.fetchrow(
            query, org_id, coach['id'], session.client_id, session.template_id,
            session.scheduled_at, session.duration_minutes, session.location, session.notes
        )
        
        await conn.close()
        return {"success": True, "session": dict(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/sessions/{session_id}")
async def update_session(session_id: str, updates: SessionUpdate):
    try:
        conn = await get_db()
        
        fields = []
        values = []
        idx = 1
        
        if updates.status:
            fields.append(f"status = ${idx}")
            values.append(updates.status)
            idx += 1
            if updates.status == SessionStatus.COMPLETED:
                fields.append(f"completed_at = NOW()")
        
        if updates.notes:
            fields.append(f"notes = ${idx}")
            values.append(updates.notes)
            idx += 1
        
        values.append(session_id)
        query = f"UPDATE scheduled_sessions SET {', '.join(fields)} WHERE id = ${idx}::uuid RETURNING id::text"
        
        result = await conn.fetchrow(query, *values)
        await conn.close()
        
        if not result:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {"success": True, "message": "Session updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# GRADING
# ============================================================================

@router.post("/grading/session")
async def create_session_grade(grade: SessionGradeCreate):
    try:
        conn = await get_db()
        
        # Get coach from session
        session = await conn.fetchrow(
            "SELECT coach_id FROM scheduled_sessions WHERE id = $1::uuid",
            grade.session_id
        )
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Insert or update grade
        query = """
            INSERT INTO session_grades (session_id, client_id, coach_id, grade_value, numeric_score, comments)
            VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)
            ON CONFLICT (session_id, client_id) 
            DO UPDATE SET grade_value = $4, numeric_score = $5, comments = $6, updated_at = NOW()
            RETURNING id::text
        """
        
        result = await conn.fetchrow(
            query, grade.session_id, grade.client_id, session['coach_id'],
            grade.grade_value, grade.numeric_score, grade.comments
        )
        
        await conn.close()
        return {"success": True, "grade_id": result['id']}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/grading/client/{client_id}")
async def get_client_grades(client_id: str):
    try:
        conn = await get_db()
        
        # Get session grades
        session_grades = await conn.fetch("""
            SELECT sg.*, ss.scheduled_at::text, st.name as session_name
            FROM session_grades sg
            JOIN scheduled_sessions ss ON sg.session_id = ss.id
            LEFT JOIN session_templates st ON ss.session_template_id = st.id
            WHERE sg.client_id = $1::uuid
            ORDER BY ss.scheduled_at DESC
        """, client_id)
        
        # Get skill grades
        skill_grades = await conn.fetch("""
            SELECT skill_key, skill_name, grade_value, numeric_score, rationale
            FROM skill_grades
            WHERE client_id = $1::uuid
        """, client_id)
        
        # Get overall grade
        overall_grade = await conn.fetchrow("""
            SELECT grade_value, numeric_score, explanation
            FROM overall_grades
            WHERE client_id = $1::uuid
        """, client_id)
        
        await conn.close()
        
        return {
            "success": True,
            "session_grades": [dict(r) for r in session_grades],
            "skill_grades": [dict(r) for r in skill_grades],
            "overall_grade": dict(overall_grade) if overall_grade else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# PROGRESS TRACKING
# ============================================================================

@router.post("/progress")
async def create_progress_entry(
    client_id: str = Form(...),
    entry_type: str = Form(...),
    notes: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    try:
        conn = await get_db()
        org_id = await get_or_create_org()
        
        payload = {"notes": notes}
        
        # TODO: Upload file to Azure Blob Storage if provided
        # For now, just store metadata
        
        query = """
            INSERT INTO progress_entries (org_id, client_id, session_id, entry_type, payload)
            VALUES ($1, $2::uuid, $3::uuid, $4, $5)
            RETURNING id::text, created_at::text
        """
        
        result = await conn.fetchrow(
            query, org_id, client_id, session_id, entry_type, json.dumps(payload)
        )
        
        await conn.close()
        return {"success": True, "entry": dict(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/progress/client/{client_id}")
async def get_client_progress(client_id: str):
    try:
        conn = await get_db()
        
        query = """
            SELECT 
                pe.id::text,
                pe.entry_type,
                pe.payload,
                pe.created_at::text,
                ss.scheduled_at::text as session_date
            FROM progress_entries pe
            LEFT JOIN scheduled_sessions ss ON pe.session_id = ss.id
            WHERE pe.client_id = $1::uuid AND pe.deleted_at IS NULL
            ORDER BY pe.created_at DESC
            LIMIT 50
        """
        
        rows = await conn.fetch(query, client_id)
        await conn.close()
        
        return {"success": True, "progress": [dict(row) for row in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# PAYMENT & SUBSCRIPTIONS
# ============================================================================

@router.get("/payment-plans")
async def get_payment_plans():
    try:
        conn = await get_db()
        
        query = """
            SELECT id::text, name, description, amount, currency, billing_cycle, session_count
            FROM payment_plans
            WHERE is_active = true AND deleted_at IS NULL
        """
        
        rows = await conn.fetch(query)
        await conn.close()
        
        return {"success": True, "plans": [dict(row) for row in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/payment-plans")
async def create_payment_plan(plan: PaymentPlanCreate):
    try:
        conn = await get_db()
        org_id = await get_or_create_org()
        
        query = """
            INSERT INTO payment_plans (org_id, name, description, amount, currency, billing_cycle, session_count, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, true)
            RETURNING id::text
        """
        
        result = await conn.fetchrow(
            query, org_id, plan.name, plan.description, plan.amount,
            plan.currency, plan.billing_cycle, plan.session_count
        )
        
        await conn.close()
        return {"success": True, "plan_id": result['id']}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/payments/create-link")
async def create_payment_link(payment: PaymentLinkCreate):
    """Create Razorpay payment link"""
    try:
        # TODO: Integrate actual Razorpay API
        # For now, return mock payment link
        
        payment_link = f"https://rzp.io/i/{payment.client_id[:8]}"
        
        conn = await get_db()
        org_id = await get_or_create_org()
        
        # Create transaction record
        await conn.execute("""
            INSERT INTO payment_transactions (org_id, client_id, amount, currency, payment_method, status)
            VALUES ($1, $2::uuid, $3, 'INR', 'razorpay', 'pending')
        """, org_id, payment.client_id, payment.amount)
        
        await conn.close()
        
        return {
            "success": True,
            "payment_link": payment_link,
            "amount": payment.amount,
            "currency": "INR"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/payments/client/{client_id}")
async def get_client_payments(client_id: str):
    try:
        conn = await get_db()
        
        query = """
            SELECT id::text, amount, currency, status, payment_method, created_at::text, paid_at::text
            FROM payment_transactions
            WHERE client_id = $1::uuid
            ORDER BY created_at DESC
        """
        
        rows = await conn.fetch(query, client_id)
        await conn.close()
        
        return {"success": True, "payments": [dict(row) for row in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# WORKOUT TEMPLATES
# ============================================================================

@router.get("/workouts/templates")
async def get_workout_templates():
    try:
        conn = await get_db()
        
        query = """
            SELECT 
                id::text, name, description, session_type, 
                duration_minutes, structure, created_at::text
            FROM session_templates
            WHERE is_active = true AND deleted_at IS NULL
            ORDER BY created_at DESC
        """
        
        rows = await conn.fetch(query)
        await conn.close()
        
        return {"success": True, "templates": [dict(row) for row in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/workouts/templates")
async def create_workout_template(template: WorkoutTemplateCreate):
    try:
        conn = await get_db()
        org_id = await get_or_create_org()
        
        # Get a coach for created_by
        coach = await conn.fetchrow(
            "SELECT id FROM users WHERE role = 'coach' AND deleted_at IS NULL LIMIT 1"
        )
        
        query = """
            INSERT INTO session_templates 
            (org_id, created_by, name, description, session_type, duration_minutes, structure, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, true)
            RETURNING id::text
        """
        
        result = await conn.fetchrow(
            query, org_id, coach['id'] if coach else None,
            template.name, template.description, template.session_type,
            template.duration_minutes, json.dumps(template.structure) if template.structure else None
        )
        
        await conn.close()
        return {"success": True, "template_id": result['id']}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/workouts/assign")
async def assign_workout(assignment: AssignWorkout):
    """Assign workout template to client on specific dates"""
    try:
        conn = await get_db()
        org_id = await get_or_create_org()
        
        # Get coach
        coach = await conn.fetchrow(
            "SELECT id FROM users WHERE role = 'coach' AND deleted_at IS NULL LIMIT 1"
        )
        
        # Create sessions for each date
        for date_str in assignment.scheduled_dates:
            await conn.execute("""
                INSERT INTO scheduled_sessions 
                (org_id, coach_id, client_id, session_template_id, scheduled_at, status)
                VALUES ($1, $2, $3::uuid, $4::uuid, $5, 'scheduled')
            """, org_id, coach['id'], assignment.client_id, assignment.template_id, date_str)
        
        await conn.close()
        return {"success": True, "sessions_created": len(assignment.scheduled_dates)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# REFERRALS
# ============================================================================

@router.get("/referrals")
async def get_referrals():
    try:
        conn = await get_db()
        
        query = """
            SELECT 
                ri.id::text,
                ri.invite_code,
                ri.referee_contact,
                ri.referee_name,
                ri.status,
                ri.reward_type,
                ri.reward_value,
                ri.created_at::text,
                u.full_name as referrer_name
            FROM referral_invites ri
            JOIN users u ON ri.referrer_id = u.id
            ORDER BY ri.created_at DESC
            LIMIT 50
        """
        
        rows = await conn.fetch(query)
        await conn.close()
        
        return {"success": True, "referrals": [dict(row) for row in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/referrals/create")
async def create_referral(referrer_id: str, referee_contact: str, referee_name: str):
    try:
        conn = await get_db()
        org_id = await get_or_create_org()
        
        # Generate invite code
        import random
        import string
        invite_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))
        
        query = """
            INSERT INTO referral_invites 
            (org_id, referrer_id, referee_contact, referee_name, invite_code, status, reward_type, reward_value)
            VALUES ($1, $2::uuid, $3, $4, $5, 'pending', 'discount', 500)
            RETURNING id::text, invite_code
        """
        
        result = await conn.fetchrow(
            query, org_id, referrer_id, referee_contact, referee_name, invite_code
        )
        
        await conn.close()
        return {"success": True, "invite_code": result['invite_code']}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# DASHBOARD STATS
# ============================================================================

@router.get("/dashboard/stats")
async def get_dashboard_stats():
    try:
        conn = await get_db()
        
        # Get counts
        total_clients = await conn.fetchval(
            "SELECT COUNT(*) FROM users WHERE role = 'client' AND deleted_at IS NULL"
        )
        total_sessions = await conn.fetchval(
            "SELECT COUNT(*) FROM scheduled_sessions"
        )
        completed_sessions = await conn.fetchval(
            "SELECT COUNT(*) FROM scheduled_sessions WHERE status = 'completed'"
        )
        total_revenue = await conn.fetchval(
            "SELECT COALESCE(SUM(amount), 0) FROM payment_transactions WHERE status = 'success'"
        )
        
        await conn.close()
        
        return {
            "success": True,
            "stats": {
                "total_clients": total_clients,
                "total_sessions": total_sessions,
                "completed_sessions": completed_sessions,
                "total_revenue": float(total_revenue)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# COACH REGISTRATION & MANAGEMENT
# ============================================================================

class CoachRegistration(BaseModel):
    full_name: str
    email: str
    phone: str
    phone_country_code: str = "+91"
    password: Optional[str] = None
    specialization: Optional[str] = None  # yoga, gym, nutrition, etc.
    bio: Optional[str] = None
    certifications: Optional[List[str]] = None
    experience_years: Optional[int] = None

@router.post("/coaches/register")
async def register_coach(coach: CoachRegistration):
    """Register new coach - can be self-registration or admin creates"""
    try:
        conn = await get_db()
        
        # Check if phone already exists
        existing = await conn.fetchrow(
            "SELECT id FROM users WHERE phone = $1 AND deleted_at IS NULL",
            coach.phone
        )
        if existing:
            raise HTTPException(status_code=400, detail="Phone number already registered")
        
        # Get or create organization
        org_id = await get_or_create_org()
        
        # Hash password if provided
        password_hash = None
        if coach.password:
            from auth import get_password_hash
            password_hash = get_password_hash(coach.password)
        
        # Build metadata
        metadata = {
            "specialization": coach.specialization,
            "bio": coach.bio,
            "certifications": coach.certifications or [],
            "experience_years": coach.experience_years
        }
        
        # Create coach user
        query = """
            INSERT INTO users 
            (primary_org_id, full_name, email, phone, phone_country_code, role, password_hash, metadata, is_active)
            VALUES ($1, $2, $3, $4, $5, 'coach', $6, $7, true)
            RETURNING id::text, full_name, email, phone, role
        """
        
        new_coach = await conn.fetchrow(
            query, org_id, coach.full_name, coach.email, coach.phone,
            coach.phone_country_code, password_hash, json.dumps(metadata)
        )
        
        # Also add to user_organizations
        await conn.execute("""
            INSERT INTO user_organizations (user_id, org_id, role_in_org, is_primary)
            VALUES ($1, $2, 'coach', true)
        """, new_coach['id'], org_id)
        
        await conn.close()
        
        # Generate token
        from auth import create_access_token
        token = create_access_token(data={"sub": new_coach['id'], "role": "coach"})
        
        return {
            "success": True,
            "message": "Coach registered successfully",
            "access_token": token,
            "token_type": "bearer",
            "coach": dict(new_coach)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/coaches")
async def get_coaches(org_id: Optional[str] = None):
    """Get all coaches, optionally filtered by organization"""
    try:
        conn = await get_db()
        
        if org_id:
            query = """
                SELECT 
                    u.id::text,
                    u.full_name,
                    u.email,
                    u.phone,
                    u.metadata,
                    u.created_at::text,
                    COUNT(DISTINCT ss.id) as total_sessions
                FROM users u
                LEFT JOIN scheduled_sessions ss ON u.id = ss.coach_id
                WHERE u.role = 'coach' 
                AND u.primary_org_id = $1::uuid 
                AND u.deleted_at IS NULL
                GROUP BY u.id, u.full_name, u.email, u.phone, u.metadata, u.created_at
            """
            rows = await conn.fetch(query, org_id)
        else:
            query = """
                SELECT 
                    u.id::text,
                    u.full_name,
                    u.email,
                    u.phone,
                    u.metadata,
                    u.created_at::text,
                    o.name as org_name,
                    COUNT(DISTINCT ss.id) as total_sessions
                FROM users u
                LEFT JOIN organizations o ON u.primary_org_id = o.id
                LEFT JOIN scheduled_sessions ss ON u.id = ss.coach_id
                WHERE u.role = 'coach' AND u.deleted_at IS NULL
                GROUP BY u.id, u.full_name, u.email, u.phone, u.metadata, u.created_at, o.name
            """
            rows = await conn.fetch(query)
        
        await conn.close()
        
        return {
            "success": True,
            "coaches": [dict(row) for row in rows]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# WORKOUT/COURSE LIBRARY (Org-Specific)
# ============================================================================

class WorkoutCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: str  # yoga, gym, nutrition, cardio, strength, flexibility, etc.
    difficulty_level: str = "intermediate"  # beginner, intermediate, advanced
    duration_minutes: int = 60
    equipment_needed: Optional[List[str]] = None
    exercises: Optional[List[dict]] = None  # [{name, sets, reps, duration, notes}]
    video_url: Optional[str] = None
    image_url: Optional[str] = None
    tags: Optional[List[str]] = None
    is_public: bool = False  # Can other coaches in org see it?

class WorkoutUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    difficulty_level: Optional[str] = None
    duration_minutes: Optional[int] = None
    equipment_needed: Optional[List[str]] = None
    exercises: Optional[List[dict]] = None
    video_url: Optional[str] = None
    image_url: Optional[str] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None

@router.post("/workouts/library")
async def create_workout(workout: WorkoutCreate, coach_id: str):
    """Create workout/course in library"""
    try:
        conn = await get_db()
        
        # Get coach's org
        coach = await conn.fetchrow(
            "SELECT primary_org_id FROM users WHERE id = $1::uuid",
            coach_id
        )
        
        if not coach:
            raise HTTPException(status_code=404, detail="Coach not found")
        
        org_id = coach['primary_org_id']
        
        # Build structure JSON
        structure = {
            "equipment_needed": workout.equipment_needed or [],
            "exercises": workout.exercises or [],
            "video_url": workout.video_url,
            "image_url": workout.image_url,
            "difficulty_level": workout.difficulty_level
        }
        
        # Build tags - include category
        tags = workout.tags or []
        if workout.category not in tags:
            tags.append(workout.category)
        
        query = """
            INSERT INTO session_templates 
            (org_id, created_by, name, description, session_type, duration_minutes, structure, is_active, content_refs)
            VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, true, $8)
            RETURNING id::text, name, session_type, created_at::text
        """
        
        result = await conn.fetchrow(
            query, org_id, coach_id, workout.name, workout.description,
            workout.category, workout.duration_minutes, 
            json.dumps(structure), json.dumps(tags)
        )
        
        await conn.close()
        
        return {
            "success": True,
            "message": "Workout added to library",
            "workout": dict(result)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/workouts/library")
async def get_workout_library(
    org_id: Optional[str] = None,
    category: Optional[str] = None,
    coach_id: Optional[str] = None,
    difficulty: Optional[str] = None
):
    """Get workout library filtered by org, category, coach, or difficulty"""
    try:
        conn = await get_db()
        
        conditions = ["st.deleted_at IS NULL", "st.is_active = true"]
        params = []
        idx = 1
        
        if org_id:
            conditions.append(f"st.org_id = ${idx}::uuid")
            params.append(org_id)
            idx += 1
        
        if category:
            conditions.append(f"st.session_type = ${idx}")
            params.append(category)
            idx += 1
        
        if coach_id:
            conditions.append(f"st.created_by = ${idx}::uuid")
            params.append(coach_id)
            idx += 1
        
        if difficulty:
            conditions.append(f"st.structure->>'difficulty_level' = ${idx}")
            params.append(difficulty)
            idx += 1
        
        where_clause = " AND ".join(conditions)
        
        query = f"""
            SELECT 
                st.id::text,
                st.name,
                st.description,
                st.session_type as category,
                st.duration_minutes,
                st.structure,
                st.content_refs as tags,
                st.created_at::text,
                u.full_name as created_by_name,
                o.name as org_name,
                COUNT(DISTINCT ss.id) as times_used
            FROM session_templates st
            JOIN users u ON st.created_by = u.id
            JOIN organizations o ON st.org_id = o.id
            LEFT JOIN scheduled_sessions ss ON st.id = ss.session_template_id
            WHERE {where_clause}
            GROUP BY st.id, st.name, st.description, st.session_type, st.duration_minutes, 
                     st.structure, st.content_refs, st.created_at, u.full_name, o.name
            ORDER BY st.created_at DESC
        """
        
        rows = await conn.fetch(query, *params)
        await conn.close()
        
        return {
            "success": True,
            "workouts": [dict(row) for row in rows]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/workouts/library/{workout_id}")
async def get_workout_detail(workout_id: str):
    """Get detailed workout information"""
    try:
        conn = await get_db()
        
        workout = await conn.fetchrow("""
            SELECT 
                st.*,
                u.full_name as created_by_name,
                o.name as org_name,
                o.category as org_category
            FROM session_templates st
            JOIN users u ON st.created_by = u.id
            JOIN organizations o ON st.org_id = o.id
            WHERE st.id = $1::uuid AND st.deleted_at IS NULL
        """, workout_id)
        
        if not workout:
            raise HTTPException(status_code=404, detail="Workout not found")
        
        await conn.close()
        
        return {
            "success": True,
            "workout": dict(workout)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/workouts/library/{workout_id}")
async def update_workout(workout_id: str, updates: WorkoutUpdate):
    """Update workout in library"""
    try:
        conn = await get_db()
        
        # Get current workout
        current = await conn.fetchrow(
            "SELECT structure FROM session_templates WHERE id = $1::uuid",
            workout_id
        )
        
        if not current:
            raise HTTPException(status_code=404, detail="Workout not found")
        
        # Build updates
        update_fields = []
        values = []
        idx = 1
        
        if updates.name:
            update_fields.append(f"name = ${idx}")
            values.append(updates.name)
            idx += 1
        
        if updates.description:
            update_fields.append(f"description = ${idx}")
            values.append(updates.description)
            idx += 1
        
        if updates.category:
            update_fields.append(f"session_type = ${idx}")
            values.append(updates.category)
            idx += 1
        
        if updates.duration_minutes:
            update_fields.append(f"duration_minutes = ${idx}")
            values.append(updates.duration_minutes)
            idx += 1
        
        # Update structure if any structural changes
        if any([updates.equipment_needed, updates.exercises, updates.difficulty_level, 
                updates.video_url, updates.image_url]):
            structure = json.loads(current['structure']) if current['structure'] else {}
            
            if updates.equipment_needed is not None:
                structure['equipment_needed'] = updates.equipment_needed
            if updates.exercises is not None:
                structure['exercises'] = updates.exercises
            if updates.difficulty_level is not None:
                structure['difficulty_level'] = updates.difficulty_level
            if updates.video_url is not None:
                structure['video_url'] = updates.video_url
            if updates.image_url is not None:
                structure['image_url'] = updates.image_url
            
            update_fields.append(f"structure = ${idx}")
            values.append(json.dumps(structure))
            idx += 1
        
        if updates.tags is not None:
            update_fields.append(f"content_refs = ${idx}")
            values.append(json.dumps(updates.tags))
            idx += 1
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        update_fields.append("updated_at = NOW()")
        values.append(workout_id)
        
        query = f"""
            UPDATE session_templates 
            SET {', '.join(update_fields)}
            WHERE id = ${idx}::uuid
            RETURNING id::text
        """
        
        result = await conn.fetchrow(query, *values)
        await conn.close()
        
        if not result:
            raise HTTPException(status_code=404, detail="Workout not found")
        
        return {
            "success": True,
            "message": "Workout updated successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/workouts/library/{workout_id}")
async def delete_workout(workout_id: str):
    """Soft delete workout from library"""
    try:
        conn = await get_db()
        
        result = await conn.fetchrow("""
            UPDATE session_templates 
            SET deleted_at = NOW(), is_active = false
            WHERE id = $1::uuid AND deleted_at IS NULL
            RETURNING id::text
        """, workout_id)
        
        await conn.close()
        
        if not result:
            raise HTTPException(status_code=404, detail="Workout not found")
        
        return {
            "success": True,
            "message": "Workout deleted successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/workouts/assign-to-client")
async def assign_workout_to_client(
    workout_id: str,
    client_id: str,
    scheduled_dates: List[str],
    coach_id: str,
    notes: Optional[str] = None
):
    """Assign workout from library to client on specific dates"""
    try:
        conn = await get_db()
        
        # Get workout and org
        workout = await conn.fetchrow(
            "SELECT org_id, name FROM session_templates WHERE id = $1::uuid",
            workout_id
        )
        
        if not workout:
            raise HTTPException(status_code=404, detail="Workout not found")
        
        # Create sessions for each date
        sessions_created = []
        for date_str in scheduled_dates:
            session = await conn.fetchrow("""
                INSERT INTO scheduled_sessions 
                (org_id, coach_id, client_id, session_template_id, scheduled_at, status, notes)
                VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5, 'scheduled', $6)
                RETURNING id::text, scheduled_at::text
            """, workout['org_id'], coach_id, client_id, workout_id, date_str, notes)
            
            sessions_created.append(dict(session))
        
        await conn.close()
        
        return {
            "success": True,
            "message": f"Workout '{workout['name']}' assigned to client",
            "sessions_created": len(sessions_created),
            "sessions": sessions_created
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/workouts/categories")
async def get_workout_categories():
    """Get all available workout categories"""
    return {
        "success": True,
        "categories": [
            {"value": "yoga", "label": "Yoga", "icon": "🧘"},
            {"value": "gym", "label": "Gym/Strength", "icon": "🏋️"},
            {"value": "cardio", "label": "Cardio", "icon": "🏃"},
            {"value": "hiit", "label": "HIIT", "icon": "⚡"},
            {"value": "pilates", "label": "Pilates", "icon": "🤸"},
            {"value": "nutrition", "label": "Nutrition Plan", "icon": "🥗"},
            {"value": "flexibility", "label": "Flexibility", "icon": "🤾"},
            {"value": "crossfit", "label": "CrossFit", "icon": "💪"},
            {"value": "meditation", "label": "Meditation", "icon": "🧠"},
            {"value": "dance", "label": "Dance Fitness", "icon": "💃"},
            {"value": "martial_arts", "label": "Martial Arts", "icon": "🥋"},
            {"value": "swimming", "label": "Swimming", "icon": "🏊"},
            {"value": "cycling", "label": "Cycling", "icon": "🚴"},
            {"value": "running", "label": "Running", "icon": "🏃‍♂️"},
            {"value": "sports", "label": "Sports Training", "icon": "⚽"},
            {"value": "rehabilitation", "label": "Rehabilitation", "icon": "🩹"},
            {"value": "prenatal", "label": "Prenatal Fitness", "icon": "🤰"},
            {"value": "senior", "label": "Senior Fitness", "icon": "👴"},
            {"value": "kids", "label": "Kids Fitness", "icon": "👶"},
            {"value": "other", "label": "Other", "icon": "📋"}
        ]
    }

# ============================================================================
# ENHANCED CLIENT MANAGEMENT WITH DETAILED PROFILES
# ============================================================================

class ClientCreateEnhanced(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    # Physical Details
    current_weight: Optional[float] = None
    target_weight: Optional[float] = None
    height: Optional[float] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    # Fitness Goals
    target_body_type: Optional[str] = None  # lean, muscular, athletic, weight_loss, etc.
    fitness_goal: Optional[str] = None  # strength, endurance, flexibility, weight_loss, etc.
    # Diet & Nutrition
    current_diet: Optional[str] = None
    dietary_restrictions: Optional[List[str]] = None
    target_calories: Optional[int] = None
    # Medical & Lifestyle
    medical_conditions: Optional[List[str]] = None
    injuries: Optional[List[str]] = None
    activity_level: Optional[str] = None  # sedentary, light, moderate, active, very_active
    sleep_hours: Optional[int] = None
    # Progress Tracking
    progress_check_frequency: str = "monthly"  # weekly, biweekly, monthly
    preferred_contact_method: str = "whatsapp"

@router.post("/clients/enhanced")
async def create_client_enhanced(client: ClientCreateEnhanced):
    """Create client with detailed profile information"""
    try:
        conn = await get_db()
        org_id = await get_or_create_org()
        
        # Build metadata with all details
        metadata = {
            "physical": {
                "current_weight": client.current_weight,
                "target_weight": client.target_weight,
                "height": client.height,
                "age": client.age,
                "gender": client.gender
            },
            "goals": {
                "target_body_type": client.target_body_type,
                "fitness_goal": client.fitness_goal
            },
            "nutrition": {
                "current_diet": client.current_diet,
                "dietary_restrictions": client.dietary_restrictions or [],
                "target_calories": client.target_calories
            },
            "medical": {
                "conditions": client.medical_conditions or [],
                "injuries": client.injuries or [],
                "activity_level": client.activity_level,
                "sleep_hours": client.sleep_hours
            },
            "tracking": {
                "progress_check_frequency": client.progress_check_frequency,
                "preferred_contact": client.preferred_contact_method,
                "next_check_date": (datetime.utcnow() + timedelta(days=30)).isoformat()  # Default monthly
            }
        }
        
        query = """
            INSERT INTO users (primary_org_id, full_name, email, phone, role, metadata, is_active, is_verified)
            VALUES ($1, $2, $3, $4, 'client', $5, true, true)
            RETURNING id::text, full_name as name, email, phone, metadata
        """
        
        row = await conn.fetchrow(query, org_id, client.name, client.email, client.phone, json.dumps(metadata))
        await conn.close()
        
        return {
            "success": True,
            "client": dict(row),
            "message": "Client created with detailed profile"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# NUTRITION PLANS
# ============================================================================

class NutritionPlanCreate(BaseModel):
    name: str
    description: Optional[str] = None
    calories: int
    protein: Optional[int] = None  # grams
    carbs: Optional[int] = None
    fats: Optional[int] = None
    meals: Optional[List[dict]] = None  # [{meal_type, items, calories}]
    dietary_type: str = "balanced"  # balanced, keto, paleo, vegan, etc.
    duration_days: int = 7

@router.post("/nutrition/plans")
async def create_nutrition_plan(plan: NutritionPlanCreate):
    """Create nutrition plan"""
    try:
        conn = await get_db()
        org_id = await get_or_create_org()
        
        # Get coach
        coach = await conn.fetchrow(
            "SELECT id FROM users WHERE role = 'coach' AND deleted_at IS NULL LIMIT 1"
        )
        
        structure = {
            "calories": plan.calories,
            "macros": {
                "protein": plan.protein,
                "carbs": plan.carbs,
                "fats": plan.fats
            },
            "meals": plan.meals or [],
            "dietary_type": plan.dietary_type,
            "duration_days": plan.duration_days
        }
        
        query = """
            INSERT INTO session_templates 
            (org_id, created_by, name, description, session_type, duration_minutes, structure, is_active)
            VALUES ($1, $2, $3, $4, 'nutrition', 0, $5, true)
            RETURNING id::text, name, description
        """
        
        result = await conn.fetchrow(
            query, org_id, coach['id'] if coach else None,
            plan.name, plan.description, json.dumps(structure)
        )
        
        await conn.close()
        
        return {
            "success": True,
            "plan": dict(result),
            "message": "Nutrition plan created"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/nutrition/plans")
async def get_nutrition_plans(dietary_type: Optional[str] = None):
    """Get all nutrition plans"""
    try:
        conn = await get_db()
        
        conditions = ["session_type = 'nutrition'", "deleted_at IS NULL"]
        params = []
        
        if dietary_type:
            conditions.append("structure->>'dietary_type' = $1")
            params.append(dietary_type)
        
        where_clause = " AND ".join(conditions)
        
        query = f"""
            SELECT 
                id::text,
                name,
                description,
                structure,
                created_at::text
            FROM session_templates
            WHERE {where_clause}
            ORDER BY created_at DESC
        """
        
        rows = await conn.fetch(query, *params)
        await conn.close()
        
        return {
            "success": True,
            "plans": [dict(row) for row in rows]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/nutrition/assign")
async def assign_nutrition_plan(
    plan_id: str,
    client_id: str,
    start_date: str,
    coach_id: str
):
    """Assign nutrition plan to client"""
    try:
        conn = await get_db()
        
        # Get plan
        plan = await conn.fetchrow(
            "SELECT org_id, structure FROM session_templates WHERE id = $1::uuid",
            plan_id
        )
        
        if not plan:
            raise HTTPException(status_code=404, detail="Nutrition plan not found")
        
        # Parse structure for duration
        structure = json.loads(plan['structure']) if plan['structure'] else {}
        duration_days = structure.get('duration_days', 7)
        
        # Create nutrition assignment as a session
        query = """
            INSERT INTO scheduled_sessions 
            (org_id, coach_id, client_id, session_template_id, scheduled_at, status, notes)
            VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5, 'scheduled', 'Nutrition plan assigned')
            RETURNING id::text
        """
        
        result = await conn.fetchrow(
            query, plan['org_id'], coach_id, client_id, plan_id, start_date
        )
        
        await conn.close()
        
        return {
            "success": True,
            "assignment_id": result['id'],
            "duration_days": duration_days,
            "message": "Nutrition plan assigned to client"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# ENHANCED PROGRESS TRACKING WITH CONSISTENCY METRICS

# ============================================================================
# COACH TIME SLOT MANAGEMENT
# ============================================================================

class TimeSlotCreate(BaseModel):
    day_of_week: int  # 0=Monday, 6=Sunday
    start_time: str  # "09:00"
    end_time: str  # "10:00"
    is_recurring: bool = True
    location_type: str = "online"  # online, offline
    location_address: Optional[str] = None
    max_clients: int = 1

@router.post("/coach/time-slots")
async def create_time_slot(slot: TimeSlotCreate):
    """Create coach availability time slot"""
    try:
        conn = await get_db()
        org_id = await get_or_create_org()
        
        # Get first coach (in production, use authenticated coach)
        coach = await conn.fetchrow(
            "SELECT id FROM users WHERE role = 'coach' AND deleted_at IS NULL LIMIT 1"
        )
        
        if not coach:
            raise HTTPException(status_code=404, detail="No coach found")
        
        metadata = {
            "is_recurring": slot.is_recurring,
            "location_type": slot.location_type,
            "location_address": slot.location_address,
            "max_clients": slot.max_clients
        }
        
        query = """
            INSERT INTO session_templates 
            (org_id, created_by, name, session_type, duration_minutes, structure, is_active)
            VALUES ($1, $2, $3, 'time_slot', $4, $5, true)
            RETURNING id::text, name, duration_minutes, structure
        """
        
        duration = int((datetime.strptime(slot.end_time, "%H:%M") - 
                       datetime.strptime(slot.start_time, "%H:%M")).total_seconds() / 60)
        
        slot_name = f"{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][slot.day_of_week]} {slot.start_time}-{slot.end_time}"
        
        structure = {
            "day_of_week": slot.day_of_week,
            "start_time": slot.start_time,
            "end_time": slot.end_time,
            **metadata
        }
        
        result = await conn.fetchrow(
            query, org_id, coach['id'], slot_name, duration, json.dumps(structure)
        )
        await conn.close()
        
        return {
            "success": True,
            "time_slot": dict(result),
            "message": "Time slot created"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/coach/time-slots")
async def get_coach_time_slots():
    """Get all coach time slots"""
    try:
        conn = await get_db()
        
        query = """
            SELECT 
                id::text,
                name,
                duration_minutes,
                structure,
                is_active,
                created_at::text
            FROM session_templates
            WHERE session_type = 'time_slot'
            AND deleted_at IS NULL
            ORDER BY structure->>'day_of_week', structure->>'start_time'
        """
        
        rows = await conn.fetch(query)
        await conn.close()
        
        return {
            "success": True,
            "time_slots": [dict(row) for row in rows]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# ASSIGN CLIENT TO TIME SLOT
# ============================================================================

@router.post("/sessions/assign-to-slot")
async def assign_client_to_slot(
    time_slot_id: str = Body(...),
    client_id: str = Body(...),
    start_date: str = Body(...),
    num_sessions: int = Body(4)
):
    """Assign client to recurring time slot"""
    try:
        conn = await get_db()
        
        # Get time slot details
        slot = await conn.fetchrow(
            "SELECT org_id, created_by, structure FROM session_templates WHERE id = $1::uuid",
            time_slot_id
        )
        
        if not slot:
            raise HTTPException(status_code=404, detail="Time slot not found")
        
        structure = json.loads(slot['structure'])
        day_of_week = structure['day_of_week']
        start_time = structure['start_time']
        
        # Create sessions for next N weeks
        sessions_created = []
        start = datetime.fromisoformat(start_date)
        
        # Find next occurrence of the day
        days_ahead = day_of_week - start.weekday()
        if days_ahead < 0:
            days_ahead += 7
        next_date = start + timedelta(days=days_ahead)
        
        for i in range(num_sessions):
            session_datetime = datetime.combine(
                next_date + timedelta(weeks=i),
                datetime.strptime(start_time, "%H:%M").time()
            )
            
            query = """
                INSERT INTO scheduled_sessions 
                (org_id, coach_id, client_id, session_template_id, scheduled_at, status, location)
                VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5, 'scheduled', $6)
                RETURNING id::text
            """
            
            result = await conn.fetchrow(
                query, slot['org_id'], slot['created_by'], client_id, time_slot_id,
                session_datetime, structure.get('location_type', 'online')
            )
            
            sessions_created.append(result['id'])
        
        await conn.close()
        
        return {
            "success": True,
            "sessions_created": len(sessions_created),
            "session_ids": sessions_created,
            "message": f"Created {len(sessions_created)} sessions"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# CANCEL SESSION WITH REASON
# ============================================================================

@router.post("/sessions/{session_id}/cancel")
async def cancel_session(
    session_id: str,
    reason: str = Body(...),
    cancelled_by: str = Body("coach")  # coach or client
):
    """Cancel a session with reason"""
    try:
        conn = await get_db()
        
        # Get current session
        session = await conn.fetchrow(
            "SELECT metadata FROM scheduled_sessions WHERE id = $1::uuid",
            session_id
        )
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Update metadata with cancellation info
        metadata = json.loads(session['metadata']) if session['metadata'] else {}
        metadata['cancellation'] = {
            "cancelled_by": cancelled_by,
            "reason": reason,
            "cancelled_at": datetime.utcnow().isoformat()
        }
        
        query = """
            UPDATE scheduled_sessions
            SET status = 'cancelled',
                metadata = $1,
                updated_at = NOW()
            WHERE id = $2::uuid
            RETURNING id::text, status, metadata
        """
        
        result = await conn.fetchrow(query, json.dumps(metadata), session_id)
        await conn.close()
        
        return {
            "success": True,
            "session": dict(result),
            "message": f"Session cancelled: {reason}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# BULK CANCEL SESSIONS
# ============================================================================

@router.post("/sessions/bulk-cancel")
async def bulk_cancel_sessions(
    session_ids: List[str] = Body(...),
    reason: str = Body(...),
    cancelled_by: str = Body("coach")
):
    """Cancel multiple sessions at once"""
    try:
        conn = await get_db()
        
        metadata = json.dumps({
            "cancellation": {
                "cancelled_by": cancelled_by,
                "reason": reason,
                "cancelled_at": datetime.utcnow().isoformat()
            }
        })
        
        query = """
            UPDATE scheduled_sessions
            SET status = 'cancelled',
                metadata = $1,
                updated_at = NOW()
            WHERE id = ANY($2::uuid[])
            RETURNING id::text
        """
        
        results = await conn.fetch(query, metadata, session_ids)
        await conn.close()
        
        return {
            "success": True,
            "cancelled_count": len(results),
            "message": f"Cancelled {len(results)} sessions"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# MARK ATTENDANCE WITH NOTES
# ============================================================================

@router.post("/sessions/{session_id}/attendance")
async def mark_session_attendance(
    session_id: str,
    status: str = Body(...),  # attended, absent, late
    notes: Optional[str] = Body(None),
    late_minutes: Optional[int] = Body(None)
):
    """Mark attendance for a session"""
    try:
        conn = await get_db()
        
        # Get current metadata
        session = await conn.fetchrow(
            "SELECT metadata FROM scheduled_sessions WHERE id = $1::uuid",
            session_id
        )
        
        metadata = json.loads(session['metadata']) if session['metadata'] else {}
        metadata['attendance'] = {
            "status": status,
            "notes": notes,
            "late_minutes": late_minutes,
            "marked_at": datetime.utcnow().isoformat()
        }
        
        # Update session status
        session_status = 'completed' if status == 'attended' else 'cancelled'
        
        query = """
            UPDATE scheduled_sessions
            SET status = $1,
                metadata = $2,
                updated_at = NOW()
            WHERE id = $3::uuid
            RETURNING id::text, status, metadata
        """
        
        result = await conn.fetchrow(query, session_status, json.dumps(metadata), session_id)
        await conn.close()
        
        return {
            "success": True,
            "session": dict(result),
            "message": f"Attendance marked: {status}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# GET SESSIONS WITH FILTERS
# ============================================================================

@router.get("/sessions/filter")
async def get_filtered_sessions(
    status: Optional[str] = None,  # scheduled, completed, cancelled
    client_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    include_cancelled: bool = False
):
    """Get sessions with various filters"""
    try:
        conn = await get_db()
        
        conditions = ["ss.deleted_at IS NULL"]
        params = []
        param_count = 1
        
        if status:
            conditions.append(f"ss.status = ${param_count}")
            params.append(status)
            param_count += 1
        
        if client_id:
            conditions.append(f"ss.client_id = ${param_count}::uuid")
            params.append(client_id)
            param_count += 1
        
        if from_date:
            conditions.append(f"ss.scheduled_at >= ${param_count}::timestamp")
            params.append(from_date)
            param_count += 1
        
        if to_date:
            conditions.append(f"ss.scheduled_at <= ${param_count}::timestamp")
            params.append(to_date)
            param_count += 1
        
        if not include_cancelled:
            conditions.append("ss.status != 'cancelled'")
        
        where_clause = " AND ".join(conditions)
        
        query = f"""
            SELECT 
                ss.id::text,
                ss.scheduled_at::text,
                ss.status,
                ss.duration_minutes,
                ss.location,
                ss.notes,
                ss.metadata,
                u.full_name as client_name,
                u.id::text as client_id,
                st.name as template_name
            FROM scheduled_sessions ss
            JOIN users u ON ss.client_id = u.id
            LEFT JOIN session_templates st ON ss.session_template_id = st.id
            WHERE {where_clause}
            ORDER BY ss.scheduled_at DESC
        """
        
        rows = await conn.fetch(query, *params)
        await conn.close()
        
        return {
            "success": True,
            "sessions": [dict(row) for row in rows],
            "count": len(rows)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# CREATE RECURRING SESSIONS
# ============================================================================

class RecurringSessionCreate(BaseModel):
    client_id: str
    recurrence_type: str  # daily, weekly, biweekly, monthly
    start_date: str
    num_sessions: int = 10
    time: str = "09:00"  # HH:MM format
    duration_minutes: int = 60
    location: str = "online"
    notes: Optional[str] = None
    # For weekly recurrence
    day_of_week: Optional[int] = None  # 0=Monday, 6=Sunday (only for weekly)

@router.post("/sessions/create-recurring")
async def create_recurring_sessions(data: RecurringSessionCreate):
    """Create multiple recurring sessions"""
    try:
        conn = await get_db()
        org_id = await get_or_create_org()
        
        # Get coach
        coach = await conn.fetchrow(
            "SELECT id FROM users WHERE role = 'coach' AND deleted_at IS NULL LIMIT 1"
        )
        
        if not coach:
            raise HTTPException(status_code=404, detail="No coach found")
        
        sessions_created = []
        start = datetime.fromisoformat(data.start_date)
        
        for i in range(data.num_sessions):
            # Calculate session date based on recurrence type
            if data.recurrence_type == 'daily':
                session_date = start + timedelta(days=i)
            elif data.recurrence_type == 'weekly':
                session_date = start + timedelta(weeks=i)
            elif data.recurrence_type == 'biweekly':
                session_date = start + timedelta(weeks=i*2)
            elif data.recurrence_type == 'monthly':
                # Add months (approximate with 30 days)
                session_date = start + timedelta(days=i*30)
            else:
                session_date = start + timedelta(days=i)
            
            # Combine date with time
            session_datetime = datetime.combine(
                session_date.date(),
                datetime.strptime(data.time, "%H:%M").time()
            )
            
            # Insert session
            query = """
                INSERT INTO scheduled_sessions 
                (org_id, coach_id, client_id, scheduled_at, duration_minutes, 
                 status, location, notes, metadata)
                VALUES ($1, $2::uuid, $3::uuid, $4, $5, 'scheduled', $6, $7, $8)
                RETURNING id::text, scheduled_at::text
            """
            
            metadata = {
                "recurrence_type": data.recurrence_type,
                "session_number": i + 1,
                "total_sessions": data.num_sessions
            }
            
            result = await conn.fetchrow(
                query, org_id, coach['id'], data.client_id,
                session_datetime, data.duration_minutes,
                data.location, data.notes, json.dumps(metadata)
            )
            
            sessions_created.append(dict(result))
        
        await conn.close()
        
        return {
            "success": True,
            "sessions_created": len(sessions_created),
            "sessions": sessions_created,
            "message": f"Created {len(sessions_created)} {data.recurrence_type} sessions"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

