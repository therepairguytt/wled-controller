import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from sqlalchemy import text
from backend.database import get_session

router = APIRouter(prefix="/api/health", tags=["health"])

logger = logging.getLogger("uvicorn.error")

@router.get("", status_code=status.HTTP_200_OK)
def health_check(session: Session = Depends(get_session)):
    health_status = {
        "api": "up",
        "database": "down"
    }
    
    try:
        session.exec(text("SELECT 1"))
        health_status["database"] = "up"
        return health_status
        
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=health_status
        )
