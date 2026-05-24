from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from backend.database import get_session
from backend.models import Broadcast
from backend.utils import active_broadcast_state

router = APIRouter(prefix="/api/broadcasts", tags=["broadcasts"])

@router.post("/{b_id}/toggle")
async def toggle_broadcast(b_id: int, session: Session = Depends(get_session)):
    b = session.get(Broadcast, b_id)
    if not b:
        raise HTTPException(404)
    b.is_active = not b.is_active
    if not b.is_active and b_id in active_broadcast_state:
        del active_broadcast_state[b_id]
    session.add(b)
    session.commit()
    return {"is_active": b.is_active}
