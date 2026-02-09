"""
API Router
"""
from fastapi import APIRouter

# Create main API router
api_router = APIRouter()

# Import and include sub-routers here when ready
# from app.api.routes import auth, users, sessions, etc.
# api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

@api_router.get("/ping")
def ping():
    """Simple ping endpoint for testing"""
    return {"status": "ok", "message": "API is working"}
