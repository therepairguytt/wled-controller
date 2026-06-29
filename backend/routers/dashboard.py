from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from sqlalchemy.orm import joinedload
from backend.database import get_session
from backend.models import Controller, DashboardControllerWithGroup
from backend.utils import wled_live_data

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("", response_model=DashboardControllerWithGroup)
def dashboard_data(session: Session = Depends(get_session)):
    statement = select(Controller).options(joinedload(Controller.group))
    controllers = session.exec(statement).all()

    response_controllers = []
    for c in controllers:
        c_dict = c.model_dump()
        c_dict["group"] = c.group
        c_dict["live_data"] = wled_live_data.get(c.id, {})
        response_controllers.append(c_dict)

    return {
        "controllers": response_controllers,
        "online": len([c for c in controllers if c.is_online]),
        "offline": len([c for c in controllers if not c.is_online]),
        "total": len(controllers)
        
    }
