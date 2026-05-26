from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from backend.database import engine, get_session
from backend.models import Preset, PresetCreate, PresetRead
from backend.logger import write_log
from backend.utils import manager

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
        "data": preset.model_dump()
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
        "data": preset.model_dump()
    })
    return preset

@router.delete("/{preset_id}")
async def delete_preset(preset_id: int):
    with Session(engine) as session:
        preset = session.get(Preset, preset_id)
        if not preset:
            raise HTTPException(status_code=404, detail="Preset not found")
            
        session.delete(preset)
        session.commit()

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
