import asyncio
import httpx
from datetime import datetime, timezone
from typing import Optional, List, Dict
from contextlib import asynccontextmanager
from urllib.parse import quote_plus

from fastapi import FastAPI, HTTPException, WebSocket, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import SQLModel, Field, Session, create_engine, select, Relationship
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload
from backend.wled_seed_data import WLED_EFFECTS, WLED_PALETTES

import os
from dotenv import load_dotenv
from urllib.parse import quote_plus

load_dotenv()

# =========================================================
# DATABASE
# =========================================================

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

password = quote_plus(DB_PASSWORD)
DATABASE_URL = f"postgresql://{DB_USER}:{password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL, echo=False)

def get_utc_now():
    return datetime.now(timezone.utc)

def get_session():
    with Session(engine) as session:
        yield session

# =========================================================
# APP INFO
# =========================================================

APP_NAME = os.getenv("APP_NAME")
COPYRIGHT_NAME = os.getenv("COPYRIGHT_NAME")

# =========================================================
# MODELS
# =========================================================

class Groups(SQLModel, table=True):
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    group_name: str = Field(index=True, unique=True)
    controllers: list["Controller"] = Relationship(back_populates="group")
    created_on: datetime = Field(default_factory=get_utc_now, nullable=False)
    modified_on: datetime = Field(
        default_factory=get_utc_now,
        sa_column_kwargs={"onupdate": get_utc_now},
        nullable=False
    )

class Controller(SQLModel, table=True):
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    ip_address: str
    location: str
    group_id: Optional[int] = Field(default=None, foreign_key="groups.id")
    group: Optional["Groups"] = Relationship(back_populates="controllers")
    main_brightness: int = 128
    is_active: bool = True
    is_online: bool = False
    led_on: bool = True
    segments: list["ControllerSegment"] = Relationship(back_populates="controller_name")
    created_on: datetime = Field(default_factory=get_utc_now, nullable=False)
    modified_on: datetime = Field(
        default_factory=get_utc_now,
        sa_column_kwargs={"onupdate": get_utc_now},
        nullable=False
    )

class ControllerSegment(SQLModel, table=True):
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    controller_id: Optional[int] = Field(default=None, foreign_key="controller.id")
    controller_name: Optional["Controller"] = Relationship(back_populates="segments")
    segment_id: int = 0
    start_led: int
    stop_led: int
    offset: int = 0
    grouping: int = 1
    spacing: int = 0
    reverse_direction: bool = False
    mirror_effect: bool = False
    seg_bri: int = 255
    created_on: datetime = Field(default_factory=get_utc_now, nullable=False)
    modified_on: datetime = Field(
        default_factory=get_utc_now,
        sa_column_kwargs={"onupdate": get_utc_now},
        nullable=False
    )

class Preset(SQLModel, table=True):
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    is_on: bool = True
    transition: int = 7
    effect_id: int = 140
    effect_speed: int = 128
    effect_intensity: int = 128
    palette_id: int = 2
    color1: str = "#FF0000"
    color2: str = "#00FF00"
    color3: str = "#0000FF"
    created_on: datetime = Field(default_factory=get_utc_now, nullable=False)
    modified_on: datetime = Field(
        default_factory=get_utc_now,
        sa_column_kwargs={"onupdate": get_utc_now},
        nullable=False
    )

class Playlist(SQLModel, table=True):
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    repeat_forever: bool = True
    created_on: datetime = Field(default_factory=get_utc_now, nullable=False)
    modified_on: datetime = Field(
        default_factory=get_utc_now,
        sa_column_kwargs={"onupdate": get_utc_now},
        nullable=False
    )

class PlaylistItem(SQLModel, table=True):
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    playlist_id: int = Field(foreign_key="playlist.id")
    preset_id: int = Field(foreign_key="preset.id")
    sort_order: int
    duration_seconds: int = 10
    created_on: datetime = Field(default_factory=get_utc_now, nullable=False)
    modified_on: datetime = Field(
        default_factory=get_utc_now,
        sa_column_kwargs={"onupdate": get_utc_now},
        nullable=False
    )

