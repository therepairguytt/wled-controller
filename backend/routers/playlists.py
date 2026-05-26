from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload
from backend.database import engine, get_session
from backend.models import Playlist, PlaylistCreate, PlaylistReadWithItems, PlaylistItem, PlaylistItemCreate
from backend.logger import write_log
from backend.utils import manager

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
        
        # Reload with items
        statement = select(Playlist).where(Playlist.id == playlist.id).options(selectinload(Playlist.items).selectinload(PlaylistItem.preset))
        playlist_with_items = session.exec(statement).one()

    write_log(
        level="SUCCESS", category="playlist", action="created",
        message=f"Created playlist '{playlist.name}'",
        target_id=playlist.id, target_name=playlist.name
    )
    
    await manager.broadcast({
        "type": "playlist_created",
        "data": playlist.model_dump()
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
        
        statement = select(Playlist).where(Playlist.id == playlist.id).options(selectinload(Playlist.items).selectinload(PlaylistItem.preset))
        playlist_with_items = session.exec(statement).one()

    write_log(
        level="INFO", category="playlist", action="updated",
        message=f"Updated playlist '{playlist.name}'",
        target_id=playlist.id, target_name=playlist.name
    )

    await manager.broadcast({
        "type": "playlist_updated",
        "data": playlist.model_dump()
    })
    return playlist_with_items

@router.delete("/{playlist_id}")
async def delete_playlist(playlist_id: int):
    with Session(engine) as session:
        playlist = session.get(Playlist, playlist_id)
        if not playlist:
            raise HTTPException(status_code=404, detail="Playlist not found")
            
        session.delete(playlist)
        session.commit()

    write_log(
        level="WARN", category="playlist", action="deleted",
        message=f"Deleted playlist '{playlist.name}'",
        target_id=playlist_id, target_name=playlist.name
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
        
        statement = select(Playlist).where(Playlist.id == playlist_id).options(selectinload(Playlist.items).selectinload(PlaylistItem.preset))
        playlist_with_items = session.exec(statement).one()
        
    write_log(
        level="INFO", category="playlist", action="updated",
        message=f"Added item to playlist '{playlist.name}'",
        target_id=playlist.id, target_name=playlist.name
    )
        
    await manager.broadcast({
        "type": "playlist_updated",
        "data": playlist.model_dump()
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
        
        statement = select(Playlist).where(Playlist.id == playlist_id).options(selectinload(Playlist.items).selectinload(PlaylistItem.preset))
        playlist_with_items = session.exec(statement).one()
        
    write_log(
        level="INFO", category="playlist", action="updated",
        message=f"Removed item from playlist '{playlist.name}'",
        target_id=playlist_id, target_name=playlist.name
    )

    await manager.broadcast({
        "type": "playlist_updated",
        "data": playlist.model_dump()
    })
    return playlist_with_items
