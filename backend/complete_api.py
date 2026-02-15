from fastapi import FastAPI, APIRouter, HTTPException, Body, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import asyncpg, json, os, uuid, hashlib
from datetime import datetime, timedelta

def parse_dt(s):
    if isinstance(s, datetime): return s
    for fmt in ('%Y-%m-%dT%H:%M:%S','%Y-%m-%dT%H:%M','%Y-%m-%d %H:%M:%S','%Y-%m-%d %H:%M','%Y-%m-%d'):
        try: return datetime.strptime(s, fmt)
        except: continue
    raise ValueError(f"Cannot parse datetime: {s}")

app = FastAPI(title="Coach Platform API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
router = APIRouter()

async def get_db():
    return await asyncpg.connect(
        host=os.getenv("DB_HOST","coach-db-1770519048.postgres.database.azure.com"),
        database=os.getenv("DB_NAME","coach_platform"), user=os.getenv("DB_USER","dbadmin"),
        password=os.getenv("DB_PASSWORD","CoachPlatform2026!SecureDB"),
        port=int(os.getenv("DB_PORT",5432)),
        ssl="require" if os.getenv("DB_SSL","true").lower()=="true" else None)

ORG_ID = "00000000-0000-0000-0000-000000000001"

async def ensure_org(conn):
    row = await conn.fetchrow("SELECT id::text FROM organizations LIMIT 1")
    if row: return row["id"]
    await conn.execute("INSERT INTO organizations (id,name,slug,subscription_tier,is_active,created_at) VALUES ($1::uuid,'CoachMe','coachme','pro',true,NOW()) ON CONFLICT DO NOTHING", ORG_ID)
    return ORG_ID

async def ensure_reviews_table(conn):
    await conn.execute("""CREATE TABLE IF NOT EXISTS coach_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), coach_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id UUID REFERENCES users(id) ON DELETE SET NULL, client_name VARCHAR(255), client_email VARCHAR(255),
        rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5), review_text TEXT,
        is_public BOOLEAN DEFAULT true, is_approved BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW())""")

# ==================== AUTH ====================
class CoachRegister(BaseModel):
    full_name: str; email: str; phone: str; password: Optional[str]=None
    specialization: str="general"; bio: Optional[str]=None; experience_years: int=0

class LoginRequest(BaseModel):
    email: str; password: str

@router.post("/coaches/register")
async def register_coach(data: CoachRegister):
    conn = await get_db()
    try:
        org_id = await ensure_org(conn); await ensure_reviews_table(conn)
        pw = hashlib.sha256((data.password or "changeme").encode()).hexdigest()
        meta = json.dumps({"specialization":data.specialization,"bio":data.bio or "","experience_years":data.experience_years})
        row = await conn.fetchrow(
            """INSERT INTO users (primary_org_id,full_name,email,phone,role,password_hash,is_active,is_verified,metadata,created_at)
               VALUES ($1,$2,$3,$4,'coach',$5,true,true,$6::jsonb,NOW()) RETURNING id::text,full_name,email,phone,metadata,created_at::text""",
            org_id, data.full_name, data.email, data.phone, pw, meta)
        return {"success":True,"coach":dict(row),"message":"Coach registered successfully"}
    except asyncpg.UniqueViolationError: raise HTTPException(400, "Email or phone already exists")
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.post("/auth/login")
async def login(data: LoginRequest):
    conn = await get_db()
    try:
        pw = hashlib.sha256(data.password.encode()).hexdigest()
        row = await conn.fetchrow("SELECT id::text,full_name,email,phone,role,metadata,created_at::text FROM users WHERE email=$1 AND password_hash=$2 AND is_active=true", data.email, pw)
        if not row: raise HTTPException(401, "Invalid email or password")
        return {"success":True,"user":dict(row),"message":f"Welcome back, {row['full_name']}!"}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

# ==================== CLIENTS (coach-isolated) ====================
@router.post("/clients")
async def create_client(data: dict = Body(...), x_coach_id: Optional[str] = Header(None)):
    conn = await get_db()
    try:
        org_id = await ensure_org(conn)
        meta = json.dumps({"coach_id": x_coach_id}) if x_coach_id else "{}"
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
        if x_coach_id:
            rows = await conn.fetch("SELECT id::text,full_name as name,email,phone,metadata,created_at::text FROM users WHERE role='client' AND is_active=true AND deleted_at IS NULL AND metadata->>'coach_id'=$1 ORDER BY created_at DESC", x_coach_id)
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

@router.post("/clients/bulk-import")
async def bulk_import_clients(data: dict = Body(...), x_coach_id: Optional[str] = Header(None)):
    conn = await get_db()
    try:
        org_id = await ensure_org(conn); meta = json.dumps({"coach_id":x_coach_id}) if x_coach_id else "{}"; n=0
        for c in data.get("clients",[]):
            try:
                await conn.execute("INSERT INTO users (primary_org_id,full_name,email,phone,role,is_active,is_verified,metadata,created_at) VALUES ($1,$2,$3,$4,'client',true,true,$5::jsonb,NOW())",
                    org_id, c.get("name",c.get("full_name","Unknown")), c.get("email"), c.get("phone"), meta); n+=1
            except: pass
        return {"success":True,"message":f"Imported {n} clients"}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

# ==================== WORKOUTS (coach-isolated) ====================
@router.get("/workouts/library")
async def get_workouts(category: Optional[str]=None, x_coach_id: Optional[str]=Header(None)):
    conn = await get_db()
    try:
        q = "SELECT id::text,name,description,session_type as category,duration_minutes,created_at::text FROM session_templates WHERE is_active=true AND deleted_at IS NULL"
        p = []
        if x_coach_id: q += f" AND created_by=${len(p)+1}::uuid"; p.append(x_coach_id)
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
        row = await conn.fetchrow(
            "INSERT INTO session_templates (org_id,created_by,name,description,session_type,duration_minutes,is_active,created_at) VALUES ($1,$2::uuid,$3,$4,$5,$6,true,NOW()) RETURNING id::text,name,description,session_type as category,duration_minutes",
            org_id, x_coach_id, data.get("name"), data.get("description"), data.get("category","strength"), data.get("duration_minutes",30))
        return {"success":True,"workout":dict(row)}
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
        org_id = await ensure_org(conn); n=0
        for w in data.get("workouts",[]):
            try:
                await conn.execute("INSERT INTO session_templates (org_id,created_by,name,description,session_type,duration_minutes,is_active,created_at) VALUES ($1,$2::uuid,$3,$4,$5,$6,true,NOW())",
                    org_id, x_coach_id, w.get("name"), w.get("description"), w.get("category","strength"), int(w.get("duration_minutes",30))); n+=1
            except: pass
        return {"success":True,"message":f"Imported {n} workouts"}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

# ==================== SESSIONS (coach-isolated) ====================
@router.get("/sessions")
async def get_sessions(client_id: Optional[str]=None, x_coach_id: Optional[str]=Header(None)):
    conn = await get_db()
    try:
        q = """SELECT ss.id::text,ss.scheduled_at::text,ss.duration_minutes,ss.status,ss.notes,ss.coach_id::text,ss.client_id::text,
                      u.full_name as client_name,st.name as template_name,st.name as workout_name
               FROM scheduled_sessions ss LEFT JOIN users u ON ss.client_id=u.id LEFT JOIN session_templates st ON ss.session_template_id=st.id WHERE 1=1"""
        p = []
        if x_coach_id: q += f" AND ss.coach_id=${len(p)+1}::uuid"; p.append(x_coach_id)
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
        org_id = await ensure_org(conn); tid = data.get("template_id") or data.get("workout_id") or None
        row = await conn.fetchrow(
            "INSERT INTO scheduled_sessions (org_id,coach_id,client_id,session_template_id,scheduled_at,duration_minutes,status,location,created_at) VALUES ($1,$2::uuid,$3::uuid,$4,$5,$6,'scheduled',$7,NOW()) RETURNING id::text,scheduled_at::text,status",
            org_id, x_coach_id, data["client_id"], tid, parse_dt(data["scheduled_at"]), data.get("duration_minutes",60), data.get("location","offline"))
        return {"success":True,"session":dict(row)}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.post("/sessions/create-recurring")
async def create_recurring(data: dict = Body(...), x_coach_id: Optional[str]=Header(None)):
    conn = await get_db()
    try:
        org_id = await ensure_org(conn); start = datetime.strptime(data["start_date"],"%Y-%m-%d")
        h,m = map(int, data.get("time","09:00").split(":")); num = data.get("num_sessions",4); dur = data.get("duration_minutes",60)
        deltas = {"daily":timedelta(days=1),"weekly":timedelta(weeks=1),"biweekly":timedelta(weeks=2),"monthly":timedelta(days=30)}
        delta = deltas.get(data.get("recurrence_type","weekly"), timedelta(weeks=1)); n=0
        for i in range(num):
            dt = (start + delta*i).replace(hour=h,minute=m)
            await conn.execute("INSERT INTO scheduled_sessions (org_id,coach_id,client_id,scheduled_at,duration_minutes,status,created_at) VALUES ($1,$2::uuid,$3::uuid,$4,$5,'scheduled',NOW())",
                org_id, x_coach_id, data["client_id"], dt, dur); n+=1
        return {"success":True,"message":f"Created {n} sessions"}
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
        m = {"attended":"confirmed","present":"confirmed","absent":"no_show","no_show":"no_show"}
        await conn.execute("UPDATE scheduled_sessions SET status=$1 WHERE id=$2::uuid", m.get(data.get("status","no_show"),data.get("status")), sid)
        return {"success":True}
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
        today = datetime.now().strftime("%Y-%m-%d")
        q = """SELECT ss.id::text,ss.scheduled_at::text,ss.duration_minutes,ss.status,ss.notes,ss.coach_id::text,ss.client_id::text,
                      u.full_name as client_name,st.name as workout_name
               FROM scheduled_sessions ss LEFT JOIN users u ON ss.client_id=u.id LEFT JOIN session_templates st ON ss.session_template_id=st.id
               WHERE ss.scheduled_at::date=$1::date"""
        p = [today]
        if x_coach_id: q += " AND ss.coach_id=$2::uuid"; p.append(x_coach_id)
        q += " ORDER BY ss.scheduled_at ASC"
        rows = await conn.fetch(q, *p)
        return {"success":True,"sessions":[dict(r) for r in rows]}
    except: return {"success":True,"sessions":[]}
    finally: await conn.close()

@router.post("/schedule/bulk-plan")
async def bulk_plan(data: dict = Body(...), x_coach_id: Optional[str]=Header(None)):
    conn = await get_db()
    try:
        org_id = await ensure_org(conn); n=0
        for s in data.get("sessions",[]):
            try:
                await conn.execute("INSERT INTO scheduled_sessions (org_id,coach_id,client_id,session_template_id,scheduled_at,duration_minutes,status,created_at) VALUES ($1,$2::uuid,$3::uuid,$4,$5,$6,'scheduled',NOW())",
                    org_id, x_coach_id, s["client_id"], s.get("workout_id") or None, parse_dt(s["scheduled_at"]), s.get("duration_minutes",60)); n+=1
            except Exception as ex: print(f"Bulk err: {ex}")
        return {"success":True,"message":f"Planned {n} sessions"}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

# ==================== DASHBOARD (coach-isolated) ====================
@router.get("/dashboard/stats")
async def stats(x_coach_id: Optional[str]=Header(None)):
    conn = await get_db()
    try:
        if x_coach_id:
            cl = await conn.fetchval("SELECT COUNT(*) FROM users WHERE role='client' AND is_active=true AND deleted_at IS NULL AND metadata->>'coach_id'=$1", x_coach_id)
            se = await conn.fetchval("SELECT COUNT(*) FROM scheduled_sessions WHERE coach_id=$1::uuid", x_coach_id)
            co = await conn.fetchval("SELECT COUNT(*) FROM scheduled_sessions WHERE coach_id=$1::uuid AND status='completed'", x_coach_id)
            wo = await conn.fetchval("SELECT COUNT(*) FROM session_templates WHERE created_by=$1::uuid AND is_active=true AND deleted_at IS NULL", x_coach_id)
        else:
            cl = await conn.fetchval("SELECT COUNT(*) FROM users WHERE role='client' AND is_active=true AND deleted_at IS NULL")
            se = await conn.fetchval("SELECT COUNT(*) FROM scheduled_sessions")
            co = await conn.fetchval("SELECT COUNT(*) FROM scheduled_sessions WHERE status='completed'")
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
        try:
            await conn.execute("INSERT INTO progress_records (org_id,client_id,recorded_by,record_type,metrics,notes,recorded_at,created_at) VALUES ($1,$2::uuid,$2::uuid,$3,$4::jsonb,$5,$6,NOW())",
                org_id, data["client_id"], data.get("type","measurement"),
                json.dumps({"weight":data.get("weight"),"measurements":data.get("measurements",{})}),
                data.get("notes",""), parse_dt(data.get("date",datetime.now().strftime("%Y-%m-%d"))))
        except: pass
        return {"success":True}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

# ==================== REMINDERS ====================
@router.post("/reminders/send")
async def send_reminders(data: dict = Body(...)): return {"success":True,"message":f"Reminders sent (demo)"}

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
            return {"success":True,"method":"whatsapp","link":f"https://wa.me/{ph}?text={urllib.parse.quote(msg)}","client_name":name,"message":msg} if ph else {"success":False,"message":"No phone"}
        elif method=="email":
            em = cl["email"]
            return {"success":True,"method":"email","link":f"mailto:{em}?subject={urllib.parse.quote('Session Reminder')}&body={urllib.parse.quote(msg)}","client_name":name,"message":msg} if em else {"success":False,"message":"No email"}
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
        return {"success":True,"payment_link":f"https://rzp.io/demo/{uuid.uuid4().hex[:8]}","amount":amt,"client_name":cl["full_name"],"mode":"demo","message":f"Demo link for Rs.{amt:.0f}"}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

# ==================== PUBLIC COACH PROFILES & REVIEWS ====================
@router.get("/coaches")
async def get_coaches():
    conn = await get_db()
    try:
        rows = await conn.fetch("SELECT id::text,full_name,email,phone,metadata,created_at::text FROM users WHERE role='coach' AND is_active=true AND deleted_at IS NULL ORDER BY created_at DESC")
        coaches = []
        for r in rows:
            m = json.loads(r["metadata"]) if isinstance(r["metadata"],str) else (r["metadata"] or {})
            coaches.append({"id":r["id"],"name":r["full_name"],"email":r["email"],"specialization":m.get("specialization","general"),"bio":m.get("bio",""),"experience_years":m.get("experience_years",0)})
        return {"success":True,"coaches":coaches}
    except: return {"success":True,"coaches":[]}
    finally: await conn.close()

@router.get("/coaches/{cid}/profile")
async def coach_profile(cid: str):
    conn = await get_db()
    try:
        await ensure_reviews_table(conn)
        c = await conn.fetchrow("SELECT id::text,full_name,email,metadata,created_at::text FROM users WHERE id=$1::uuid AND role='coach'", cid)
        if not c: raise HTTPException(404, "Coach not found")
        m = json.loads(c["metadata"]) if isinstance(c["metadata"],str) else (c["metadata"] or {})
        revs = await conn.fetch("SELECT id::text,client_name,rating,review_text,created_at::text FROM coach_reviews WHERE coach_id=$1::uuid AND is_public=true ORDER BY created_at DESC LIMIT 20", cid)
        cl_count = await conn.fetchval("SELECT COUNT(*) FROM users WHERE role='client' AND metadata->>'coach_id'=$1 AND is_active=true", cid)
        sess_count = await conn.fetchval("SELECT COUNT(*) FROM scheduled_sessions WHERE coach_id=$1::uuid AND status='completed'", cid)
        avg = await conn.fetchval("SELECT COALESCE(AVG(rating),0) FROM coach_reviews WHERE coach_id=$1::uuid AND is_public=true", cid)
        return {"success":True,"profile":{"id":c["id"],"name":c["full_name"],"email":c["email"],
            "specialization":m.get("specialization","general"),"bio":m.get("bio",""),"experience_years":m.get("experience_years",0),
            "client_count":cl_count,"session_count":sess_count,"avg_rating":round(float(avg),1),
            "reviews":[dict(r) for r in revs],"joined":c["created_at"]}}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.post("/coaches/{cid}/reviews")
async def add_review(cid: str, data: dict = Body(...)):
    conn = await get_db()
    try:
        await ensure_reviews_table(conn)
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
        await ensure_reviews_table(conn)
        rows = await conn.fetch("SELECT id::text,client_name,rating,review_text,created_at::text FROM coach_reviews WHERE coach_id=$1::uuid AND is_public=true ORDER BY created_at DESC", cid)
        return {"success":True,"reviews":[dict(r) for r in rows]}
    except: return {"success":True,"reviews":[]}
    finally: await conn.close()

# ==================== ADMIN ====================
@router.post("/admin/reset-database")
async def reset_db(data: dict = Body(...)):
    if data.get("confirm") != "YES_DELETE_EVERYTHING": raise HTTPException(400, "Confirm required")
    conn = await get_db()
    try:
        r = {}
        for t in ["scheduled_sessions","progress_records","session_templates","users"]:
            try: x = await conn.execute(f"DELETE FROM {t}"); r[t]=x
            except Exception as e: r[t]=str(e)
        try: await conn.execute("DROP TABLE IF EXISTS coach_reviews"); r["coach_reviews"]="dropped"
        except: pass
        await ensure_org(conn)
        return {"success":True,"message":"Database wiped","details":r}
    except Exception as e: raise HTTPException(500, str(e))
    finally: await conn.close()

@router.get("/")
async def root(): return {"status":"ok","version":"3.0-multi-coach"}

app.include_router(router, prefix="/api/v1")