class Broadcast(SQLModel, table=True):
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    playlist_id: int = Field(foreign_key="playlist.id")
    controller_id: Optional[int] = Field(default=None, foreign_key="controller.id")
    group_id: Optional[int] = Field(default=None, foreign_key="groups.id")
    is_active: bool = True
    created_on: datetime = Field(default_factory=get_utc_now, nullable=False)
    modified_on: datetime = Field(
        default_factory=get_utc_now,
        sa_column_kwargs={"onupdate": get_utc_now},
        nullable=False
    )

class BroadcastSchedule(SQLModel, table=True):
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    broadcast_id: int = Field(default=None, foreign_key="broadcast.id")
    start_time: str # "HH:MM"
    end_time: str   # "HH:MM"
    days_of_week: str = "0,1,2,3,4,5,6" 
    is_enabled: bool = True
    created_on: datetime = Field(default_factory=get_utc_now, nullable=False)
    modified_on: datetime = Field(
        default_factory=get_utc_now,
        sa_column_kwargs={"onupdate": get_utc_now},
        nullable=False
    )

class WLEDEffects(SQLModel, table=True):
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    effect_id: int = Field(unique=True, index=True)
    name: str
    created_on: datetime = Field(default_factory=get_utc_now, nullable=False)
    modified_on: datetime = Field(
        default_factory=get_utc_now,
        sa_column_kwargs={"onupdate": get_utc_now},
        nullable=False
    )

class WLEDPalettes(SQLModel, table=True):
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    palettes_id: int = Field(unique=True, index=True)
    name: str
    created_on: datetime = Field(default_factory=get_utc_now, nullable=False)
    modified_on: datetime = Field(
        default_factory=get_utc_now,
        sa_column_kwargs={"onupdate": get_utc_now},
        nullable=False
    )

# =========================================================
# UTILITIES & STATE
# =========================================================

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                continue

manager = ConnectionManager()
client = httpx.AsyncClient(timeout=3.0)
active_broadcast_state: Dict[int, dict] = {}

def hex_to_rgb(hex_str: str) -> List[int]:
    h = hex_str.lstrip('#')
    return [int(h[i:i+2], 16) for i in (0, 2, 4)]

async def apply_preset_to_wled(controller: Controller, preset: Preset):
    payload = {
        "on": preset.is_on,
        "bri": controller.main_brightness,
        "seg": [{
            "col": [hex_to_rgb(preset.color1), hex_to_rgb(preset.color2), hex_to_rgb(preset.color3)],
            "fx": preset.effect_id, "sx": preset.effect_speed, "ix": preset.effect_intensity,
            "pal": preset.palette_id
        }]
    }
    try:
        await client.post(f"http://{controller.ip_address}/json/state", json=payload)
    except Exception as e:
        print(f"Failed to update {controller.name}: {e}")

# =========================================================
# BACKGROUND TASKS
# =========================================================

async def playlist_runner():
    while True:
        with Session(engine) as session:
            broadcasts = session.exec(select(Broadcast).where(Broadcast.is_active == True)).all()
            now = get_utc_now()

            for b in broadcasts:
                items = session.exec(select(PlaylistItem).where(PlaylistItem.playlist_id == b.playlist_id).order_by(PlaylistItem.sort_order)).all()
                if not items: continue

                state = active_broadcast_state.get(b.id)
                if not state or now >= state["next_switch"]:
                    next_idx = (state["item_index"] + 1) % len(items) if state else 0
                    target_item = items[next_idx]
                    target_preset = session.get(Preset, target_item.preset_id)

                    # Gather targets
                    targets = []
                    if b.controller_id:
                        c = session.get(Controller, b.controller_id)
                        if c: targets.append(c)
                    elif b.controller_group:
                        targets = session.exec(select(Controller).where(Controller.group_name == b.controller_group)).all()

                    await asyncio.gather(*[apply_preset_to_wled(t, target_preset) for t in targets])
                    
                    active_broadcast_state[b.id] = {
                        "item_index": next_idx,
                        "next_switch": now + asyncio.to_timedelta(seconds=target_item.duration_seconds)
                    }
        await asyncio.sleep(1)

