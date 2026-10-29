import asyncio
import websockets
import json
from fastapi import APIRouter, HTTPException
from sqlmodel import Session, select
from backend.database import engine
from backend.models import Controller, PowerPayload
from backend.utils import manager
from backend.logger import write_log

router = APIRouter(prefix="/api", tags=["functions"])


@router.post("/controllers/{ctrl_id}/toggle")
async def toggle_controller(ctrl_id: int, payload: PowerPayload):
    with Session(engine) as session:
        ctrl = session.get(Controller, ctrl_id)
        if not ctrl:
            raise HTTPException(status_code=404, detail="Controller not found")

        try:
            async with websockets.connect(
                f"ws://{ctrl.ip_address}/ws",
                open_timeout=3,
                close_timeout=2,
            ) as ws:
                await ws.send(json.dumps({"on": payload.on}))
        except Exception as e:
            print(f"Failed to toggle {ctrl.name}: {e}")

        ctrl.led_on = payload.on
        session.add(ctrl)
        session.commit()
        ctrl_name = ctrl.name
        ctrl_ip = ctrl.ip_address

    write_log(
        message=f"Controller '{ctrl_name}' ({ctrl_ip}) power {'ON' if payload.on else 'OFF'}.",
        category="power", action="toggled", level="INFO",
        target_id=ctrl_id, target_name=ctrl_name
    )
    await manager.broadcast({"type": "power_toggle", "controller_id": ctrl_id, "on": payload.on})
    return {"status": "success"}


@router.post("/reboot/{ctrl_id}")
async def reboot_controller(ctrl_id: int):
    with Session(engine) as session:
        ctrl = session.get(Controller, ctrl_id)
        if not ctrl:
            raise HTTPException(status_code=404, detail="Controller not found")
        ctrl_name = ctrl.name
        ctrl_ip = ctrl.ip_address

    try:
        async with websockets.connect(
            f"ws://{ctrl_ip}/ws",
            open_timeout=3,
            close_timeout=2,
        ) as ws:
            await ws.send(json.dumps({"rb": True}))
    except Exception as e:
        print(f"Failed to reboot {ctrl_name}: {e}")

    write_log(
        message=f"Controller '{ctrl_name}' ({ctrl_ip}) was rebooted.",
        category="power", action="rebooted", level="WARN",
        target_id=ctrl_id, target_name=ctrl_name
    )
    await manager.broadcast({"type": "controller_reboot", "controller_id": ctrl_id})
    return {"status": "rebooted"}


@router.post("/controllers/reboot-all")
async def reboot_all():
    with Session(engine) as session:
        controllers = session.exec(select(Controller)).all()
        ips = [c.ip_address for c in controllers]

    async def _reboot_ip(ip: str):
        try:
            async with websockets.connect(
                f"ws://{ip}/ws",
                open_timeout=3,
                close_timeout=2,
            ) as ws:
                await ws.send(json.dumps({"rb": True}))
        except Exception as e:
            print(f"Failed to reboot {ip}: {e}")

    if ips:
        await asyncio.gather(*[_reboot_ip(ip) for ip in ips])

    write_log(
        message=f"All controllers ({len(ips)}) were rebooted.",
        category="power", action="rebooted", level="WARN"
    )
    await manager.broadcast({"type": "reboot_all"})
    return {"status": "success", "count": len(ips)}
