import os
import json
import httpx
import websockets
from fastapi import APIRouter, HTTPException
from backend.models import AppConfig
from backend.wled_seed_data import WLED_BLEND_MODES

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/query/{ip}")
async def query_controller(ip: str):
    """Query a WLED v0.16.1 controller via HTTP /json (with WebSocket fallback)."""
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            res = await client.get(f"http://{ip}/json")
            if res.status_code == 200:
                return res.json()
    except Exception:
        pass

    try:
        async with websockets.connect(
            f"ws://{ip}/ws",
            open_timeout=4,
            close_timeout=2,
        ) as ws:
            await ws.send(json.dumps({"v": True}))
            response = await ws.recv()
            return json.loads(response)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.get("/config", response_model=AppConfig)
async def get_app_config():
    return {
        "app_name": os.getenv("VITE_APP_NAME") or os.getenv("APP_NAME", "WLED Controller"),
        "copyright_name": os.getenv("COPYRIGHT_NAME", "My Company"),
        "vite_app_host": os.getenv("VITE_APP_HOST", "0.0.0.0"),
        "vite_app_port": int(os.getenv("VITE_APP_PORT", 3030)),
        "vite_api_host": os.getenv("VITE_API_HOST", "localhost"),
        "vite_api_port": int(os.getenv("VITE_API_PORT", 8000)),
        "wled_target_version": "0.16.1",
    }


@router.get("/blend-modes")
async def get_blend_modes():
    return [{"id": k, "name": v} for k, v in WLED_BLEND_MODES.items()]
