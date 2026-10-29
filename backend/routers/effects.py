import httpx
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from backend.database import engine, get_session
from backend.models import WLEDEffects, EffectsCreate, EffectsRead, Controller
from backend.wled_seed_data import WLED_EFFECTS
from backend.utils import manager
from backend.logger import write_log

router = APIRouter(prefix="/api/effects", tags=["effects"])


@router.get("", response_model=List[EffectsRead])
def get_effects(session: Session = Depends(get_session)):
    effects = session.exec(select(WLEDEffects).order_by(WLEDEffects.effect_id)).all()
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
        "data": efft.model_dump(mode="json")
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
        "data": db_eff.model_dump(mode="json")
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


@router.post("/sync/{ctrl_id}")
async def sync_effects_from_controller(ctrl_id: int):
    """Fetch live effect list from a WLED v0.16.1 controller via /json/eff and upsert into DB."""
    with Session(engine) as session:
        ctrl = session.get(Controller, ctrl_id)
        if not ctrl:
            raise HTTPException(status_code=404, detail="Controller not found")
        ctrl_ip = ctrl.ip_address
        ctrl_name = ctrl.name

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(f"http://{ctrl_ip}/json/eff")
            res.raise_for_status()
            effect_names = res.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch /json/eff from {ctrl_ip}: {e}")

    if not isinstance(effect_names, list):
        raise HTTPException(status_code=502, detail="Unexpected /json/eff response format")

    added = 0
    updated = 0
    with Session(engine) as session:
        existing = {e.effect_id: e for e in session.exec(select(WLEDEffects)).all()}
        for idx, name in enumerate(effect_names):
            if not name:
                continue
            clean_name = str(name).strip()
            if idx in existing:
                if existing[idx].name != clean_name:
                    existing[idx].name = clean_name
                    session.add(existing[idx])
                    updated += 1
            else:
                session.add(WLEDEffects(effect_id=idx, name=clean_name))
                added += 1
        session.commit()

    write_log(
        level="SUCCESS",
        category="system",
        action="synced",
        message=f"Synced {len(effect_names)} effects from '{ctrl_name}' ({added} new, {updated} updated).",
        target_id=ctrl_id,
        target_name=ctrl_name,
    )
    await manager.broadcast({"type": "effects_synced", "added": added, "updated": updated, "total": len(effect_names)})
    return {"status": "synced", "added": added, "updated": updated, "total": len(effect_names)}


@router.post("/seed-defaults")
async def seed_default_effects():
    """Ensure all WLED 0.16.1 default effects are present in the database."""
    added = 0
    updated = 0
    with Session(engine) as session:
        existing = {e.effect_id: e for e in session.exec(select(WLEDEffects)).all()}
        for eff_id, name in WLED_EFFECTS.items():
            if eff_id not in existing:
                session.add(WLEDEffects(effect_id=eff_id, name=name))
                added += 1
            elif existing[eff_id].name == "RSVD" and name != "RSVD":
                existing[eff_id].name = name
                session.add(existing[eff_id])
                updated += 1
        session.commit()

    return {"status": "ok", "added": added, "updated": updated, "total": len(WLED_EFFECTS)}
