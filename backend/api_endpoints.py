from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
import asyncpg
import os

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

class ClientCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None

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
                COALESCE(og.numeric_score, 0)::int as progress,
                COUNT(DISTINCT ss.id)::int as sessions,
                COALESCE(og.grade_value, 'N/A') as overall_grade
            FROM users u
            LEFT JOIN overall_grades og ON u.id = og.client_id
            LEFT JOIN scheduled_sessions ss ON u.id = ss.client_id
            WHERE u.role = 'client' AND u.deleted_at IS NULL
            GROUP BY u.id, u.full_name, u.email, u.phone, og.numeric_score, og.grade_value
        """
        rows = await conn.fetch(query)
        await conn.close()
        return {"success": True, "clients": [dict(row) for row in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/clients")
async def create_client(client: ClientCreate):
    try:
        conn = await get_db()
        
        # Get the first available organization ID from database
        org_query = "SELECT id FROM organizations WHERE deleted_at IS NULL LIMIT 1"
        org_row = await conn.fetchrow(org_query)
        
        if not org_row:
            # Create a default organization if none exists
            create_org_query = """
                INSERT INTO organizations (name, category, subscription_plan, is_active)
                VALUES ('Default Organization', 'fitness', 'premium', true)
                RETURNING id
            """
            org_row = await conn.fetchrow(create_org_query)
        
        org_id = org_row['id']
        
        # Now create the user with valid org_id
        query = """
            INSERT INTO users (primary_org_id, full_name, email, phone, role, is_active, is_verified)
            VALUES ($1, $2, $3, $4, 'client', true, true)
            RETURNING id::text, full_name as name, email, phone
        """
        
        row = await conn.fetchrow(query, org_id, client.name, client.email, client.phone)
        await conn.close()
        
        return {"success": True, "client": dict(row), "message": "Client created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions")
async def get_sessions():
    try:
        conn = await get_db()
        query = """
            SELECT 
                ss.id::text,
                ss.scheduled_at::text,
                ss.status,
                u.full_name as client_name,
                st.name as template_name
            FROM scheduled_sessions ss
            JOIN users u ON ss.client_id = u.id
            LEFT JOIN session_templates st ON ss.session_template_id = st.id
            ORDER BY ss.scheduled_at DESC
            LIMIT 20
        """
        rows = await conn.fetch(query)
        await conn.close()
        return {"success": True, "sessions": [dict(row) for row in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/organizations")
async def get_organizations():
    """Get all organizations"""
    try:
        conn = await get_db()
        query = "SELECT id::text, name, category FROM organizations WHERE deleted_at IS NULL"
        rows = await conn.fetch(query)
        await conn.close()
        return {"success": True, "organizations": [dict(row) for row in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
