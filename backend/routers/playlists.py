from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload
from backend.database import engine, get_session
from backend.models import (
    Playlist, PlaylistCreate, PlaylistReadWithItems,
    PlaylistItem, PlaylistItemCreate, Broadcast, QuickActionTarget
)
from backend.logger import write_log
from backend.utils import manager, active_broadcast_state

router = APIRouter(prefix="/api/playlists", tags=["playlists"])


@router.get("", response_model=List[PlaylistReadWithItems])
def get_playlists(session: Session = Depends(get_session)):
    statement = select(Playlist).options(selectinload(Playlist.items).selectinload(PlaylistItem.preset))
    return session.exec(statement).all()


@router.post("", response_model=PlaylistReadWithItems)
async def add_playlist(data: PlaylistCreate):
    with Session(engine) as session:
        playlist = Playlist(**data.model_dump())
        session.add(playlist)
        session.commit()
        session.refresh(playlist)

        statement = select(Playlist).where(Playlist.id == playlist.id).options(
            selectinload(Playlist.items).selectinload(PlaylistItem.preset)
        )
        playlist_with_items = session.exec(statement).one()

    write_log(
        level="SUCCESS", category="playlist", action="created",
        message=f"Created playlist '{playlist.name}'",
        target_id=playlist.id, target_name=playlist.name
    )

    await manager.broadcast({
        "type": "playlist_created",
        "data": playlist.model_dump(mode="json")
    })
    return playlist_with_items


@router.put("/{playlist_id}", response_model=PlaylistReadWithItems)
async def update_playlist(playlist_id: int, data: PlaylistCreate):
    with Session(engine) as session:
        playlist = session.get(Playlist, playlist_id)
        if not playlist:
            raise HTTPException(status_code=404, detail="Playlist not found")

        for key, value in data.model_dump().items():
            setattr(playlist, key, value)

        session.add(playlist)
        session.commit()

        statement = select(Playlist).where(Playlist.id == playlist.id).options(
            selectinload(Playlist.items).selectinload(PlaylistItem.preset)
        )
        playlist_with_items = session.exec(statement).one()

    write_log(
        level="INFO", category="playlist", action="updated",
        message=f"Updated playlist '{playlist.name}'",
        target_id=playlist.id, target_name=playlist.name
    )

    await manager.broadcast({
        "type": "playlist_updated",
        "data": playlist.model_dump(mode="json")
    })
    return playlist_with_items


@router.delete("/{playlist_id}")
async def delete_playlist(playlist_id: int):
    with Session(engine) as session:
        playlist = session.get(Playlist, playlist_id)
        if not playlist:
            raise HTTPException(status_code=404, detail="Playlist not found")

        p_name = playlist.name
        session.delete(playlist)
        session.commit()

    write_log(
        level="WARN", category="playlist", action="deleted",
        message=f"Deleted playlist '{p_name}'",
        target_id=playlist_id, target_name=p_name
    )

    await manager.broadcast({
        "type": "playlist_deleted",
        "playlist_id": playlist_id
    })
    return {"status": "deleted"}


@router.post("/{playlist_id}/items")
async def add_playlist_item(playlist_id: int, data: PlaylistItemCreate):
    with Session(engine) as session:
        playlist = session.get(Playlist, playlist_id)
        if not playlist:
            raise HTTPException(status_code=404, detail="Playlist not found")

        item = PlaylistItem(**data.model_dump(), playlist_id=playlist_id)
        session.add(item)
        session.commit()
        session.refresh(item)

        statement = select(Playlist).where(Playlist.id == playlist_id).options(
            selectinload(Playlist.items).selectinload(PlaylistItem.preset)
        )
        playlist_with_items = session.exec(statement).one()

    write_log(
        level="INFO", category="playlist", action="updated",
        message=f"Added item to playlist '{playlist.name}'",
        target_id=playlist.id, target_name=playlist.name
    )

    await manager.broadcast({
        "type": "playlist_updated",
        "data": playlist.model_dump(mode="json")
    })
    return playlist_with_items


