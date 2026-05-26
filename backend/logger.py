"""
Centralised logging utility.
Call `write_log(...)` from any router or task to persist a system event.
"""

from backend.database import engine
from backend.models import SystemLog
from sqlmodel import Session


def write_log(
    message: str,
    category: str,
    action: str,
    level: str = "INFO",
    target_id: int | None = None,
    target_name: str | None = None,
) -> None:
    """Write a single log entry to the database (synchronous, fire-and-forget)."""
    try:
        with Session(engine) as session:
            entry = SystemLog(
                level=level,
                category=category,
                action=action,
                message=message,
                target_id=target_id,
                target_name=target_name,
            )
            session.add(entry)
            session.commit()
    except Exception as e:
        # Never let logging crash the app
        print(f"[Logger] Failed to write log: {e}")