async def broadcast_scheduler():
    while True:
        now = get_utc_now()
        cur_time = now.strftime("%H:%M")
        cur_day = str(now.weekday())
        
        with Session(engine) as session:
            schedules = session.exec(select(BroadcastSchedule).where(BroadcastSchedule.is_enabled == True)).all()
            for s in schedules:
                b = session.get(Broadcast, s.broadcast_id)
                if not b or cur_day not in s.days_of_week.split(","): continue
                
                # Midnight wraparound logic
                is_active = s.start_time <= cur_time < s.end_time if s.start_time <= s.end_time else cur_time >= s.start_time or cur_time < s.end_time
                
                if b.is_active != is_active:
                    b.is_active = is_active
                    if not is_active and b.id in active_broadcast_state:
                        del active_broadcast_state[b.id]
                    session.add(b)
                    session.commit()
        await asyncio.sleep(30)


# =========================================================
# REQUEST MODELS
# =========================================================

class GroupsCreate(BaseModel):
    group_name: str

class ControllerCreate(BaseModel):
    name: str
    ip_address: str
    location: str
    group_id: int
    main_brightness: int

class ControllerSegmentCreate(BaseModel):
    controller_id: int
    name: str
    segment_id: Optional[int] = None
    start_led: int
    stop_led: int
    reverse_direction: bool
    mirror_effect: bool
    offset: int
    grouping: int
    spacing: int
    seg_bri: int

class PresetCreate(BaseModel):
    name: str
    transition: int
    effect_id: int
    effect_speed: int
    effect_intensity: int
    palettes_id: int
    color1: str
    color2: str
    color3: str

class PlaylistCreate(BaseModel):
    name: str
    repeat_forever: bool

class PlaylistItemCreate(BaseModel):
    playlist_id: int
    preset_id: int
    sort_order: int
    duration_seconds: int

class BroadcastCreate(BaseModel):
    name: str
    playlist_id: int
    controller_id: int
    group_id: int
    is_active: bool

class BroadcastScheduleCreate(BaseModel):
    broadcast_id: int
    start_time: str
    end_time: str
    days_of_week: str
    is_enabled: bool

class PowerPayload(BaseModel):
    on: bool

class AppConfig(BaseModel):
    app_name: str
    copyright_name: str
    vite_app_host: str
    vite_app_port: int
    vite_api_host: str
    vite_api_port: int

class GroupRead(SQLModel):
    id: int
    group_name: str

class ControllerReadWithGroup(SQLModel):
    id: int
    name: str
    ip_address: str
    location: str
    group_id: Optional[int] = None
    group: Optional[GroupRead] = None
    main_brightness: int
    led_on: bool
    is_active: bool

class ControllerRead(SQLModel):
    id: int
    ip_address: str
    name: str
    location: str

class ControllerSegmentReadWithName(SQLModel):
    id: int
    name: str
    controller_id: int
    controller_name: ControllerRead | None = None
    segment_id: int
    start_led: int
    stop_led: int
    offset: int
    grouping: int
    spacing: int
    reverse_direction: bool
    mirror_effect: bool
    seg_bri: int

class PalettesCreate(SQLModel):
    palettes_id: int
    name: str

class PalettesRead(SQLModel):
    id: int
    palettes_id: int
    name: str

class EffectsCreate(SQLModel):
    id: int
    effect_id: int
    name: str

# =========================================================
# API ROUTES
# =========================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        if session.exec(select(WLEDEffects)).first() is None:
            for eff_id, name in WLED_EFFECTS.items():
                session.add(WLEDEffects(effect_id=eff_id, name=name))
        if session.exec(select(WLEDPalettes)).first() is None:
            for pal_id, name in WLED_PALETTES.items():
                session.add(WLEDPalettes(palettes_id=pal_id, name=name))
        session.commit()

    p_task = asyncio.create_task(playlist_runner())
    s_task = asyncio.create_task(broadcast_scheduler())
    yield
    p_task.cancel()
    s_task.cancel()
    await client.aclose()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True: await websocket.receive_text()
    except: manager.disconnect(websocket)

