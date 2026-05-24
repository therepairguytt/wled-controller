import os
from fastapi import APIRouter, HTTPException
from sqlmodel import Session, select
from backend.database import engine
from backend.models import Controller, AppConfig
from backend.utils import client, manager

router = APIRouter(prefix="/api", tags=["system"])

@router.get("/query/{ip}")
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

@router.post("/controllers/reboot-all")
async def reboot_all():
    with Session(engine) as session:
        controllers = session.exec(select(Controller)).all()
        for ctrl in controllers:
            try:
                await client.post(
                    f"http://{ctrl.ip_address}/json/state",
                    json={"rb": True}
                )
            except Exception as e:
                print(f"Failed to reboot {ctrl.ip_address}: {e}")

    await manager.broadcast({
        "type": "reboot_all"
    })
    return {"status": "success"}
