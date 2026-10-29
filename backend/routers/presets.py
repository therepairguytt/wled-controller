import asyncio
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select
from backend.database import engine, get_session
from backend.models import (
    Preset, PresetCreate, PresetRead,
    Controller, ControllerSegment, QuickActionTarget
)
from backend.logger import write_log
from backend.utils import manager, apply_preset_to_wled

router = APIRouter(prefix="/api/presets", tags=["presets"])


@router.get("", response_model=List[PresetRead])
def get_presets(session: Session = Depends(get_session)):
    statement = select(Preset)
    return session.exec(statement).all()


@router.post("", response_model=PresetRead)
async def add_preset(data: PresetCreate):
    with Session(engine) as session:
        preset = Preset(**data.model_dump())
        session.add(preset)
        session.commit()
        session.refresh(preset)

    write_log(
        level="SUCCESS", category="preset", action="created",
        message=f"Created preset '{preset.name}'",
        target_id=preset.id, target_name=preset.name
    )

    await manager.broadcast({
        "type": "preset_created",
        "data": preset.model_dump(mode="json")
    })
    return preset


@router.put("/{preset_id}", response_model=PresetRead)
async def update_preset(preset_id: int, data: PresetCreate):
    with Session(engine) as session:
        preset = session.get(Preset, preset_id)
        if not preset:
            raise HTTPException(status_code=404, detail="Preset not found")

        for key, value in data.model_dump().items():
            setattr(preset, key, value)

        session.add(preset)
        session.commit()
        session.refresh(preset)

    write_log(
        level="INFO", category="preset", action="updated",
        message=f"Updated preset '{preset.name}'",
        target_id=preset.id, target_name=preset.name
    )

    await manager.broadcast({
        "type": "preset_updated",
        "data": preset.model_dump(mode="json")
    })
    return preset


@router.delete("/{preset_id}")
async def delete_preset(preset_id: int):
    with Session(engine) as session:
        preset = session.get(Preset, preset_id)
        if not preset:
            raise HTTPException(
                status_code=404,
                detail="Preset not found"
            )

        try:
            session.delete(preset)
            session.commit()
        except IntegrityError:
            session.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Preset is assigned to a playlist or is in use."
            )

    write_log(
        level="WARN", category="preset", action="deleted",
        message=f"Deleted preset '{preset.name}'",
        target_id=preset_id, target_name=preset.name
    )

    await manager.broadcast({
        "type": "preset_deleted",
        "preset_id": preset_id
    })
    return {"status": "deleted"}


@router.post("/{preset_id}/apply")
async def apply_preset_now(preset_id: int, target: Optional[QuickActionTarget] = None):
    """Immediately push a preset to a specific controller, a group, or all active controllers."""
    with Session(engine) as session:
        preset = session.get(Preset, preset_id)
        if not preset:
            raise HTTPException(status_code=404, detail="Preset not found")

        if target and target.controller_id:
            ctrl = session.get(Controller, target.controller_id)
            controllers = [ctrl] if ctrl else []
        elif target and target.group_id:
            controllers = list(session.exec(
                select(Controller).where(
                    Controller.group_id == target.group_id,
                    Controller.is_active == True
                )
            ).all())
        else:
            controllers = list(session.exec(
                select(Controller).where(Controller.is_active == True)
            ).all())

        if not controllers:
            raise HTTPException(status_code=422, detail="No active target controllers found")

        segs_by_ctrl = {}
        for c in controllers:
            segs_by_ctrl[c.id] = list(session.exec(
                select(ControllerSegment)
                .where(ControllerSegment.controller_id == c.id)
                .order_by(ControllerSegment.segment_id)
            ).all())

        preset_name = preset.name

        async def _send(c):
            segs = segs_by_ctrl.get(c.id) or None
            return await apply_preset_to_wled(c, preset, segs, effect_only=False)

        results = await asyncio.gather(*[_send(c) for c in controllers])
        success_count = sum(1 for r in results if r)

    write_log(
        level="INFO",
        category="preset",
        action="dispatched",
        message=f"Applied preset '{preset_name}' to {success_count}/{len(controllers)} controller(s).",
        target_id=preset_id,
        target_name=preset_name,
    )
    return {
        "status": "applied",
        "preset": preset_name,
        "controllers_targeted": len(controllers),
        "controllers_succeeded": success_count,
    }
