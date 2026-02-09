from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncpg
import os

app = FastAPI(
    title="Coach Platform API",
    description="Complete Coaching Platform with Authentication, Payments, Sessions & More",
    version="2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "status": "operational",
        "message": "Coach Platform API v2.0",
        "features": [
            "Authentication (OTP & Password)",
            "Client Management",
            "Session Scheduling",
            "Progress Tracking",
            "Grading System",
            "Payment Integration",
            "Workout Templates",
            "Referral System"
        ]
    }

@app.get("/health")
async def health():
    try:
        conn = await asyncpg.connect(
            host=os.getenv("DB_HOST", "coach-db-1770519048.postgres.database.azure.com"),
            port=5432,
            user=os.getenv("DB_USER", "dbadmin"),
            password=os.getenv("DB_PASSWORD", "CoachPlatform2026!SecureDB"),
            database=os.getenv("DB_NAME", "coach_platform"),
            ssl='require'
        )
        await conn.execute('SELECT 1')
        await conn.close()
        return {"success": True, "status": "healthy", "checks": {"api": "operational", "database": "connected"}}
    except Exception as e:
        return {"success": False, "status": "degraded", "checks": {"api": "operational", "database": f"error: {str(e)}"}}

from complete_api import router
app.include_router(router, prefix="/api/v1", tags=["API"])
