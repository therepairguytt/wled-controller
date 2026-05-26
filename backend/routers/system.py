import os
from fastapi import APIRouter, HTTPException
from sqlmodel import Session, select
from backend.database import engine
import websockets
import json
from backend.models import Controller, AppConfig
from backend.utils import manager

router = APIRouter(prefix="/api", tags=["system"])

@router.get("/query/{ip}")
async def query_controller(ip: str):
    try:
        async with websockets.connect(f"ws://{ip}/ws") as ws:
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
        "app_name": os.getenv("VITE_APP_NAME", "WLED Controller"),
        "copyright_name": os.getenv("COPYRIGHT_NAME", "My Company"),
        "vite_app_host": os.getenv("VITE_APP_HOST", "0.0.0.0"),
        "vite_app_port": int(os.getenv("VITE_APP_PORT", 3030)),
        "vite_api_host": os.getenv("VITE_API_HOST", "localhost"),
        "vite_api_port": int(os.getenv("VITE_API_PORT", 8000))
    }
