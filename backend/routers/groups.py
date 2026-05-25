from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from sqlalchemy.exc import IntegrityError
from backend.database import get_session
from backend.models import Groups, GroupsCreate, GroupRead

router = APIRouter(prefix="/api/groups", tags=["groups"])

@router.get("", response_model=List[GroupRead])
def get_groups(session: Session = Depends(get_session)):
    groups = session.exec(select(Groups)).all()
    return groups

@router.post("", response_model=GroupRead, status_code=status.HTTP_201_CREATED)
def create_group(group_data: GroupsCreate, session: Session = Depends(get_session)):
    new_group = Groups(
        group_name=group_data.group_name
    )
    try:
        session.add(new_group)
        session.commit()
        session.refresh(new_group)
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

@router.delete("/{group_id}", status_code=status.HTTP_200_OK)
def delete_group(group_id: int, session: Session = Depends(get_session)):
    group = session.get(Groups, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Group not found"
        )
    
    try:
        session.delete(group)
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Cannot delete group: There are still controllers assigned to it."
        )
        
    return {"status": "deleted"}