@router.put("/{playlist_id}/items/{item_id}")
async def update_playlist_item(playlist_id: int, item_id: int, data: PlaylistItemCreate):
    with Session(engine) as session:
        item = session.get(PlaylistItem, item_id)
        if not item or item.playlist_id != playlist_id:
            raise HTTPException(status_code=404, detail="Playlist item not found")

        for k, v in data.model_dump().items():
            setattr(item, k, v)
        session.add(item)
        session.commit()

        playlist = session.get(Playlist, playlist_id)
        statement = select(Playlist).where(Playlist.id == playlist_id).options(
            selectinload(Playlist.items).selectinload(PlaylistItem.preset)
        )
        playlist_with_items = session.exec(statement).one()

    await manager.broadcast({
        "type": "playlist_updated",
        "data": playlist.model_dump(mode="json")
    })
    return playlist_with_items


@router.delete("/{playlist_id}/items/{item_id}")
async def delete_playlist_item(playlist_id: int, item_id: int):
    with Session(engine) as session:
        item = session.get(PlaylistItem, item_id)
        if not item or item.playlist_id != playlist_id:
            raise HTTPException(status_code=404, detail="Playlist item not found")

        playlist = session.get(Playlist, playlist_id)

        session.delete(item)
        session.commit()

        statement = select(Playlist).where(Playlist.id == playlist_id).options(
            selectinload(Playlist.items).selectinload(PlaylistItem.preset)
        )
        playlist_with_items = session.exec(statement).one()

    write_log(
        level="INFO", category="playlist", action="updated",
        message=f"Removed item from playlist '{playlist.name}'",
        target_id=playlist_id, target_name=playlist.name
    )

    await manager.broadcast({
        "type": "playlist_updated",
        "data": playlist.model_dump(mode="json")
    })
    return playlist_with_items


@router.post("/{playlist_id}/activate")
async def activate_playlist_now(playlist_id: int, target: Optional[QuickActionTarget] = None):
    """
    Quick Action: Activate an existing broadcast for this playlist (or create one if none exists)
    and reset its state so playback starts immediately from item 0.
    """
    with Session(engine) as session:
        playlist = session.get(Playlist, playlist_id)
        if not playlist:
            raise HTTPException(status_code=404, detail="Playlist not found")

        existing = session.exec(
            select(Broadcast).where(Broadcast.playlist_id == playlist_id)
        ).first()

        if existing:
            existing.is_active = True
            if target:
                if target.controller_id is not None:
                    existing.controller_id = target.controller_id
                    existing.group_id = None
                elif target.group_id is not None:
                    existing.group_id = target.group_id
                    existing.controller_id = None
            session.add(existing)
            session.commit()
            session.refresh(existing)
            b_id = existing.id
            b_name = existing.name
        else:
            new_b = Broadcast(
                name=f"{playlist.name} Broadcast",
                playlist_id=playlist_id,
                controller_id=target.controller_id if target else None,
                group_id=target.group_id if target else None,
                is_active=True,
                controller_delay_ms=0,
            )
            session.add(new_b)
            session.commit()
            session.refresh(new_b)
            b_id = new_b.id
            b_name = new_b.name

    # Reset state so playlist_runner immediately plays item 0 on next tick
    active_broadcast_state.pop(b_id, None)

    write_log(
        level="SUCCESS",
        category="playlist",
        action="toggled",
        message=f"Quick-started playlist '{playlist.name}' via broadcast '{b_name}'.",
        target_id=playlist_id,
        target_name=playlist.name,
    )
    await manager.broadcast({"type": "broadcast_toggled", "broadcast_id": b_id, "is_active": True})
    return {"status": "activated", "broadcast_id": b_id, "broadcast_name": b_name}
