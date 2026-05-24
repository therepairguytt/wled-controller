import asyncio
from contextlib import asynccontextmanager
from typing import Optional, List

import httpx
from fastapi import FastAPI, HTTPException, WebSocket, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import SQLModel, Field, Session, create_engine, select
from datetime import datetime, timezone
from typing import Optional

def get_utc_now():
    return datetime.now(timezone.utc)

# =========================================================
# DATABASE
# =========================================================

from sqlmodel import create_engine
from urllib.parse import quote_plus

DB_USER = "wled"
DB_PASSWORD = "597868@Arc"
DB_HOST = "192.168.104.211"
DB_NAME = "wled_new"

password = quote_plus(DB_PASSWORD)

DATABASE_URL = (
    f"postgresql://"
    f"{DB_USER}:"
    f"{password}@"
    f"{DB_HOST}/"
    f"{DB_NAME}"
)

engine = create_engine(
    DATABASE_URL,
    echo=True
)
#DATABASE_URL = "postgresql://wled:597868@Arc@localhost/wled"
#
#engine = create_engine(
#    DATABASE_URL,
#    echo=False
#)

# =========================================================
# MODELS
# =========================================================

class Controller(SQLModel, table=True):
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = Field(default=None, primary_key=True)

    name: str
    ip_address: str
    location: str

    group_name: str = "Default"

    main_brightness: int = 128

    is_active: bool = True
    is_online: bool = False

    led_on: bool = True

    current_playlist_id: Optional[int] = None

    created_on: datetime = Field(
        default_factory=get_utc_now,
        nullable=False
    )

    modified_on: datetime = Field(
        default_factory=get_utc_now,
        sa_column_kwargs={"onupdate": get_utc_now},
        nullable=False
    )


class ControllerSegment(SQLModel, table=True):
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = Field(default=None, primary_key=True)

    controller_id: int

    segment_id: int = 0

    start_led: int
    stop_led: int

    offset: int = 0
    grouping: int = 1
    spacing: int = 0

    reverse_direction: bool = False
    mirror_effect: bool = False

    brightness: int = 255

    created_on: datetime = Field(
        default_factory=get_utc_now,
        nullable=False
    )

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

    reverse: bool = False

    color_temp: int = 128

    custom1: int = 0
    custom2: int = 0
    custom3: int = 0

    color1: str = "#FF0000"
    color2: str = "#00FF00"
    color3: str = "#0000FF"

    created_on: datetime = Field(
        default_factory=get_utc_now,
        nullable=False
    )

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

    created_on: datetime = Field(
        default_factory=get_utc_now,
        nullable=False
    )

    modified_on: datetime = Field(
        default_factory=get_utc_now,
        sa_column_kwargs={"onupdate": get_utc_now},
        nullable=False
    )


class PlaylistItem(SQLModel, table=True):
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = Field(default=None, primary_key=True)

    playlist_id: int

    preset_id: int

    sort_order: int

    duration_seconds: int = 10

    created_on: datetime = Field(
        default_factory=get_utc_now,
        nullable=False
    )

    modified_on: datetime = Field(
        default_factory=get_utc_now,
        sa_column_kwargs={"onupdate": get_utc_now},
        nullable=False
    )


class Broadcast(SQLModel, table=True):
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = Field(default=None, primary_key=True)

    name: str

    playlist_id: int

    controller_id: Optional[int] = None

    controller_group: Optional[str] = None

    is_active: bool = True

    created_on: datetime = Field(
        default_factory=get_utc_now,
        nullable=False
    )

    modified_on: datetime = Field(
        default_factory=get_utc_now,
        sa_column_kwargs={"onupdate": get_utc_now},
        nullable=False
    )


class Groups(SQLModel, table=True):
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = Field(default=None, primary_key=True)

    group_name: str

    created_on: datetime = Field(
        default_factory=get_utc_now,
        nullable=False
    )

    modified_on: datetime = Field(
        default_factory=get_utc_now,
        sa_column_kwargs={"onupdate": get_utc_now},
        nullable=False
    )

# =========================================================
# REQUEST MODELS
# =========================================================

class ControllerCreate(BaseModel):
    name: str
    ip_address: str
    location: str
    group_name: str
    main_brightness: int

class GroupsCreate(BaseModel):
    group_name: str


class PowerPayload(BaseModel):
    on: bool

# =========================================================
# WEBSOCKET MANAGER
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
        disconnected = []

        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                disconnected.append(connection)

        for d in disconnected:
            self.disconnect(d)

manager = ConnectionManager()

# =========================================================
# FASTAPI
# =========================================================

@asynccontextmanager
async def lifespan(app):
    SQLModel.metadata.create_all(engine)
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = httpx.AsyncClient(timeout=3.0)

# =========================================================
# WEBSOCKET
# =========================================================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)

    try:
        while True:
            await websocket.receive_text()

    except:
        manager.disconnect(websocket)

# =========================================================
# DASHBOARD
# =========================================================

@app.get("/api/dashboard")
def dashboard_data():
    with Session(engine) as session:
        controllers = session.exec(select(Controller)).all()

        return {
            "online": len([x for x in controllers if x.is_online]),
            "offline": len([x for x in controllers if not x.is_online]),
            "total": len(controllers),
            "controllers": controllers
        }

# =========================================================
# CONTROLLERS
# =========================================================

@app.get("/api/controllers")
def list_controllers():
    with Session(engine) as session:
        return session.exec(select(Controller)).all()


@app.post("/api/controllers")
async def add_controller(data: ControllerCreate):
    with Session(engine) as session:

        ctrl = Controller(
            name=data.name,
            ip_address=data.ip_address,
            location=data.location,
            group_name=data.group_name,
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


@app.delete("/api/controllers/{ctrl_id}")
def delete_controller(ctrl_id: int):
    with Session(engine) as session:

        ctrl = session.get(Controller, ctrl_id)

        if not ctrl:
            raise HTTPException(status_code=404)

        session.delete(ctrl)
        session.commit()

    return {"status": "deleted"}

# =========================================================
# GROUPING
# =========================================================

def get_session():
    with Session(engine) as session:
        yield session

@app.post("/api/groups")
def create_group(group_data: GroupsCreate, session: Session = Depends(get_session)):

    new_group = Groups(
        group_name=group_data.group_name
    )

    session.add(new_group)
    session.commit()
    session.refresh(new_group)
    return new_group

@app.get("/api/groups/list")
def groups_data():
    with Session(engine) as session:
        groups = session.exec(select(Groups)).all()

        return {
            "id": len([x for x in groups]),
            "group_name": len([x for x in groups]),
            "groups": groups
        }
    
@app.delete("/api/groups/{group_id}")
def delete_group(group_id: int, session: Session = Depends(get_session)):
    # Look for the group in the database
    group = session.get(Groups, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Delete and commit
    session.delete(group)
    session.commit()
    return {"message": "Group deleted successfully"}

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

@app.post("/api/controllers/{ctrl_id}/reboot")
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
# MAIN
# =========================================================

if __name__ == "__old__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000
    )