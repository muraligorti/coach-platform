import sys

# Read the file
with open('complete_api.py', 'r') as f:
    content = f.read()

# Find the session creation endpoint and check if it has recurrence support
if '/sessions' in content and 'recurrence' not in content:
    print("Adding daily recurrence support to sessions...")
    
    # Add a new endpoint for recurring sessions
    new_endpoint = '''

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
'''
    
    # Add the endpoint before the last line
    content = content.rstrip() + new_endpoint + '\n'
    
    with open('complete_api.py', 'w') as f:
        f.write(content)
    
    print("✅ Daily recurrence support added to backend")
else:
    print("Recurrence already exists or sessions endpoint not found")

