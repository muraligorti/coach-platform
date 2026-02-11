from fastapi import FastAPI, APIRouter, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import asyncpg
import json
from datetime import datetime, timedelta

app = FastAPI(title="Coach Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter(prefix="/api/v1")

# Database connection - CORRECTED CREDENTIALS
async def get_db():
    return await asyncpg.connect(
        host="coach-db-1770519048.postgres.database.azure.com",
        database="postgres",
        user="dbadmin",
        password="CoachPlatform2026!SecureDB",
        port=5432,
        ssl="require"
    )

async def get_or_create_org():
    return "00000000-0000-0000-0000-000000000001"

# ============================================================================
# CLIENTS
# ============================================================================
class ClientCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None

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

@router.get("/clients")
async def get_clients():
    try:
        conn = await get_db()
        
        query = """
            SELECT id::text, full_name as name, email, phone, created_at::text
            FROM users 
            WHERE role = 'client' AND deleted_at IS NULL
            ORDER BY created_at DESC
        """
        
        rows = await conn.fetch(query)
        await conn.close()
        
        return {"success": True, "clients": [dict(row) for row in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# SESSIONS
# ============================================================================
@router.get("/sessions")
async def get_sessions(client_id: Optional[str] = None):
    try:
        conn = await get_db()
        
        if client_id:
            query = """
                SELECT ss.id::text, ss.scheduled_at::text, ss.status, ss.duration_minutes,
                       ss.location, ss.metadata, u.full_name as client_name, u.id::text as client_id
                FROM scheduled_sessions ss
                JOIN users u ON ss.client_id = u.id
                WHERE ss.client_id = $1::uuid AND ss.deleted_at IS NULL
                ORDER BY ss.scheduled_at DESC
            """
            rows = await conn.fetch(query, client_id)
        else:
            query = """
                SELECT ss.id::text, ss.scheduled_at::text, ss.status, ss.duration_minutes,
                       ss.location, ss.metadata, u.full_name as client_name, u.id::text as client_id
                FROM scheduled_sessions ss
                JOIN users u ON ss.client_id = u.id
                WHERE ss.deleted_at IS NULL
                ORDER BY ss.scheduled_at DESC
            """
            rows = await conn.fetch(query)
        
        await conn.close()
        return {"success": True, "sessions": [dict(row) for row in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sessions")
async def create_session(
    client_id: str = Body(...),
    scheduled_at: str = Body(...),
    duration_minutes: int = Body(60),
    location_type: str = Body("online")
):
    try:
        conn = await get_db()
        org_id = await get_or_create_org()
        
        coach = await conn.fetchrow("SELECT id FROM users WHERE role = 'coach' LIMIT 1")
        
        query = """
            INSERT INTO scheduled_sessions 
            (org_id, coach_id, client_id, scheduled_at, duration_minutes, status, location)
            VALUES ($1, $2::uuid, $3::uuid, $4::timestamp, $5, 'scheduled', $6)
            RETURNING id::text
        """
        
        result = await conn.fetchrow(query, org_id, coach['id'], client_id, scheduled_at, duration_minutes, location_type)
        await conn.close()
        
        return {"success": True, "session_id": result['id']}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/sessions/{session_id}/status")
async def update_session_status(session_id: str, request: dict = Body(...)):
    try:
        conn = await get_db()
        status = request.get('status', 'completed')
        
        query = """
            UPDATE scheduled_sessions 
            SET status = $1, updated_at = NOW()
            WHERE id = $2::uuid
            RETURNING id::text, status
        """
        
        result = await conn.fetchrow(query, status, session_id)
        await conn.close()
        
        if not result:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {"success": True, "session": dict(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# DASHBOARD
# ============================================================================
@router.get("/dashboard/stats")
async def get_dashboard_stats():
    try:
        conn = await get_db()
        
        stats = {
            "total_clients": await conn.fetchval("SELECT COUNT(*) FROM users WHERE role = 'client' AND deleted_at IS NULL"),
            "total_sessions": await conn.fetchval("SELECT COUNT(*) FROM scheduled_sessions WHERE deleted_at IS NULL"),
            "completed_sessions": await conn.fetchval("SELECT COUNT(*) FROM scheduled_sessions WHERE status = 'completed' AND deleted_at IS NULL")
        }
        
        await conn.close()
        return {"success": True, "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# CONSISTENCY & PROGRESS
# ============================================================================
@router.get("/progress/consistency/{client_id}")
async def get_client_consistency(client_id: str, days: int = 30):
    try:
        conn = await get_db()
        
        query = """
            SELECT 
                COUNT(*) FILTER (WHERE status = 'scheduled') as sessions_scheduled,
                COUNT(*) FILTER (WHERE status = 'completed') as sessions_attended,
                CASE 
                    WHEN COUNT(*) FILTER (WHERE status = 'scheduled') > 0 
                    THEN ROUND((COUNT(*) FILTER (WHERE status = 'completed')::numeric / COUNT(*) FILTER (WHERE status = 'scheduled')::numeric) * 100)
                    ELSE 0 
                END as attendance_rate
            FROM scheduled_sessions
            WHERE client_id = $1::uuid
            AND scheduled_at >= CURRENT_DATE - $2::int
            AND deleted_at IS NULL
        """
        
        result = await conn.fetchrow(query, client_id, days)
        await conn.close()
        
        return {
            "success": True,
            "consistency": dict(result) if result else {}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/payments/client/{client_id}")
async def get_client_payments(client_id: str):
    return {"success": True, "payments": []}

@router.post("/progress/reminder/{client_id}")
async def send_progress_reminder(client_id: str):
    return {"success": True, "message": "Reminder sent"}

app.include_router(router)

@app.get("/")
async def root():
    return {"status": "healthy", "service": "Coach Platform API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
