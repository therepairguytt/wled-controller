from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from backend.database import engine, get_session
from backend.models import WLEDPalettes, PalettesCreate, PalettesRead
from backend.utils import manager

router = APIRouter(prefix="/api/palettes", tags=["palettes"])

@router.get("", response_model=List[PalettesRead])
def get_palettes(session: Session = Depends(get_session)):
    palettes = session.exec(select(WLEDPalettes)).all()
    return palettes

@router.post("")
async def add_palettes(data: PalettesCreate):
    with Session(engine) as session:
        pal = WLEDPalettes(
            name=data.name,
            palettes_id=data.palettes_id
        )

        session.add(pal)
        session.commit()
        session.refresh(pal)

    await manager.broadcast({
        "type": "palette_created",
        "data": pal.model_dump()
    })

    return pal

@router.put("/{pal_id}")
async def edit_palettes(pal_id: int, data: PalettesCreate):
    with Session(engine) as session:
        db_pal = session.get(WLEDPalettes, pal_id)
        if not db_pal:
            raise HTTPException(status_code=404, detail="Palette not found.")
        
        new_data = data.model_dump(exclude_unset=True)
        for key, value in new_data.items():
            setattr(db_pal, key, value)

        session.add(db_pal)
        session.commit()
        session.refresh(db_pal)

    await manager.broadcast({
        "type": "palette_updated",
        "data": db_pal.model_dump()
    })

    return db_pal

@router.delete("/{pal_id}")
async def delete_palettes(pal_id: int):
    with Session(engine) as session:
        pal = session.get(WLEDPalettes, pal_id)
        if not pal:
            raise HTTPException(status_code=404, detail="Palette not found")

        session.delete(pal)
        session.commit()

    await manager.broadcast({
        "type": "palette_deleted",
        "ctrl_id": pal_id
    })

    return {"status": "deleted"}
