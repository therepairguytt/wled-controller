import asyncio
import httpx
from typing import List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy.orm import joinedload
from backend.database import engine, get_session
from backend.models import Controller, ControllerReadWithGroup, ControllerCreate, PowerPayload
from backend.utils import manager
from backend.logger import write_log

router = APIRouter(prefix="/api/controllers", tags=["controllers"])

@router.get("", response_model=List[ControllerReadWithGroup])
def get_controllers(session: Session = Depends(get_session)):
    statement = select(Controller).options(joinedload(Controller.group))
    result = session.exec(statement).all()

    if not result:
        raise HTTPException(status_code=204, detail="No controllers found!")
    
    return result

@router.post("")
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

    write_log(
        message=f"Controller '{ctrl.name}' ({ctrl.ip_address}) was created.",
        category="controller", action="created", level="SUCCESS",
        target_id=ctrl.id, target_name=ctrl.name
    )
    await manager.broadcast({"type": "controller_created", "data": ctrl.model_dump()})
    return ctrl

@router.put("/{ctrl_id}")
async def edit_controller(ctrl_id: int, data: ControllerCreate):
    with Session(engine) as session:
        db_ctrl = session.get(Controller, ctrl_id)
        if not db_ctrl:
            raise HTTPException(status_code=404, detail="Controller not found.")
        
        new_data = data.model_dump(exclude_unset=True)
        for key, value in new_data.items():
            setattr(db_ctrl, key, value)

        session.add(db_ctrl)
        session.commit()
        session.refresh(db_ctrl)

    write_log(
        message=f"Controller '{db_ctrl.name}' ({db_ctrl.ip_address}) was updated.",
        category="controller", action="updated", level="INFO",
        target_id=db_ctrl.id, target_name=db_ctrl.name
    )
    await manager.broadcast({"type": "controller_updated", "data": db_ctrl.model_dump()})
    return db_ctrl

@router.delete("/{ctrl_id}")
async def delete_controller(ctrl_id: int):
    with Session(engine) as session:
        ctrl = session.get(Controller, ctrl_id)
        if not ctrl:
            raise HTTPException(status_code=404, detail="Controller not found")

        ctrl_name = ctrl.name
        ctrl_ip = ctrl.ip_address
        session.delete(ctrl)
        session.commit()

    write_log(
        message=f"Controller '{ctrl_name}' ({ctrl_ip}) was deleted.",
        category="controller", action="deleted", level="WARN",
        target_id=ctrl_id, target_name=ctrl_name
    )
    await manager.broadcast({"type": "controller_deleted", "ctrl_id": ctrl_id})
    return {"status": "deleted"}

class MasterPowerRequest(BaseModel):
    on: bool

@router.post("/master-power")
async def master_power(req: MasterPowerRequest):
    with Session(engine) as session:
        controllers = session.exec(select(Controller).where(Controller.is_online == True)).all()
        
        async def toggle_one(c):
            try:
                async with httpx.AsyncClient() as client:
                    await client.post(
                        f"http://{c.ip_address}/json/state",
                        json={"on": req.on},
                        timeout=2.0
                    )
            except Exception as e:
                pass

        await asyncio.gather(*[toggle_one(c) for c in controllers])
        
        for c in controllers:
            c.led_on = req.on
            session.add(c)
        session.commit()
        
    write_log(
        message=f"Master Power set to {'ON' if req.on else 'OFF'}.",
        category="controller", action="master_power", level="INFO",
        target_id=0, target_name="All Controllers"
    )
    await manager.broadcast({"type": "master_power_toggle", "on": req.on})
    return {"status": "success"}