from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from sqlalchemy.exc import IntegrityError
from backend.database import engine, get_session
from backend.models import Groups, GroupsCreate, GroupRead
from backend.utils import manager
from backend.logger import write_log

router = APIRouter(prefix="/api/groups", tags=["groups"])

@router.get("", response_model=List[GroupRead])
def get_groups(session: Session = Depends(get_session)):
    groups = session.exec(select(Groups)).all()
    return groups

@router.post("", response_model=GroupsCreate, status_code=status.HTTP_201_CREATED)
def create_group(group_data: GroupsCreate, session: Session = Depends(get_session)):
    new_group = Groups(
        group_name=group_data.group_name
    )
    try:
        session.add(new_group)
        session.commit()
        session.refresh(new_group)
        write_log(
            message=f"Group '{new_group.group_name}' was created.",
            category="group", action="created", level="SUCCESS",
            target_id=new_group.id, target_name=new_group.group_name
        )
        return new_group
    except IntegrityError as e:
        session.rollback()
        # Fallback check for different DB driver error signatures
        if "unique constraint" in str(e.orig).lower() or "duplicate key" in str(e.orig).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A group with the name '{group_data.group_name}' already exists."
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database integrity error occurred."
        )
    
@router.put("/{group_id}", status_code=status.HTTP_200_OK)
async def edit_groups(group_id: int, data: GroupRead):
    with Session(engine) as session:
        edit_group = session.get(Groups, group_id)
        if not edit_group:
            raise HTTPException(status_code=404, detail="Group not found in database")
        
        new_data = data.model_dump(exclude_unset=True)
        for key, value in new_data.items():
            setattr(edit_group, key, value)

        session.add(edit_group)
        session.commit()
        session.refresh(edit_group)

    write_log(
        message=f"Group '{edit_group.group_name}' was updated.",
        category="group", action="updated", level="INFO",
        target_id=edit_group.id, target_name=edit_group.group_name
    )
    await manager.broadcast({"type": "group_updated", "data": edit_group.model_dump()})
    return edit_group

@router.delete("/{group_id}", status_code=status.HTTP_200_OK)
def delete_group(group_id: int, session: Session = Depends(get_session)):
    group = session.get(Groups, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Group not found"
        )
    
    try:
        group_name = group.group_name
        group_id_val = group.id
        session.delete(group)
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete group: There are still controllers assigned to it."
        )

    write_log(
        message=f"Group '{group_name}' was deleted.",
        category="group", action="deleted", level="WARN",
        target_id=group_id_val, target_name=group_name
    )
    return {"status": "deleted"}