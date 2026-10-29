from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from backend.database import engine, get_session
from backend.models import (
    BroadcastSchedule, BroadcastScheduleCreate, BroadcastScheduleRead,
    Broadcast, Playlist, Controller, Groups
)
from backend.utils import manager
from backend.logger import write_log

router = APIRouter(prefix="/api/schedules", tags=["schedules"])


def _enrich_schedule(s: BroadcastSchedule, session: Session) -> BroadcastScheduleRead:
    b = session.get(Broadcast, s.broadcast_id) if s.broadcast_id else None
    broadcast_name = b.name if b else f"Broadcast #{s.broadcast_id}"
    playlist_name = None
    target_name = "All Controllers"

    if b:
        playlist = session.get(Playlist, b.playlist_id)
        playlist_name = playlist.name if playlist else None
        if b.controller_id:
            ctrl = session.get(Controller, b.controller_id)
            target_name = ctrl.name if ctrl else f"Controller #{b.controller_id}"
        elif b.group_id:
            grp = session.get(Groups, b.group_id)
            target_name = grp.group_name if grp else f"Group #{b.group_id}"

    return BroadcastScheduleRead(
        id=s.id,
        broadcast_id=s.broadcast_id,
        broadcast_name=broadcast_name,
        playlist_name=playlist_name,
        target_name=target_name,
        start_time=s.start_time,
        end_time=s.end_time,
        days_of_week=s.days_of_week,
        is_enabled=s.is_enabled,
        created_on=s.created_on,
        modified_on=s.modified_on,
    )


@router.get("", response_model=List[BroadcastScheduleRead])
def get_schedules(session: Session = Depends(get_session)):
    schedules = session.exec(select(BroadcastSchedule)).all()
    return [_enrich_schedule(s, session) for s in schedules]


@router.post("", response_model=BroadcastScheduleRead)
async def create_schedule(data: BroadcastScheduleCreate):
    with Session(engine) as session:
        b = session.get(Broadcast, data.broadcast_id)
        if not b:
            raise HTTPException(status_code=404, detail="Broadcast not found")

        s = BroadcastSchedule(**data.model_dump())
        session.add(s)
        session.commit()
        session.refresh(s)
        result = _enrich_schedule(s, session)

    write_log(
        level="SUCCESS",
        category="schedule",
        action="created",
        message=f"Created schedule for broadcast '{result.broadcast_name}' ({s.start_time} - {s.end_time})",
        target_id=s.id,
        target_name=result.broadcast_name,
    )
    await manager.broadcast({"type": "schedule_created", "data": result.model_dump(mode="json")})
    return result


@router.put("/{schedule_id}", response_model=BroadcastScheduleRead)
async def update_schedule(schedule_id: int, data: BroadcastScheduleCreate):
    with Session(engine) as session:
        s = session.get(BroadcastSchedule, schedule_id)
        if not s:
            raise HTTPException(status_code=404, detail="Schedule not found")

        for k, v in data.model_dump().items():
            setattr(s, k, v)
        session.add(s)
        session.commit()
        session.refresh(s)
        result = _enrich_schedule(s, session)

    write_log(
        level="INFO",
        category="schedule",
        action="updated",
        message=f"Updated schedule for broadcast '{result.broadcast_name}' ({s.start_time} - {s.end_time})",
        target_id=s.id,
        target_name=result.broadcast_name,
    )
    await manager.broadcast({"type": "schedule_updated", "data": result.model_dump(mode="json")})
    return result


@router.delete("/{schedule_id}")
async def delete_schedule(schedule_id: int):
    with Session(engine) as session:
        s = session.get(BroadcastSchedule, schedule_id)
        if not s:
            raise HTTPException(status_code=404, detail="Schedule not found")
        b = session.get(Broadcast, s.broadcast_id)
        b_name = b.name if b else f"Schedule #{schedule_id}"
        session.delete(s)
        session.commit()

    write_log(
        level="WARN",
        category="schedule",
        action="deleted",
        message=f"Deleted schedule for broadcast '{b_name}'",
        target_id=schedule_id,
        target_name=b_name,
    )
    await manager.broadcast({"type": "schedule_deleted", "schedule_id": schedule_id})
    return {"status": "deleted"}


@router.post("/{schedule_id}/toggle")
async def toggle_schedule(schedule_id: int, session: Session = Depends(get_session)):
    s = session.get(BroadcastSchedule, schedule_id)
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    s.is_enabled = not s.is_enabled
    session.add(s)
    session.commit()
    await manager.broadcast({
        "type": "schedule_toggled",
        "schedule_id": schedule_id,
        "is_enabled": s.is_enabled,
    })
    return {"is_enabled": s.is_enabled}
