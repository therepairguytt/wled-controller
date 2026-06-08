from typing import Optional, List
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field, Relationship
from pydantic import BaseModel

def get_utc_now():
    return datetime.now(timezone.utc)

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
    reverse_direction: bool = False
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
    items: list["PlaylistItem"] = Relationship(back_populates="playlist", cascade_delete=True)
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
    
    playlist: Optional["Playlist"] = Relationship(back_populates="items")
    preset: Optional["Preset"] = Relationship()

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
    controller_delay_ms: int = Field(default=0)  # delay between each controller send (ms)
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

# --- Pydantic Models for Requests ---

class GroupsCreate(BaseModel):
    group_name: str

class ControllerCreate(BaseModel):
    name: str
    ip_address: str
    location: str
    group_id: int
    main_brightness: int
    is_active: bool
    led_on: bool

class ControllerSegmentCreate(BaseModel):
    controller_id: int
    name: str
    segment_id: Optional[int] = None
    start_led: int
    stop_led: int
    offset: int
    grouping: int
    spacing: int
    reverse_direction: bool
    mirror_effect: bool
    seg_bri: int

class PresetCreate(BaseModel):
    name: str
    transition: int
    effect_id: int
    effect_speed: int
    effect_intensity: int
    reverse_direction: bool
    palette_id: int
    color1: str
    color2: str
    color3: str

class PlaylistCreate(BaseModel):
    name: str
    repeat_forever: bool

class PlaylistItemCreate(BaseModel):
    preset_id: int
    sort_order: int
    duration_seconds: int

class BroadcastCreate(BaseModel):
    name: str
    playlist_id: int
    controller_id: Optional[int] = None
    group_id: Optional[int] = None
    is_active: bool = True
    controller_delay_ms: int = 0

class BroadcastRead(BaseModel):
    id: int
    name: str
    playlist_id: int
    controller_id: Optional[int] = None
    group_id: Optional[int] = None
    is_active: bool
    controller_delay_ms: int
    playlist_name: Optional[str] = None
    target_name: Optional[str] = None
    target_type: Optional[str] = None  # "controller" | "group" | "all"

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

class DashboardControllerWithGroup(SQLModel):
    online: int
    offline: int
    total: int
    controllers: List[ControllerReadWithGroup]

class ControllerRead(SQLModel):
    id: int
    ip_address: str
    name: str
    location: str

class ControllerSegmentReadWithName(SQLModel):
    id: int
    name: str
    controller_id: Optional[int] = None
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
    effect_id: int
    name: str

class EffectsRead(SQLModel):
    id: int
    effect_id: int
    name: str

class SystemLog(SQLModel, table=True):
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    level: str = Field(default="INFO")          # INFO | WARN | ERROR | SUCCESS
    category: str                                # controller | group | segment | power | system
    action: str                                  # created | updated | deleted | online | offline | toggled | rebooted
    message: str
    target_id: Optional[int] = Field(default=None)   # id of the affected entity
    target_name: Optional[str] = Field(default=None) # human-readable name
    created_on: datetime = Field(default_factory=get_utc_now, nullable=False)

class LogRead(SQLModel):
    id: int
    level: str
    category: str
    action: str
    message: str
    target_id: Optional[int] = None
    target_name: Optional[str] = None
    created_on: datetime

class PresetRead(SQLModel):
    id: int
    name: str
    is_on: bool
    transition: int
    effect_id: int
    effect_speed: int
    effect_intensity: int
    reverse_direction: bool
    palette_id: int
    color1: str
    color2: str
    color3: str

class PlaylistItemReadWithPreset(SQLModel):
    id: int
    playlist_id: int
    preset_id: int
    sort_order: int
    duration_seconds: int
    preset: Optional[PresetRead] = None

class PlaylistReadWithItems(SQLModel):
    id: int
    name: str
    repeat_forever: bool
    items: List[PlaylistItemReadWithPreset] = []