@app.post("/api/broadcasts/{b_id}/toggle")
async def toggle_broadcast(b_id: int, session: Session = Depends(get_session)):
    b = session.get(Broadcast, b_id)
    if not b: raise HTTPException(404)
    b.is_active = not b.is_active
    if not b.is_active and b_id in active_broadcast_state:
        del active_broadcast_state[b_id]
    session.add(b)
    session.commit()
    return {"is_active": b.is_active}

# (Existing Controller/Group/Dashboard routes go here...)

# =========================================================
# DASHBOARD
# =========================================================

@app.get("/api/dashboard")
def dashboard_data(session: Session = Depends(get_session)):
    statement = select(Controller).options(joinedload(Controller.group))
    controllers = session.exec(statement).all()

    return {
        "online": len([c for c in controllers if c.is_online]),
        "offline": len([c for c in controllers if not c.is_online]),
        "total": len(controllers),
        "controllers": controllers
    }

# =========================================================
# CONTROLLERS
# =========================================================

@app.get("/api/controllers", response_model=List[ControllerReadWithGroup])
def get_controllers(session: Session = Depends(get_session)):
    # Use selectinload or joinedload to include the group data
    statement = select(Controller).options(joinedload(Controller.group))
    
    result = session.exec(statement).all()

    if not result:
        raise HTTPException(status_code=404, detail="No controllers found!")
    
    return result

@app.post("/api/controllers")
async def add_controller(data: ControllerCreate):
    with Session(engine) as session:

        ctrl = Controller(
            name=data.name,
            ip_address=data.ip_address,
            location=data.location,
            group_id=data.group_id,
            main_brightness=data.main_brightness
        )

        session.add(ctrl)
        session.commit()
        session.refresh(ctrl)

    await manager.broadcast({
        "type": "controller_created",
        "data": ctrl.model_dump()
    })

    return ctrl

@app.put("/api/controllers/{ctrl_id}")
async def edit_controller(ctrl_id: int, data: ControllerCreate):
    with Session(engine) as session:
        db_ctrl = session.get(Controller, ctrl_id)
        if not db_ctrl:
            raise HTTPException(status_code=404, detail="Controller not found.")
        
        new_data = data.model_dump(exclude_unset=True)
        for key, value, in new_data.items():
            setattr(db_ctrl, key, value)

        session.add(db_ctrl)
        session.commit()
        session.refresh(db_ctrl)

    await manager.broadcast({
        "type": "controller_updated",
        "data": db_ctrl.model_dump()
    })

    return db_ctrl

@app.delete("/api/controllers/{ctrl_id}")
async def delete_controller(ctrl_id: int):
    with Session(engine) as session:
        ctrl = session.get(Controller, ctrl_id)
        if not ctrl:
            raise HTTPException(status_code=404, detail="Controller not found")

        session.delete(ctrl)
        session.commit()

    # 5. Broadcast the deletion
    await manager.broadcast({
        "type": "controller_deleted",
        "ctrl_id": ctrl_id
    })

    return {"status": "deleted"}

# =========================================================
# GROUPING
# =========================================================

@app.post("/api/groups")
def create_group(group_data: GroupsCreate, session: Session = Depends(get_session)):
    new_group = Groups.model_validate(group_data)
    try:

        session.add(new_group)
        session.commit()
        session.refresh(new_group)
        return new_group
    except IntegrityError as e:
        session.rollback()
        if "unique constraint" in str(e.orig).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A group with the name '{group_data.group_name}' already exist."
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database integrity error occured."
        )

@app.get("/api/groups", response_model=List[Groups])
def get_groups(session: Session = Depends(get_session)):
    # .all() is necessary to execute the query and return a list
    groups = session.exec(select(Groups)).all()
    return groups
    
