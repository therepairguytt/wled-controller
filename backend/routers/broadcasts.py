import asyncio
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from backend.database import engine, get_session
from backend.models import (
    Broadcast, BroadcastCreate, BroadcastRead,
    Playlist, PlaylistItem, Preset,
    Controller, ControllerSegment, Groups,
)
from backend.utils import active_broadcast_state, apply_preset_to_wled, manager
from backend.logger import write_log

router = APIRouter(prefix="/api/broadcasts", tags=["broadcasts"])

# ── helpers ───────────────────────────────────────────────────────────────────

def _enrich(b: Broadcast, session: Session) -> BroadcastRead:
    """Attach human-readable names to a Broadcast row."""
    playlist = session.get(Playlist, b.playlist_id)
    target_name = None
    target_type  = None

    if b.controller_id:
        ctrl = session.get(Controller, b.controller_id)
        target_name = ctrl.name if ctrl else f"Controller #{b.controller_id}"
        target_type = "controller"
    elif b.group_id:
        grp = session.get(Groups, b.group_id)
        target_name = grp.group_name if grp else f"Group #{b.group_id}"
        target_type = "group"
    else:
        target_type = "all"

    return BroadcastRead(
        id=b.id,
        name=b.name,
        playlist_id=b.playlist_id,
        controller_id=b.controller_id,
        group_id=b.group_id,
        is_active=b.is_active,
        controller_delay_ms=b.controller_delay_ms,
        playlist_name=playlist.name if playlist else None,
        target_name=target_name,
        target_type=target_type,
    )


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[BroadcastRead])
def get_broadcasts(session: Session = Depends(get_session)):
    broadcasts = session.exec(select(Broadcast)).all()
    return [_enrich(b, session) for b in broadcasts]


@router.post("", response_model=BroadcastRead)
async def create_broadcast(data: BroadcastCreate):
    with Session(engine) as session:
        b = Broadcast(**data.model_dump())
        session.add(b)
        session.commit()
        session.refresh(b)
        result = _enrich(b, session)

    write_log(level="SUCCESS", category="broadcast", action="created",
              message=f"Created broadcast '{b.name}'",
              target_id=b.id, target_name=b.name)
    await manager.broadcast({"type": "broadcast_created", "data": result.model_dump()})
    return result


@router.put("/{b_id}", response_model=BroadcastRead)
async def update_broadcast(b_id: int, data: BroadcastCreate):
    with Session(engine) as session:
        b = session.get(Broadcast, b_id)
        if not b:
            raise HTTPException(status_code=404, detail="Broadcast not found")
        for k, v in data.model_dump().items():
            setattr(b, k, v)
        session.add(b)
        session.commit()
        session.refresh(b)
        result = _enrich(b, session)

    write_log(level="INFO", category="broadcast", action="updated",
              message=f"Updated broadcast '{b.name}'",
              target_id=b.id, target_name=b.name)
    await manager.broadcast({"type": "broadcast_updated", "data": result.model_dump()})
    return result


@router.delete("/{b_id}")
async def delete_broadcast(b_id: int):
    with Session(engine) as session:
        b = session.get(Broadcast, b_id)
        if not b:
            raise HTTPException(status_code=404, detail="Broadcast not found")
        name = b.name
        session.delete(b)
        session.commit()

    active_broadcast_state.pop(b_id, None)
    write_log(level="WARN", category="broadcast", action="deleted",
              message=f"Deleted broadcast '{name}'", target_id=b_id, target_name=name)
    await manager.broadcast({"type": "broadcast_deleted", "broadcast_id": b_id})
    return {"status": "deleted"}


@router.post("/{b_id}/toggle")
async def toggle_broadcast(b_id: int, session: Session = Depends(get_session)):
    b = session.get(Broadcast, b_id)
    if not b:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    b.is_active = not b.is_active
    if not b.is_active:
        active_broadcast_state.pop(b_id, None)
    session.add(b)
    session.commit()
    await manager.broadcast({"type": "broadcast_toggled", "broadcast_id": b_id, "is_active": b.is_active})
    return {"is_active": b.is_active}


