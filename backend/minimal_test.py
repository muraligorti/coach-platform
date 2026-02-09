# Quick test to see if we can create a client
import asyncpg
import json

async def test_client_creation():
    try:
        conn = await asyncpg.connect(
            host="coach-db-server-1770519048.postgres.database.azure.com",
            database="coach_platform_db",
            user="dbadmin",
            password="SecurePass123!",
            port=5432,
            ssl="require"
        )
        
        print("✅ Database connected")
        
        # Try to insert a test client
        query = """
            INSERT INTO users (primary_org_id, full_name, email, phone, role, is_active, is_verified)
            VALUES ('00000000-0000-0000-0000-000000000001', 'Test Client API', 'testapi@test.com', '+91 8888888888', 'client', true, true)
            RETURNING id::text, full_name
        """
        
        result = await conn.fetchrow(query)
        print(f"✅ Client created: {result}")
        
        await conn.close()
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

import asyncio
asyncio.run(test_client_creation())

