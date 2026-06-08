from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy.orm import joinedload
from backend.database import engine, get_session
from backend.models import ControllerSegment, ControllerSegmentCreate, ControllerSegmentReadWithName
from backend.utils import manager

router = APIRouter(prefix="/api/segments", tags=["segments"])

@router.get("", response_model=List[ControllerSegmentReadWithName])
def get_segments(session: Session = Depends(get_session)):
    statement = select(ControllerSegment).options(joinedload(ControllerSegment.controller_name))
    return session.exec(statement).all()

@router.post("")
async def add_segments(data: ControllerSegmentCreate):
    with Session(engine) as session:
        seg_id = data.segment_id
        if seg_id is None:
            statement = select(ControllerSegment).where(ControllerSegment.controller_id == data.controller_id)
            existing_segs = session.exec(statement).all()
            if existing_segs:
                seg_id = max(s.segment_id for s in existing_segs) + 1
            else:
                seg_id = 0

        seg = ControllerSegment(
            name=data.name,
            controller_id=data.controller_id,
            segment_id=seg_id,
            start_led=data.start_led,
            stop_led=data.stop_led,
            offset=data.offset,
            grouping=data.grouping,
            spacing=data.spacing,
            mirror_effect=data.mirror_effect,
            seg_bri=data.seg_bri
        )

        session.add(seg)
        session.commit()
        session.refresh(seg)

    await manager.broadcast({
        "type": "segment_created",
        "data": seg.model_dump()
    })

    return seg

@router.put("/{seg_id}")
async def edit_segments(seg_id: int, data: ControllerSegmentCreate):
    with Session(engine) as session:
        db_seg = session.get(ControllerSegment, seg_id)
        if not db_seg:
            raise HTTPException(status_code=404, detail="Segment not found.")
        
        new_data = data.model_dump(exclude_unset=True)
        for key, value in new_data.items():
            setattr(db_seg, key, value)

        session.add(db_seg)
        session.commit()
        session.refresh(db_seg)

    await manager.broadcast({
        "type": "segment_updated",
        "data": db_seg.model_dump()
    })

    return db_seg

@router.delete("/{seg_id}")
async def delete_segment(seg_id: int):
    with Session(engine) as session:
        seg = session.get(ControllerSegment, seg_id)
        if not seg:
            raise HTTPException(status_code=404, detail="Segment not found")

        session.delete(seg)
        session.commit()

    await manager.broadcast({
        "type": "segment_deleted",
        "ctrl_id": seg_id
    })

    return {"status": "deleted"}