@app.delete("/api/groups/{group_id}")
def delete_group(group_id: int, session: Session = Depends(get_session)):
    group = session.get(Groups, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    try:
        session.delete(group)
        session.commit()
    except IntegrityError as e:
        session.rollback()
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete group: There are still controllers assigned to it."
        )
    return {"status": "deleted"}

# =========================================================
# SEGMENTS
# =========================================================

@app.get("/api/segments", response_model=List[ControllerSegmentReadWithName])
def get_segments(session: Session = Depends(get_session)):
    # Use selectinload or joinedload to include the group data
    statement = select(ControllerSegment).options(joinedload(ControllerSegment.controller_name))
    return session.exec(statement).all()

@app.post("/api/segments")
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
            reverse_direction=data.reverse_direction,
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

@app.put("/api/segments/{seg_id}")
async def edit_segments(seg_id: int, data: ControllerSegmentCreate):
    with Session(engine) as session:
        db_seg = session.get(ControllerSegment, seg_id)
        if not db_seg:
            raise HTTPException(status_code=404, detail="Segment not found.")
        
        new_data = data.model_dump(exclude_unset=True)
        for key, value, in new_data.items():
            setattr(db_seg, key, value)

        session.add(db_seg)
        session.commit()
        session.refresh(db_seg)

    await manager.broadcast({
        "type": "segment_updated",
        "data": db_seg.model_dump()
    })

    return db_seg

@app.delete("/api/segments/{seg_id}")
async def delete_segment(seg_id: int):
    with Session(engine) as session:
        seg = session.get(ControllerSegment, seg_id)
        if not seg:
            raise HTTPException(status_code=404, detail="Segment not found")

        session.delete(seg)
        session.commit()

    # 5. Broadcast the deletion
    await manager.broadcast({
        "type": "segment_deleted",
        "ctrl_id": seg_id
    })

    return {"status": "deleted"}

# =========================================================
# PALETTES
# =========================================================

@app.get("/api/palettes", response_model=List[PalettesRead])
def get_palettes(session: Session = Depends(get_session)):
    palettes = session.exec(select(WLEDPalettes)).all()
    return palettes

