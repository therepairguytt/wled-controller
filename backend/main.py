import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Session, select, text

from backend.database import engine
from backend.models import WLEDEffects, WLEDPalettes
from backend.wled_seed_data import WLED_EFFECTS, WLED_PALETTES
from backend.utils import manager
from backend.tasks import playlist_runner, broadcast_scheduler, controller_health_checker

from backend.routers import (
    controllers, groups, broadcasts, dashboard, segments,
    palettes, effects, functions, health, system, logs,
    presets, playlists, discovery, schedules
)

MIGRATIONS = [
    "ALTER TABLE broadcast ADD COLUMN IF NOT EXISTS controller_delay_ms INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE preset ADD COLUMN IF NOT EXISTS reverse_direction BOOLEAN NOT NULL DEFAULT 0",
    "ALTER TABLE preset ADD COLUMN IF NOT EXISTS custom1 INTEGER NOT NULL DEFAULT 128",
    "ALTER TABLE preset ADD COLUMN IF NOT EXISTS custom2 INTEGER NOT NULL DEFAULT 128",
    "ALTER TABLE preset ADD COLUMN IF NOT EXISTS custom3 INTEGER NOT NULL DEFAULT 16",
    "ALTER TABLE preset ADD COLUMN IF NOT EXISTS cct INTEGER NOT NULL DEFAULT 127",
    "ALTER TABLE preset ADD COLUMN IF NOT EXISTS freeze BOOLEAN NOT NULL DEFAULT 0",
    "ALTER TABLE preset ADD COLUMN IF NOT EXISTS blend_mode INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE controllersegment ADD COLUMN IF NOT EXISTS freeze BOOLEAN NOT NULL DEFAULT 0",
    "ALTER TABLE controllersegment ADD COLUMN IF NOT EXISTS blend_mode INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE controllersegment ADD COLUMN IF NOT EXISTS cct INTEGER NOT NULL DEFAULT 127",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.create_all(engine)

    # ── Safe column migrations (add any new columns that may not exist yet) ──
    with engine.connect() as conn:
        for sql in MIGRATIONS:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                # Fallback for SQLite syntax without IF NOT EXISTS or column already exists
                try:
                    sqlite_sql = sql.replace(" IF NOT EXISTS", "")
                    conn.execute(text(sqlite_sql))
                    conn.commit()
                except Exception:
                    pass

    # ── Seed / upgrade WLED 0.16.1 Effects and Palettes ──
    with Session(engine) as session:
        existing_effects = {e.effect_id: e for e in session.exec(select(WLEDEffects)).all()}
        for eff_id, name in WLED_EFFECTS.items():
            if eff_id not in existing_effects:
                session.add(WLEDEffects(effect_id=eff_id, name=name))
            elif existing_effects[eff_id].name == "RSVD" and name != "RSVD":
                existing_effects[eff_id].name = name
                session.add(existing_effects[eff_id])

        existing_palettes = {p.palettes_id: p for p in session.exec(select(WLEDPalettes)).all()}
        for pal_id, name in WLED_PALETTES.items():
            if pal_id not in existing_palettes:
                session.add(WLEDPalettes(palettes_id=pal_id, name=name))

        session.commit()

    p_task = asyncio.create_task(playlist_runner())
    s_task = asyncio.create_task(broadcast_scheduler())
    h_task = asyncio.create_task(controller_health_checker())
    yield
    p_task.cancel()
    s_task.cancel()
    h_task.cancel()


app = FastAPI(title="WLED Controller API (WLED 0.16.1)", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        manager.disconnect(websocket)


# Include Routers
app.include_router(controllers.router)
app.include_router(groups.router)
app.include_router(broadcasts.router)
app.include_router(schedules.router)
app.include_router(dashboard.router)
app.include_router(functions.router)
app.include_router(segments.router)
app.include_router(palettes.router)
app.include_router(effects.router)
app.include_router(health.router)
app.include_router(system.router)
app.include_router(logs.router)
app.include_router(presets.router)
app.include_router(playlists.router)
app.include_router(discovery.router)

VITE_API_HOST = os.getenv("VITE_API_HOST", "127.0.0.1")
VITE_API_PORT = int(os.getenv("VITE_API_PORT", 8000))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=VITE_API_HOST, port=VITE_API_PORT, reload=True)
