import httpx
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from backend.database import engine, get_session
from backend.models import WLEDPalettes, PalettesCreate, PalettesRead, Controller
from backend.wled_seed_data import WLED_PALETTES
from backend.utils import manager
from backend.logger import write_log

router = APIRouter(prefix="/api/palettes", tags=["palettes"])


@router.get("", response_model=List[PalettesRead])
def get_palettes(session: Session = Depends(get_session)):
    palettes = session.exec(select(WLEDPalettes).order_by(WLEDPalettes.palettes_id)).all()
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
        "data": pal.model_dump(mode="json")
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
        "data": db_pal.model_dump(mode="json")
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


@router.post("/sync/{ctrl_id}")
async def sync_palettes_from_controller(ctrl_id: int):
    """Fetch live palette list (including custom 0.16.1 palettes) from a WLED controller via /json/pal."""
    with Session(engine) as session:
        ctrl = session.get(Controller, ctrl_id)
        if not ctrl:
            raise HTTPException(status_code=404, detail="Controller not found")
        ctrl_ip = ctrl.ip_address
        ctrl_name = ctrl.name

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(f"http://{ctrl_ip}/json/pal")
            res.raise_for_status()
            palette_names = res.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch /json/pal from {ctrl_ip}: {e}")

    if not isinstance(palette_names, list):
        raise HTTPException(status_code=502, detail="Unexpected /json/pal response format")

    added = 0
    updated = 0
    with Session(engine) as session:
        existing = {p.palettes_id: p for p in session.exec(select(WLEDPalettes)).all()}
        for idx, name in enumerate(palette_names):
            if not name:
                continue
            clean_name = str(name).strip()
            if idx in existing:
                if existing[idx].name != clean_name:
                    existing[idx].name = clean_name
                    session.add(existing[idx])
                    updated += 1
            else:
                session.add(WLEDPalettes(palettes_id=idx, name=clean_name))
                added += 1
        session.commit()

    write_log(
        level="SUCCESS",
        category="system",
        action="synced",
        message=f"Synced {len(palette_names)} palettes from '{ctrl_name}' ({added} new, {updated} updated).",
        target_id=ctrl_id,
        target_name=ctrl_name,
    )
    await manager.broadcast({"type": "palettes_synced", "added": added, "updated": updated, "total": len(palette_names)})
    return {"status": "synced", "added": added, "updated": updated, "total": len(palette_names)}


@router.post("/seed-defaults")
async def seed_default_palettes():
    """Ensure all WLED 0.16.1 default palettes are present in the database."""
    added = 0
    with Session(engine) as session:
        existing = {p.palettes_id: p for p in session.exec(select(WLEDPalettes)).all()}
        for pal_id, name in WLED_PALETTES.items():
            if pal_id not in existing:
                session.add(WLEDPalettes(palettes_id=pal_id, name=name))
                added += 1
        session.commit()

    return {"status": "ok", "added": added, "total": len(WLED_PALETTES)}