@app.post("/api/palettes")
async def add_palettes(data: PalettesCreate):
    with Session(engine) as session:

        pal = PalettesCreate(
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

@app.put("/api/palettes/{pal_id}")
async def edit_palettes(pal_id: int, data: PalettesCreate):
    with Session(engine) as session:
        db_pal = session.get(WLEDPalettes, pal_id)
        if not db_pal:
            raise HTTPException(status_code=404, detail="Palette not found.")
        
        new_data = data.model_dump(exclude_unset=True)
        for key, value, in new_data.items():
            setattr(db_pal, key, value)

        session.add(db_pal)
        session.commit()
        session.refresh(db_pal)

    await manager.broadcast({
        "type": "palette_updated",
        "data": db_pal.model_dump()
    })

    return db_pal

@app.delete("/api/palettes/{pal_id}")
async def delete_palettes(pal_id: int):
    with Session(engine) as session:
        pal = session.get(WLEDPalettes, pal_id)
        if not pal:
            raise HTTPException(status_code=404, detail="Palette not found")

        session.delete(pal)
        session.commit()

    # 5. Broadcast the deletion
    await manager.broadcast({
        "type": "palette_deleted",
        "ctrl_id": pal_id
    })

    return {"status": "deleted"}

# =========================================================
# EFFECTS
# =========================================================

@app.get("/api/effects", response_model=List[EffectsCreate])
def get_effects(session: Session = Depends(get_session)):
    effects = session.exec(select(WLEDEffects)).all()
    return effects

@app.post("/api/effects")
async def add_effects(data: EffectsCreate):
    with Session(engine) as session:

        eff = EffectsCreate(
            name=data.name,
            effect_id=data.effect_id
        )

        session.add(eff)
        session.commit()
        session.refresh(eff)

    await manager.broadcast({
        "type": "effect_created",
        "data": eff.model_dump()
    })

    return eff

@app.put("/api/effects/{eff_id}")
async def edit_effects(eff_id: int, data: EffectsCreate):
    with Session(engine) as session:
        db_eff = session.get(WLEDEffects, eff_id)
        if not db_eff:
            raise HTTPException(status_code=404, detail="Effect not found.")
        
        new_data = data.model_dump(exclude_unset=True)
        for key, value, in new_data.items():
            setattr(db_eff, key, value)

        session.add(db_eff)
        session.commit()
        session.refresh(db_eff)

    await manager.broadcast({
        "type": "effect_updated",
        "data": db_eff.model_dump()
    })

    return db_eff

@app.delete("/api/effects/{eff_id}")
async def delete_effects(eff_id: int):
    with Session(engine) as session:
        eff = session.get(WLEDEffects, eff_id)
        if not eff:
            raise HTTPException(status_code=404, detail="Effect not found")

        session.delete(eff)
        session.commit()

    # 5. Broadcast the deletion
    await manager.broadcast({
        "type": "effect_deleted",
        "ctrl_id": eff_id
    })

    return {"status": "deleted"}

# =========================================================
# POWER CONTROL
# =========================================================

@app.post("/api/controllers/{ctrl_id}/toggle")
async def toggle_controller(ctrl_id: int, payload: PowerPayload):

    with Session(engine) as session:

        ctrl = session.get(Controller, ctrl_id)

        if not ctrl:
            raise HTTPException(status_code=404)

        await client.post(
            f"http://{ctrl.ip_address}/json/state",
            json={"on": payload.on}
        )

        ctrl.led_on = payload.on

        session.add(ctrl)
        session.commit()

    await manager.broadcast({
        "type": "power_toggle",
        "controller_id": ctrl_id,
        "on": payload.on
    })

    return {"status": "success"}

# =========================================================
# REBOOT
# =========================================================

@app.post("/api/controllers/reboot/{ctrl_id}")
async def reboot_controller(ctrl_id: int):

    with Session(engine) as session:

        ctrl = session.get(Controller, ctrl_id)

        if not ctrl:
            raise HTTPException(status_code=404)

        await client.post(
            f"http://{ctrl.ip_address}/json/state",
            json={"rb": True}
        )

    await manager.broadcast({
        "type": "controller_reboot",
        "controller_id": ctrl_id
    })

    return {"status": "rebooted"}


@app.post("/api/controllers/reboot-all")
async def reboot_all():

    with Session(engine) as session:

        controllers = session.exec(select(Controller)).all()

        for ctrl in controllers:
            try:
                await client.post(
                    f"http://{ctrl.ip_address}/json/state",
                    json={"rb": True}
                )
            except:
                pass

    await manager.broadcast({
        "type": "reboot_all"
    })

    return {"status": "success"}

# =========================================================
# QUERY
# =========================================================

@app.get("/api/query/{ip}")
async def query_controller(ip: str):

    try:
        response = await client.get(
            f"http://{ip}/json/info"
        )

        return response.json()

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

# =========================================================
# APP CONFIG
# =========================================================

@app.get("/api/config", response_model=AppConfig)
async def get_app_config():
    return {
        "app_name": os.getenv("APP_NAME", "WLED Controller"),
        "copyright_name": os.getenv("COPYRIGHT_NAME", "My Company"),
        "vite_app_host": os.getenv("VITE_APP_HOST", "0.0.0.0"),
        "vite_app_port": int(os.getenv("VITE_APP_PORT", 3030)),
        "vite_api_host": os.getenv("VITE_API_HOST", "localhost"),
        "vite_api_port": int(os.getenv("VITE_API_PORT", 8000))
    }

# =========================================================
# SERVER SETUP
# =========================================================

VITE_API_HOST = os.getenv("VITE_API_HOST", "127.0.0.1")
VITE_API_PORT = int(os.getenv("VITE_API_PORT", 8000))

if __name__ == "__old__":
    import uvicorn
    uvicorn.run(app, host=VITE_API_HOST, port=VITE_API_PORT)