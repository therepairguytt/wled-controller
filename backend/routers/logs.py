from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select
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
    stmt = select(SystemLog).order_by(SystemLog.id.desc()).limit(limit)
    logs = session.exec(stmt).all()

    if category:
        logs = [l for l in logs if l.category == category]
    if level:
        logs = [l for l in logs if l.level == level]

    return logs

@router.delete("")
def clear_logs(session: Session = Depends(get_session)):
    logs = session.exec(select(SystemLog)).all()
    for log in logs:
        session.delete(log)
    session.commit()
    return {"status": "cleared", "deleted": len(logs)}
