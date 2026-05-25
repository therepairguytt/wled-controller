from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from backend.database import engine, get_session
from backend.models import WLEDEffects, EffectsCreate, EffectsRead
from backend.utils import manager

router = APIRouter(prefix="/api/effects", tags=["effects"])

@router.get("", response_model=List[EffectsRead])
def get_effects(session: Session = Depends(get_session)):
    effects = session.exec(select(WLEDEffects)).all()
    return effects

@router.post("")
async def add_effects(data: EffectsCreate):
    with Session(engine) as session:
        efft = WLEDEffects(
            name=data.name,
            effect_id=data.effect_id
        )

        session.add(efft)
        session.commit()
        session.refresh(efft)

    await manager.broadcast({
        "type": "effect_created",
        "data": efft.model_dump()
    })

    return efft

@router.put("/{eff_id}")
async def edit_effects(eff_id: int, data: EffectsCreate):
    with Session(engine) as session:
        db_eff = session.get(WLEDEffects, eff_id)
        if not db_eff:
            raise HTTPException(status_code=404, detail="Effect not found.")
        
        new_data = data.model_dump(exclude_unset=True)
        for key, value in new_data.items():
            setattr(db_eff, key, value)

        session.add(db_eff)
        session.commit()
        session.refresh(db_eff)

    await manager.broadcast({
        "type": "effect_updated",
        "data": db_eff.model_dump()
    })

    return db_eff

@router.delete("/{eff_id}")
async def delete_effects(eff_id: int):
    with Session(engine) as session:
        efft = session.get(WLEDEffects, eff_id)
        if not efft:
            raise HTTPException(status_code=404, detail="Effect not found")

        session.delete(efft)
        session.commit()

    await manager.broadcast({
        "type": "effect_deleted",
        "ctrl_id": eff_id
    })

    return {"status": "deleted"}
