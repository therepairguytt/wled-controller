from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, delete
from backend.database import get_session
from backend.models import SystemLog, LogRead

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("", response_model=List[LogRead])
def get_logs(
    session: Session = Depends(get_session),
    limit: int = Query(default=200, le=1000),
    category: Optional[str] = Query(default=None),
    level: Optional[str] = Query(default=None),
):
    stmt = select(SystemLog)
    if category:
        stmt = stmt.where(SystemLog.category == category)
    if level:
        stmt = stmt.where(SystemLog.level == level)
    stmt = stmt.order_by(SystemLog.id.desc()).limit(limit)
    return session.exec(stmt).all()


@router.delete("")
def clear_logs(session: Session = Depends(get_session)):
    result = session.exec(delete(SystemLog))
    session.commit()
    return {"status": "cleared", "deleted": getattr(result, "rowcount", 0)}
