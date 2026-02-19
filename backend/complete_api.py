from fastapi import FastAPI, APIRouter, HTTPException, Body, Query, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import asyncpg, json, os, uuid, hashlib, base64
from datetime import datetime, timedelta

def parse_dt(s):
    if isinstance(s, datetime): return s
    for fmt in ('%Y-%m-%dT%H:%M:%S','%Y-%m-%dT%H:%M','%Y-%m-%d %H:%M:%S','%Y-%m-%d %H:%M','%Y-%m-%d'):
        try: return datetime.strptime(s, fmt)
        except: continue
    raise ValueError(f"Cannot parse datetime: {s}")

app = FastAPI(title="Coach Platform API", version="4.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
router = APIRouter()

DB_CONFIG = dict(
    host=os.getenv("DB_HOST","coach-db-1770519048.postgres.database.azure.com"),
    database=os.getenv("DB_NAME","coach_platform"), user=os.getenv("DB_USER","dbadmin"),
    password=os.getenv("DB_PASSWORD","CoachPlatform2026!SecureDB"),
    port=int(os.getenv("DB_PORT",5432)),
    ssl="require" if os.getenv("DB_SSL","true").lower()=="true" else None,
)

async def get_db():
    return await asyncpg.connect(**DB_CONFIG)

ORG_ID = "00000000-0000-0000-0000-000000000001"

async def ensure_org(conn):
    row = await conn.fetchrow("SELECT id::text FROM organizations LIMIT 1")
    if row: return row["id"]
    await conn.execute("INSERT INTO organizations (id,name,slug,subscription_tier,is_active,created_at) VALUES ($1::uuid,'CoachMe','coachme','pro',true,NOW()) ON CONFLICT DO NOTHING", ORG_ID)
    return ORG_ID

async def ensure_tables(conn):
    """Auto-create tables that may not exist in schema."""
    await conn.execute("""CREATE TABLE IF NOT EXISTS coach_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), coach_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id UUID REFERENCES users(id) ON DELETE SET NULL, client_name VARCHAR(255), client_email VARCHAR(255),
        rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5), review_text TEXT,
        is_public BOOLEAN DEFAULT true, is_approved BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW())""")
    await conn.execute("""CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        coach_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lead_type VARCHAR(50) NOT NULL DEFAULT 'interest',
        name VARCHAR(255) NOT NULL, email VARCHAR(255), phone VARCHAR(50),
        message TEXT, referral_code VARCHAR(100),
        referred_by_name VARCHAR(255), referred_by_email VARCHAR(255),
        status VARCHAR(50) DEFAULT 'new', coach_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW())""")
    await conn.execute("""CREATE TABLE IF NOT EXISTS coach_availability (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        coach_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        working_days JSONB DEFAULT '[1,2,3,4,5]',
        slots JSONB DEFAULT '[]',
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(coach_id))""")
    await conn.execute("""CREATE TABLE IF NOT EXISTS coach_holidays (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        coach_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        holiday_date DATE NOT NULL,
        reason VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW())""")
    try: await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS logo_url TEXT")
    except: pass
    await conn.execute("""CREATE TABLE IF NOT EXISTS progress_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID, client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
        record_type VARCHAR(50) DEFAULT 'measurement',
        metrics JSONB DEFAULT '{}', notes TEXT,
        recorded_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW())""")

async def get_coach_id(request_coach_id: Optional[str], conn) -> Optional[str]:
    """Validate coach_id exists in users table. Returns None if invalid."""
    if not request_coach_id: return None
    row = await conn.fetchrow("SELECT id::text FROM users WHERE id=$1::uuid AND role='coach' AND is_active=true", request_coach_id)
    return row["id"] if row else None


# ==================== AUTH ====================
class CoachRegister(BaseModel):
    full_name: str; email: str; phone: str; password: Optional[str]=None
    specialization: str="general"; bio: Optional[str]=None; experience_years: int=0
    logo_base64: Optional[str]=None

class LoginRequest(BaseModel):
    email: str; password: str

@router.post("/coaches/register")
async def register_coach(data: CoachRegister):
    conn = await get_db()
    try:
        org_id = await ensure_org(conn); await ensure_tables(conn)
        pw = hashlib.sha256((data.password or "changeme").encode()).hexdigest()
        meta = json.dumps({"specialization":data.specialization,"bio":data.bio or "","experience_years":data.experience_years})
        logo_url = None
        if data.logo_base64:
            # Store base64 logo in metadata (or could store in blob storage)
            logo_url = data.logo_base64[:500000]  # Max ~375KB image
        row = await conn.fetchrow(
            """INSERT INTO users (primary_org_id,full_name,email,phone,role,password_hash,is_active,is_verified,metadata,logo_url,created_at)
               VALUES ($1,$2,$3,$4,'coach',$5,true,true,$6::jsonb,$7,NOW()) RETURNING id::text,full_name,email,phone,metadata,logo_url,created_at::text""",
            org_id, data.full_name, data.email, data.phone, pw, meta, logo_url)
        return {"success":True,"coach":dict(row),"message":"Coach registered successfully"}
    except asyncpg.UniqueViolationError: raise HTTPException(400, "Email or phone already exists")
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.post("/auth/login")
async def login(data: LoginRequest):
    conn = await get_db()
    try:
        pw = hashlib.sha256(data.password.encode()).hexdigest()
        row = await conn.fetchrow(
            "SELECT id::text,full_name,email,phone,role,metadata,logo_url,created_at::text FROM users WHERE email=$1 AND password_hash=$2 AND is_active=true",
            data.email, pw)
        if not row: raise HTTPException(401, "Invalid email or password")
        return {"success":True,"user":dict(row),"message":f"Welcome back, {row['full_name']}!"}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.post("/coaches/{cid}/logo")
async def upload_logo(cid: str, data: dict = Body(...)):
    """Upload coach logo as base64."""
    conn = await get_db()
    try:
        logo = data.get("logo_base64", "")
        if len(logo) > 500000: raise HTTPException(400, "Image too large (max ~375KB)")
        await conn.execute("UPDATE users SET logo_url=$1 WHERE id=$2::uuid AND role='coach'", logo, cid)
        return {"success":True,"message":"Logo uploaded"}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()


# ==================== CLIENTS (coach-isolated) ====================
@router.post("/clients")
async def create_client(data: dict = Body(...), x_coach_id: Optional[str] = Header(None)):
    conn = await get_db()
    try:
        org_id = await ensure_org(conn)
        coach_id = await get_coach_id(x_coach_id, conn)
        meta = json.dumps({"coach_id": coach_id}) if coach_id else "{}"
        row = await conn.fetchrow(
            """INSERT INTO users (primary_org_id,full_name,email,phone,role,is_active,is_verified,metadata,created_at)
               VALUES ($1,$2,$3,$4,'client',true,true,$5::jsonb,NOW()) RETURNING id::text,full_name as name,email,phone,created_at::text""",
            org_id, data.get("name","Unknown"), data.get("email"), data.get("phone"), meta)
        return {"success":True,"client":dict(row)}
    except asyncpg.UniqueViolationError: raise HTTPException(400, "Client with this email/phone exists")
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.get("/clients")
async def get_clients(x_coach_id: Optional[str] = Header(None)):
    conn = await get_db()
    try:
        coach_id = await get_coach_id(x_coach_id, conn)
        if coach_id:
            rows = await conn.fetch("SELECT id::text,full_name as name,email,phone,metadata,created_at::text FROM users WHERE role='client' AND is_active=true AND deleted_at IS NULL AND metadata->>'coach_id'=$1 ORDER BY created_at DESC", coach_id)
        else:
            rows = await conn.fetch("SELECT id::text,full_name as name,email,phone,metadata,created_at::text FROM users WHERE role='client' AND is_active=true AND deleted_at IS NULL ORDER BY created_at DESC")
        return {"success":True,"clients":[dict(r) for r in rows]}
    except: return {"success":True,"clients":[]}
    finally: await conn.close()

@router.delete("/clients/{cid}")
async def delete_client(cid: str):
    conn = await get_db()
    try: await conn.execute("UPDATE users SET deleted_at=NOW(),is_active=false WHERE id=$1::uuid AND role='client'", cid); return {"success":True}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.put("/clients/{cid}")
async def update_client(cid: str, data: dict = Body(...)):
    conn = await get_db()
    try:
        sets, vals, idx = [], [cid], 2
        if "name" in data and data["name"]:
            sets.append(f"full_name=${idx}"); vals.append(data["name"]); idx+=1
        if "email" in data:
            sets.append(f"email=${idx}"); vals.append(data["email"] or None); idx+=1
        if "phone" in data:
            sets.append(f"phone=${idx}"); vals.append(data["phone"] or None); idx+=1
        meta_updates = {k: data[k] for k in ["goal","type","weight","height","level","medical"] if k in data and data[k]}
        if meta_updates:
            sets.append(f"metadata=COALESCE(metadata,'{{}}'::jsonb)||${idx}::jsonb")
            vals.append(json.dumps(meta_updates)); idx+=1
        if not sets: return {"success": True}
        row = await conn.fetchrow(f"UPDATE users SET {','.join(sets)} WHERE id=$1::uuid RETURNING id::text,full_name as name,email,phone,metadata", *vals)
        return {"success": True, "client": dict(row) if row else None}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.post("/clients/bulk-import")
async def bulk_import_clients(data: dict = Body(...), x_coach_id: Optional[str] = Header(None)):
    conn = await get_db()
    try:
        org_id = await ensure_org(conn)
        coach_id = await get_coach_id(x_coach_id, conn)
        meta = json.dumps({"coach_id":coach_id}) if coach_id else "{}"; n=0; errors=[]
        for c in data.get("clients",[]):
            try:
                await conn.execute("INSERT INTO users (primary_org_id,full_name,email,phone,role,is_active,is_verified,metadata,created_at) VALUES ($1,$2,$3,$4,'client',true,true,$5::jsonb,NOW())",
                    org_id, c.get("name",c.get("full_name","Unknown")), c.get("email"), c.get("phone"), meta); n+=1
            except Exception as ex: errors.append(f"{c.get('name','?')}: {str(ex)[:50]}")
        msg = f"Imported {n} of {n+len(errors)} clients"
        if errors: msg += f". Errors: {'; '.join(errors[:3])}"
        return {"success":True,"message":msg,"imported":n,"errors":len(errors)}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()


# ==================== WORKOUTS (coach-isolated) ====================
@router.get("/workouts/library")
async def get_workouts(category: Optional[str]=None, x_coach_id: Optional[str]=Header(None)):
    conn = await get_db()
    try:
        coach_id = await get_coach_id(x_coach_id, conn)
        q = "SELECT id::text,name,description,session_type as category,duration_minutes,created_at::text FROM session_templates WHERE is_active=true AND deleted_at IS NULL"
        p = []
        if coach_id: q += f" AND created_by=${len(p)+1}::uuid"; p.append(coach_id)
        if category: q += f" AND session_type=${len(p)+1}"; p.append(category)
        q += " ORDER BY created_at DESC"
        rows = await conn.fetch(q, *p)
        return {"success":True,"workouts":[dict(r) for r in rows]}
    except: return {"success":True,"workouts":[]}
    finally: await conn.close()

@router.post("/workouts/library")
async def create_workout(data: dict = Body(...), x_coach_id: Optional[str]=Header(None)):
    conn = await get_db()
    try:
        org_id = await ensure_org(conn)
        coach_id = await get_coach_id(x_coach_id, conn)
        if not coach_id:
            raise HTTPException(400, "Valid coach ID required. Please login again.")
        row = await conn.fetchrow(
            "INSERT INTO session_templates (org_id,created_by,name,description,session_type,duration_minutes,is_active,created_at) VALUES ($1,$2::uuid,$3,$4,$5,$6,true,NOW()) RETURNING id::text,name,description,session_type as category,duration_minutes",
            org_id, coach_id, data.get("name"), data.get("description",""), data.get("category","strength"), data.get("duration_minutes",30))
        return {"success":True,"workout":dict(row)}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.delete("/workouts/{wid}")
async def delete_workout(wid: str):
    conn = await get_db()
    try: await conn.execute("UPDATE session_templates SET deleted_at=NOW(),is_active=false WHERE id=$1::uuid", wid); return {"success":True}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.post("/workouts/bulk-import")
async def bulk_import_workouts(data: dict = Body(...), x_coach_id: Optional[str]=Header(None)):
    conn = await get_db()
    try:
        org_id = await ensure_org(conn)
        coach_id = await get_coach_id(x_coach_id, conn)
        if not coach_id: raise HTTPException(400, "Valid coach ID required")
        n=0
        for w in data.get("workouts",[]):
            try:
                await conn.execute("INSERT INTO session_templates (org_id,created_by,name,description,session_type,duration_minutes,is_active,created_at) VALUES ($1,$2::uuid,$3,$4,$5,$6,true,NOW())",
                    org_id, coach_id, w.get("name"), w.get("description",""), w.get("category","strength"), int(w.get("duration_minutes",30))); n+=1
            except: pass
        return {"success":True,"message":f"Imported {n} workouts"}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()


# ==================== SESSIONS (coach-isolated) ====================
@router.get("/sessions")
async def get_sessions(client_id: Optional[str]=None, x_coach_id: Optional[str]=Header(None)):
    conn = await get_db()
    try:
        coach_id = await get_coach_id(x_coach_id, conn)
        q = """SELECT ss.id::text,ss.scheduled_at::text,ss.duration_minutes,ss.status,ss.notes,ss.coach_id::text,ss.client_id::text,
                      u.full_name as client_name,st.name as workout_name FROM scheduled_sessions ss
               LEFT JOIN users u ON ss.client_id=u.id LEFT JOIN session_templates st ON ss.session_template_id=st.id WHERE 1=1"""
        p = []
        if coach_id: q += f" AND ss.coach_id=${len(p)+1}::uuid"; p.append(coach_id)
        if client_id: q += f" AND ss.client_id=${len(p)+1}::uuid"; p.append(client_id)
        q += " ORDER BY ss.scheduled_at DESC LIMIT 200"
        rows = await conn.fetch(q, *p)
        return {"success":True,"sessions":[dict(r) for r in rows]}
    except: return {"success":True,"sessions":[]}
    finally: await conn.close()

@router.post("/sessions")
async def create_session(data: dict = Body(...), x_coach_id: Optional[str]=Header(None)):
    conn = await get_db()
    try:
        org_id = await ensure_org(conn)
        coach_id = await get_coach_id(x_coach_id, conn)
        if not coach_id: raise HTTPException(400, "Valid coach ID required")
        tid = data.get("template_id") or data.get("workout_id") or None
        row = await conn.fetchrow(
            "INSERT INTO scheduled_sessions (org_id,coach_id,client_id,session_template_id,scheduled_at,duration_minutes,status,location,created_at) VALUES ($1,$2::uuid,$3::uuid,$4,$5,$6,'scheduled',$7,NOW()) RETURNING id::text,scheduled_at::text,status",
            org_id, coach_id, data["client_id"], tid, parse_dt(data["scheduled_at"]), data.get("duration_minutes",60), data.get("location","offline"))
        return {"success":True,"session":dict(row)}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.post("/sessions/create-recurring")
async def create_recurring(data: dict = Body(...), x_coach_id: Optional[str]=Header(None)):
    conn = await get_db()
    try:
        org_id = await ensure_org(conn)
        coach_id = await get_coach_id(x_coach_id, conn)
        if not coach_id: raise HTTPException(400, "Valid coach ID required")
        start = datetime.strptime(data["start_date"],"%Y-%m-%d")
        h,m = map(int, data.get("time","09:00").split(":")); num = data.get("num_sessions",4); dur = data.get("duration_minutes",60)
        rec = data.get("recurrence_type","weekly")
        deltas = {"daily":timedelta(days=1),"weekly":timedelta(weeks=1),"biweekly":timedelta(weeks=2),"monthly":timedelta(days=30)}
        delta = deltas.get(rec, timedelta(weeks=1)); n=0
        for i in range(num):
            dt = (start + delta*i).replace(hour=h,minute=m)
            # Skip weekends if daily
            if rec == "daily" and dt.weekday() >= 5:
                start += timedelta(days=1); continue  # adjust start to skip
            await conn.execute("INSERT INTO scheduled_sessions (org_id,coach_id,client_id,scheduled_at,duration_minutes,status,created_at) VALUES ($1,$2::uuid,$3::uuid,$4,$5,'scheduled',NOW())",
                org_id, coach_id, data["client_id"], dt, dur); n+=1
        return {"success":True,"message":f"Created {n} {rec} sessions"}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.delete("/sessions/{sid}")
async def delete_session(sid: str):
    conn = await get_db()
    try: await conn.execute("DELETE FROM scheduled_sessions WHERE id=$1::uuid", sid); return {"success":True}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.post("/sessions/{sid}/mark-attendance")
async def mark_attendance(sid: str, data: dict = Body(...)):
    conn = await get_db()
    try:
        m = {"attended":"confirmed","present":"confirmed","absent":"no_show","no_show":"no_show","completed":"completed"}
        new_status = m.get(data.get("status",""), data.get("status","no_show"))
        await conn.execute("UPDATE scheduled_sessions SET status=$1 WHERE id=$2::uuid", new_status, sid)
        return {"success":True,"new_status":new_status}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.post("/sessions/{sid}/start")
async def start_session(sid: str):
    conn = await get_db()
    try:
        await conn.execute("UPDATE scheduled_sessions SET status='in_progress' WHERE id=$1::uuid", sid)
        s = await conn.fetchrow("SELECT ss.*,st.name as wn,st.structure as ws FROM scheduled_sessions ss LEFT JOIN session_templates st ON ss.session_template_id=st.id WHERE ss.id=$1::uuid", sid)
        w = None
        if s and s.get("ws"): w = {"name":s["wn"],"structure":json.loads(s["ws"]) if isinstance(s["ws"],str) else s["ws"]}
        return {"success":True,"workout":w}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.post("/sessions/{sid}/complete")
async def complete_session(sid: str, data: dict = Body(...)):
    conn = await get_db()
    try:
        meta = json.dumps({"exercises_completed":data.get("exercises_completed",[])})
        await conn.execute("UPDATE scheduled_sessions SET status='completed',completed_at=NOW(),notes=$1,metadata=$2::jsonb WHERE id=$3::uuid", data.get("notes",""), meta, sid)
        return {"success":True}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.post("/sessions/{sid}/cancel")
async def cancel_session(sid: str, data: dict = Body(...)):
    conn = await get_db()
    try: await conn.execute("UPDATE scheduled_sessions SET status='cancelled',cancelled_reason=$1,cancelled_at=NOW() WHERE id=$2::uuid", data.get("reason",""), sid); return {"success":True}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.get("/schedule/today")
async def get_today(x_coach_id: Optional[str]=Header(None)):
    conn = await get_db()
    try:
        coach_id = await get_coach_id(x_coach_id, conn)
        today = datetime.now().strftime("%Y-%m-%d")
        q = """SELECT ss.id::text,ss.scheduled_at::text,ss.duration_minutes,ss.status,ss.notes,ss.coach_id::text,ss.client_id::text,
                      u.full_name as client_name,st.name as workout_name FROM scheduled_sessions ss
               LEFT JOIN users u ON ss.client_id=u.id LEFT JOIN session_templates st ON ss.session_template_id=st.id
               WHERE ss.scheduled_at::date=$1::date"""
        p = [today]
        if coach_id: q += " AND ss.coach_id=$2::uuid"; p.append(coach_id)
        q += " ORDER BY ss.scheduled_at ASC"
        rows = await conn.fetch(q, *p)
        return {"success":True,"sessions":[dict(r) for r in rows]}
    except: return {"success":True,"sessions":[]}
    finally: await conn.close()

@router.post("/schedule/bulk-plan")
async def bulk_plan(data: dict = Body(...), x_coach_id: Optional[str]=Header(None)):
    conn = await get_db()
    try:
        org_id = await ensure_org(conn)
        coach_id = await get_coach_id(x_coach_id, conn)
        if not coach_id: raise HTTPException(400, "Valid coach ID required")
        n=0
        for s in data.get("sessions",[]):
            try:
                await conn.execute("INSERT INTO scheduled_sessions (org_id,coach_id,client_id,session_template_id,scheduled_at,duration_minutes,status,created_at) VALUES ($1,$2::uuid,$3::uuid,$4,$5,$6,'scheduled',NOW())",
                    org_id, coach_id, s["client_id"], s.get("workout_id") or None, parse_dt(s["scheduled_at"]), s.get("duration_minutes",60)); n+=1
            except: pass
        return {"success":True,"message":f"Planned {n} sessions"}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()


# ==================== DASHBOARD (coach-isolated) ====================
@router.get("/dashboard/stats")
async def stats(x_coach_id: Optional[str]=Header(None)):
    conn = await get_db()
    try:
        coach_id = await get_coach_id(x_coach_id, conn)
        if coach_id:
            cl = await conn.fetchval("SELECT COUNT(*) FROM users WHERE role='client' AND is_active=true AND deleted_at IS NULL AND metadata->>'coach_id'=$1", coach_id)
            se = await conn.fetchval("SELECT COUNT(*) FROM scheduled_sessions WHERE coach_id=$1::uuid", coach_id)
            co = await conn.fetchval("SELECT COUNT(*) FROM scheduled_sessions WHERE coach_id=$1::uuid AND status IN ('completed','confirmed')", coach_id)
            wo = await conn.fetchval("SELECT COUNT(*) FROM session_templates WHERE created_by=$1::uuid AND is_active=true AND deleted_at IS NULL", coach_id)
        else:
            cl = await conn.fetchval("SELECT COUNT(*) FROM users WHERE role='client' AND is_active=true AND deleted_at IS NULL")
            se = await conn.fetchval("SELECT COUNT(*) FROM scheduled_sessions")
            co = await conn.fetchval("SELECT COUNT(*) FROM scheduled_sessions WHERE status IN ('completed','confirmed')")
            wo = await conn.fetchval("SELECT COUNT(*) FROM session_templates WHERE is_active=true AND deleted_at IS NULL")
        return {"success":True,"stats":{"total_clients":cl,"total_sessions":se,"completed_sessions":co,"total_workouts":wo}}
    except: return {"success":True,"stats":{"total_clients":0,"total_sessions":0,"completed_sessions":0,"total_workouts":0}}
    finally: await conn.close()


# ==================== PROGRESS ====================
@router.post("/progress/upload")
async def upload_progress(data: dict = Body(...)):
    conn = await get_db()
    try:
        org_id = await ensure_org(conn)
        await ensure_tables(conn)
        await conn.execute("INSERT INTO progress_records (org_id,client_id,recorded_by,record_type,metrics,notes,recorded_at,created_at) VALUES ($1,$2::uuid,$2::uuid,$3,$4::jsonb,$5,$6,NOW())",
            org_id, data["client_id"], data.get("type","measurement"),
            json.dumps({"weight":data.get("weight"),"measurements":data.get("measurements",{})}),
            data.get("notes",""), parse_dt(data.get("date",datetime.now().strftime("%Y-%m-%d"))))
        return {"success":True}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()


# ==================== REMINDERS ====================
@router.post("/reminders/send")
async def send_reminders(data: dict = Body(...)): return {"success":True,"message":"Reminders sent (demo)"}

@router.post("/reminders/send-personal")
async def send_personal(data: dict = Body(...)):
    conn = await get_db()
    try:
        cl = await conn.fetchrow("SELECT full_name,email,phone FROM users WHERE id=$1::uuid", data["client_id"])
        if not cl: raise HTTPException(404, "Client not found")
        name = cl["full_name"] or "Client"; msg = data.get("message") or f"Hi {name}, reminder about your session!"
        method = data.get("method","whatsapp")
        import urllib.parse
        if method=="whatsapp":
            ph = (cl["phone"] or "").replace("+","").replace(" ","").replace("-","")
            if not ph: return {"success":False,"message":"No phone number for this client"}
            return {"success":True,"method":"whatsapp","link":f"https://wa.me/{ph}?text={urllib.parse.quote(msg)}","client_name":name}
        elif method=="email":
            em = cl["email"]
            if not em: return {"success":False,"message":"No email for this client"}
            return {"success":True,"method":"email","link":f"mailto:{em}?subject={urllib.parse.quote('Session Reminder')}&body={urllib.parse.quote(msg)}","client_name":name}
        return {"success":False,"message":"Unknown method"}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()


# ==================== PAYMENTS ====================
@router.post("/payments/create-razorpay-link")
async def razorpay_link(data: dict = Body(...)):
    conn = await get_db()
    try:
        cl = await conn.fetchrow("SELECT full_name FROM users WHERE id=$1::uuid", data["client_id"])
        if not cl: raise HTTPException(404, "Client not found")
        amt = float(data["amount"])
        return {"success":True,"payment_link":f"https://rzp.io/demo/{uuid.uuid4().hex[:8]}","amount":amt,"client_name":cl["full_name"],"mode":"demo"}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()


# ==================== PUBLIC COACH PROFILES & REVIEWS ====================
@router.get("/coaches")
async def get_coaches():
    conn = await get_db()
    try:
        rows = await conn.fetch("SELECT id::text,full_name,email,phone,metadata,logo_url,created_at::text FROM users WHERE role='coach' AND is_active=true AND deleted_at IS NULL ORDER BY created_at DESC")
        coaches = []
        for r in rows:
            m = json.loads(r["metadata"]) if isinstance(r["metadata"],str) else (r["metadata"] or {})
            coaches.append({"id":r["id"],"name":r["full_name"],"email":r["email"],"specialization":m.get("specialization","general"),
                "bio":m.get("bio",""),"experience_years":m.get("experience_years",0),"logo_url":r.get("logo_url")})
        return {"success":True,"coaches":coaches}
    except: return {"success":True,"coaches":[]}
    finally: await conn.close()

@router.get("/coaches/{cid}/profile")
async def coach_profile(cid: str):
    conn = await get_db()
    try:
        await ensure_tables(conn)
        c = await conn.fetchrow("SELECT id::text,full_name,email,metadata,logo_url,created_at::text FROM users WHERE id=$1::uuid AND role='coach'", cid)
        if not c: raise HTTPException(404, "Coach not found")
        m = json.loads(c["metadata"]) if isinstance(c["metadata"],str) else (c["metadata"] or {})
        revs = await conn.fetch("SELECT id::text,client_name,rating,review_text,created_at::text FROM coach_reviews WHERE coach_id=$1::uuid AND is_public=true ORDER BY created_at DESC LIMIT 20", cid)
        cl_count = await conn.fetchval("SELECT COUNT(*) FROM users WHERE role='client' AND metadata->>'coach_id'=$1 AND is_active=true", cid)
        sess_count = await conn.fetchval("SELECT COUNT(*) FROM scheduled_sessions WHERE coach_id=$1::uuid AND status IN ('completed','confirmed')", cid)
        avg = await conn.fetchval("SELECT COALESCE(AVG(rating),0) FROM coach_reviews WHERE coach_id=$1::uuid AND is_public=true", cid)
        return {"success":True,"profile":{"id":c["id"],"name":c["full_name"],"email":c["email"],
            "specialization":m.get("specialization","general"),"bio":m.get("bio",""),"experience_years":m.get("experience_years",0),
            "client_count":cl_count,"session_count":sess_count,"avg_rating":round(float(avg),1),
            "reviews":[dict(r) for r in revs],"joined":c["created_at"],"logo_url":c.get("logo_url")}}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.post("/coaches/{cid}/reviews")
async def add_review(cid: str, data: dict = Body(...)):
    conn = await get_db()
    try:
        await ensure_tables(conn)
        row = await conn.fetchrow(
            "INSERT INTO coach_reviews (coach_id,client_name,client_email,rating,review_text,is_public,created_at) VALUES ($1::uuid,$2,$3,$4,$5,true,NOW()) RETURNING id::text,client_name,rating,review_text,created_at::text",
            cid, data.get("client_name","Anonymous"), data.get("client_email"), int(data.get("rating",5)), data.get("review_text",""))
        return {"success":True,"review":dict(row),"message":"Review submitted!"}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.get("/coaches/{cid}/reviews")
async def get_reviews(cid: str):
    conn = await get_db()
    try:
        await ensure_tables(conn)
        rows = await conn.fetch("SELECT id::text,client_name,rating,review_text,created_at::text FROM coach_reviews WHERE coach_id=$1::uuid AND is_public=true ORDER BY created_at DESC", cid)
        return {"success":True,"reviews":[dict(r) for r in rows]}
    except: return {"success":True,"reviews":[]}
    finally: await conn.close()


# ==================== LEADS / INTEREST REQUESTS ====================
@router.post("/coaches/{cid}/interest")
async def submit_interest(cid: str, data: dict = Body(...)):
    """Client expresses interest in a coach — callback request, interest, or referral."""
    conn = await get_db()
    try:
        await ensure_tables(conn)
        # Validate coach exists
        coach = await conn.fetchrow("SELECT id::text,full_name FROM users WHERE id=$1::uuid AND role='coach'", cid)
        if not coach: raise HTTPException(404, "Coach not found")
        name = data.get("name","").strip()
        email = data.get("email","").strip()
        phone = data.get("phone","").strip()
        if not name: raise HTTPException(400, "Name is required")
        if not email and not phone: raise HTTPException(400, "Email or phone is required")
        lead_type = data.get("lead_type","interest")  # interest, callback, referral
        row = await conn.fetchrow(
            """INSERT INTO leads (coach_id,lead_type,name,email,phone,message,referral_code,referred_by_name,referred_by_email,status,created_at)
               VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,'new',NOW())
               RETURNING id::text,lead_type,name,email,phone,message,status,created_at::text""",
            cid, lead_type, name, email or None, phone or None,
            data.get("message",""), data.get("referral_code"),
            data.get("referred_by_name"), data.get("referred_by_email"))
        return {"success":True,"lead":dict(row),"message":f"Your {lead_type} request has been sent to {coach['full_name']}!"}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.get("/leads")
async def get_leads(status: Optional[str]=None, x_coach_id: Optional[str]=Header(None)):
    """Get all leads/interest requests for a coach."""
    conn = await get_db()
    try:
        await ensure_tables(conn)
        coach_id = await get_coach_id(x_coach_id, conn)
        if not coach_id: return {"success":True,"leads":[]}
        q = "SELECT id::text,lead_type,name,email,phone,message,referral_code,referred_by_name,referred_by_email,status,coach_notes,created_at::text FROM leads WHERE coach_id=$1::uuid"
        p = [coach_id]
        if status: q += " AND status=$2"; p.append(status)
        q += " ORDER BY created_at DESC"
        rows = await conn.fetch(q, *p)
        return {"success":True,"leads":[dict(r) for r in rows]}
    except: return {"success":True,"leads":[]}
    finally: await conn.close()

@router.patch("/leads/{lid}")
async def update_lead(lid: str, data: dict = Body(...), x_coach_id: Optional[str]=Header(None)):
    """Coach updates a lead — change status, add notes, convert to client."""
    conn = await get_db()
    try:
        await ensure_tables(conn)
        updates = []
        params = []
        idx = 1
        if "status" in data:
            updates.append(f"status=${idx}"); params.append(data["status"]); idx+=1
        if "coach_notes" in data:
            updates.append(f"coach_notes=${idx}"); params.append(data["coach_notes"]); idx+=1
        if not updates: raise HTTPException(400, "Nothing to update")
        params.append(lid)
        await conn.execute(f"UPDATE leads SET {','.join(updates)} WHERE id=${idx}::uuid", *params)
        return {"success":True,"message":"Lead updated"}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.post("/leads/{lid}/convert")
async def convert_lead_to_client(lid: str, x_coach_id: Optional[str]=Header(None)):
    """Convert a lead into a client."""
    conn = await get_db()
    try:
        await ensure_tables(conn)
        coach_id = await get_coach_id(x_coach_id, conn)
        if not coach_id: raise HTTPException(400, "Valid coach ID required")
        org_id = await ensure_org(conn)
        lead = await conn.fetchrow("SELECT * FROM leads WHERE id=$1::uuid", lid)
        if not lead: raise HTTPException(404, "Lead not found")
        meta = json.dumps({"coach_id": coach_id, "converted_from_lead": str(lid)})
        row = await conn.fetchrow(
            """INSERT INTO users (primary_org_id,full_name,email,phone,role,is_active,is_verified,metadata,created_at)
               VALUES ($1,$2,$3,$4,'client',true,true,$5::jsonb,NOW())
               RETURNING id::text,full_name as name,email,phone""",
            org_id, lead["name"], lead["email"], lead["phone"], meta)
        await conn.execute("UPDATE leads SET status='converted' WHERE id=$1::uuid", lid)
        return {"success":True,"client":dict(row),"message":f"{lead['name']} converted to client!"}
    except asyncpg.UniqueViolationError: raise HTTPException(400, "Client with this email/phone already exists")
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()


# ==================== AVAILABILITY ====================
@router.get("/availability")
async def get_availability(x_coach_id: Optional[str]=Header(None)):
    conn = await get_db()
    try:
        await ensure_tables(conn)
        coach_id = await get_coach_id(x_coach_id, conn)
        if not coach_id: return {"success":True,"availability":{"working_days":[1,2,3,4,5],"slots":[]},"holidays":[]}
        row = await conn.fetchrow("SELECT working_days,slots FROM coach_availability WHERE coach_id=$1::uuid", coach_id)
        if not row:
            wd, sl = [1,2,3,4,5], []
        else:
            wd = json.loads(row["working_days"]) if isinstance(row["working_days"],str) else (row["working_days"] or [1,2,3,4,5])
            sl = json.loads(row["slots"]) if isinstance(row["slots"],str) else (row["slots"] or [])
        hrows = await conn.fetch("SELECT id::text,holiday_date::text,reason FROM coach_holidays WHERE coach_id=$1::uuid ORDER BY holiday_date", coach_id)
        holidays = [dict(r) for r in hrows]
        return {"success":True,"availability":{"working_days":wd,"slots":sl},"holidays":holidays}
    except: return {"success":True,"availability":{"working_days":[1,2,3,4,5],"slots":[]},"holidays":[]}
    finally: await conn.close()

@router.put("/availability")
async def set_availability(data: dict = Body(...), x_coach_id: Optional[str]=Header(None)):
    conn = await get_db()
    try:
        await ensure_tables(conn)
        coach_id = await get_coach_id(x_coach_id, conn)
        if not coach_id: raise HTTPException(400, "Valid coach ID required")
        wd = json.dumps(data.get("working_days",[1,2,3,4,5]))
        sl = json.dumps(data.get("slots",[]))
        await conn.execute(
            """INSERT INTO coach_availability (coach_id,working_days,slots,updated_at) VALUES ($1::uuid,$2::jsonb,$3::jsonb,NOW())
               ON CONFLICT (coach_id) DO UPDATE SET working_days=$2::jsonb,slots=$3::jsonb,updated_at=NOW()""",
            coach_id, wd, sl)
        return {"success":True,"message":"Availability saved"}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.get("/holidays")
async def get_holidays(x_coach_id: Optional[str]=Header(None)):
    conn = await get_db()
    try:
        await ensure_tables(conn)
        coach_id = await get_coach_id(x_coach_id, conn)
        if not coach_id: return {"success":True,"holidays":[]}
        rows = await conn.fetch("SELECT id::text,holiday_date::text,reason FROM coach_holidays WHERE coach_id=$1::uuid ORDER BY holiday_date", coach_id)
        return {"success":True,"holidays":[dict(r) for r in rows]}
    except: return {"success":True,"holidays":[]}
    finally: await conn.close()

@router.post("/holidays")
async def add_holiday(data: dict = Body(...), x_coach_id: Optional[str]=Header(None)):
    conn = await get_db()
    try:
        await ensure_tables(conn)
        coach_id = await get_coach_id(x_coach_id, conn)
        if not coach_id: raise HTTPException(400, "Valid coach ID required")
        row = await conn.fetchrow(
            "INSERT INTO coach_holidays (coach_id,holiday_date,reason) VALUES ($1::uuid,$2,$3) RETURNING id::text,holiday_date::text,reason",
            coach_id, parse_dt(data["date"]).date() if isinstance(data["date"], str) else data["date"], data.get("reason",""))
        return {"success":True,"holiday":dict(row)}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.delete("/holidays/{hid}")
async def delete_holiday(hid: str):
    conn = await get_db()
    try: await conn.execute("DELETE FROM coach_holidays WHERE id=$1::uuid", hid); return {"success":True}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()


# ==================== ADMIN ====================
@router.post("/admin/reset-database")
async def reset_db(data: dict = Body(...)):
    if data.get("confirm") != "YES_DELETE_EVERYTHING": raise HTTPException(400, "Confirm required")
    conn = await get_db()
    try:
        r = {}
        for t in ["scheduled_sessions","progress_records","session_templates"]:
            try: x = await conn.execute(f"DELETE FROM {t}"); r[t]=x
            except Exception as e: r[t]=str(e)
        try: await conn.execute("DELETE FROM coach_reviews"); r["coach_reviews"]="done"
        except: pass
        try: await conn.execute("DELETE FROM leads"); r["leads"]="done"
        except: pass
        try: await conn.execute("DELETE FROM users"); r["users"]="done"
        except Exception as e: r["users"]=str(e)
        await ensure_org(conn)
        return {"success":True,"message":"Database wiped","details":r}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.get("/")
async def root(): return {"status":"ok","version":"4.0-production"}

@router.get("/progress/{client_id}")
async def get_progress(client_id: str, x_coach_id: Optional[str] = Header(None)):
    conn = await get_db()
    try:
        await ensure_tables(conn)
        rows = await conn.fetch(
            "SELECT id::text, record_type, metrics, notes, recorded_at::text, created_at::text FROM progress_records WHERE client_id=$1::uuid ORDER BY recorded_at DESC",
            client_id)
        return {"success": True, "records": [dict(r) for r in rows]}
    except:
        return {"success": True, "records": []}
    finally:
        await conn.close()

@router.put("/clients/{cid}/metadata")
async def update_client_metadata(cid: str, data: dict = Body(...), x_coach_id: Optional[str] = Header(None)):
    conn = await get_db()
    try:
        row = await conn.fetchrow("SELECT metadata FROM users WHERE id=$1::uuid", cid)
        if not row: raise HTTPException(404, "Client not found")
        current = {}
        if row["metadata"]:
            current = json.loads(row["metadata"]) if isinstance(row["metadata"], str) else dict(row["metadata"])
        for k, v in data.items():
            if k != "id": current[k] = v
        await conn.execute("UPDATE users SET metadata=$1::jsonb WHERE id=$2::uuid", json.dumps(current), cid)
        return {"success": True, "metadata": current}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

app.include_router(router, prefix="/api/v1")