# ── Dispatch ──────────────────────────────────────────────────────────────────

@router.post("/{b_id}/dispatch")
async def dispatch_broadcast(b_id: int):
    """
    One-shot delivery: iterate every playlist item in order, send each preset
    to every target controller via WLED WebSocket, waiting
    `controller_delay_ms` between consecutive controller sends.
    Streams progress events back to the dashboard via the /ws manager.
    """
    with Session(engine) as session:
        b = session.get(Broadcast, b_id)
        if not b:
            raise HTTPException(status_code=404, detail="Broadcast not found")

        # -- Resolve target controllers ----------------------------------------
        targets: list[Controller] = []
        if b.controller_id:
            ctrl = session.get(Controller, b.controller_id)
            if ctrl:
                targets.append(ctrl)
        elif b.group_id:
            targets = list(session.exec(
                select(Controller).where(Controller.group_id == b.group_id)
            ).all())
        else:
            targets = list(session.exec(select(Controller)).all())

        if not targets:
            raise HTTPException(status_code=422, detail="No controllers found for this broadcast")

        # -- Load playlist items -----------------------------------------------
        items = list(session.exec(
            select(PlaylistItem)
            .where(PlaylistItem.playlist_id == b.playlist_id)
            .order_by(PlaylistItem.sort_order)
        ).all())

        if not items:
            raise HTTPException(status_code=422, detail="Playlist has no items")

        # -- Pre-load presets and per-controller segments ----------------------
        presets_map: dict[int, Preset] = {}
        for item in items:
            if item.preset_id not in presets_map:
                p = session.get(Preset, item.preset_id)
                if p:
                    presets_map[item.preset_id] = p

        # Map controller_id → its segments (sorted by segment_id)
        segs_map: dict[int, list] = {}
        for ctrl in targets:
            segs = list(session.exec(
                select(ControllerSegment)
                .where(ControllerSegment.controller_id == ctrl.id)
                .order_by(ControllerSegment.segment_id)
            ).all())
            segs_map[ctrl.id] = segs

        # Detach from session so we can use them outside the `with` block
        delay_ms   = b.controller_delay_ms
        b_name     = b.name

    # Notify start
    await manager.broadcast({
        "type": "dispatch_start",
        "broadcast_id": b_id,
        "broadcast_name": b_name,
        "total_controllers": len(targets),
        "total_items": len(items),
    })

    write_log(level="INFO", category="broadcast", action="dispatched",
              message=f"Dispatch started for broadcast '{b_name}' → {len(targets)} controller(s)",
              target_id=b_id, target_name=b_name)

    # -- Send every item to every controller ----------------------------------
    for item in items:
        preset = presets_map.get(item.preset_id)
        if not preset:
            continue

        for idx, ctrl in enumerate(targets):
            segments = segs_map.get(ctrl.id) or []

            await manager.broadcast({
                "type": "dispatch_progress",
                "broadcast_id": b_id,
                "controller_id": ctrl.id,
                "controller_name": ctrl.name,
                "preset_name": preset.name,
                "status": "sending",
            })

            ok = await apply_preset_to_wled(ctrl, preset, segments if segments else None, effect_only=False)

            await manager.broadcast({
                "type": "dispatch_progress",
                "broadcast_id": b_id,
                "controller_id": ctrl.id,
                "controller_name": ctrl.name,
                "preset_name": preset.name,
                "status": "ok" if ok else "error",
            })

            # Wait between controllers (but not after the last one)
            if delay_ms > 0 and idx < len(targets) - 1:
                await asyncio.sleep(delay_ms / 1000)

    await manager.broadcast({
        "type": "dispatch_complete",
        "broadcast_id": b_id,
        "broadcast_name": b_name,
    })

    write_log(level="SUCCESS", category="broadcast", action="dispatched",
              message=f"Dispatch complete for broadcast '{b_name}'",
              target_id=b_id, target_name=b_name)

    return {"status": "dispatched", "controllers": len(targets), "items": len(items)}
