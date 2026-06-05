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

from backend.routers import controllers, groups, broadcasts, dashboard, segments, palettes, effects, functions, health, system, logs, presets, playlists

@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.create_all(engine)

    # ── Safe column migrations (add any new columns that may not exist yet) ──
    with engine.connect() as conn:
        # broadcast.controller_delay_ms (added in v26.6)
        try:
            conn.execute(text(
                "ALTER TABLE broadcast ADD COLUMN IF NOT EXISTS controller_delay_ms INTEGER NOT NULL DEFAULT 0"
            ))
            conn.commit()
        except Exception:
            pass  # SQLite fallback or column already exists

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
    h_task = asyncio.create_task(controller_health_checker())
    yield
    p_task.cancel()
    s_task.cancel()
    h_task.cancel()

app = FastAPI(lifespan=lifespan)
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
    except:
        manager.disconnect(websocket)

# Include Routers
app.include_router(controllers.router)
app.include_router(groups.router)
app.include_router(broadcasts.router)
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

VITE_API_HOST = os.getenv("VITE_API_HOST", "127.0.0.1")
VITE_API_PORT = int(os.getenv("VITE_API_PORT", 8000))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=VITE_API_HOST, port=VITE_API_PORT, reload=True)
