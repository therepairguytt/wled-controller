import os
from fastapi import APIRouter, HTTPException
from sqlmodel import Session, select
from backend.database import engine
from backend.models import Controller, PowerPayload, AppConfig
from backend.utils import manager, client

router = APIRouter(prefix="/api", tags=["functions"])

# Toggle led lights on and off per controller
@router.post("/controllers/{ctrl_id}/toggle")
async def toggle_controller(ctrl_id: int, payload: PowerPayload):
    with Session(engine) as session:
        ctrl = session.get(Controller, ctrl_id)
        if not ctrl:
            raise HTTPException(status_code=404)

        try:
            await client.post(
                f"http://{ctrl.ip_address}/json/state",
                json={"on": payload.on}
            )
        except Exception as e:
            print(f"Failed to toggle {ctrl.name}: {e}")

        ctrl.led_on = payload.on
        session.add(ctrl)
        session.commit()

    await manager.broadcast({
        "type": "power_toggle",
        "controller_id": ctrl_id,
        "on": payload.on
    })
    return {"status": "success"}

# Reboot endpoint for rebooting one controller
@router.post("/reboot/{ctrl_id}")
async def reboot_controller(ctrl_id: int):
    with Session(engine) as session:
        ctrl = session.get(Controller, ctrl_id)
        if not ctrl:
            raise HTTPException(status_code=404)

        try:
            await client.post(
                f"http://{ctrl.ip_address}/json/state",
                json={"rb": True}
            )
        except Exception as e:
            print(f"Failed to reboot {ctrl.name}: {e}")

    await manager.broadcast({
        "type": "controller_reboot",
        "controller_id": ctrl_id
    })
    return {"status": "rebooted"}

# Query controllers based on IP and return JSON
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

# Get App Metadata and server host config from env file
@router.get("/config", response_model=AppConfig)
async def get_app_config():
    return {
        "app_name": os.getenv("APP_NAME", "WLED Controller"),
        "copyright_name": os.getenv("COPYRIGHT_NAME", "My Company"),
        "vite_app_host": os.getenv("VITE_APP_HOST", "0.0.0.0"),
        "vite_app_port": int(os.getenv("VITE_APP_PORT", 3030)),
        "vite_api_host": os.getenv("VITE_API_HOST", "localhost"),
        "vite_api_port": int(os.getenv("VITE_API_PORT", 8000))
    }

# Reboot all controllers at once
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