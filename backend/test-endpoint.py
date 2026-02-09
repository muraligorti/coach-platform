from fastapi import APIRouter, HTTPException

router = APIRouter()

@router.get("/test")
async def test_endpoint():
    return {"success": True, "message": "Backend is working"}

