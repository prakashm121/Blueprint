from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.api import deps
from app.db.session import get_db
from app.models.user import User

router = APIRouter()

class ProfileResponse(BaseModel):
    id: int
    user_id: int
    full_name: Optional[str]
    phone_number: Optional[str]
    college_name: Optional[str]
    degree: Optional[str]
    specialization: Optional[str]
    graduation_year: Optional[int]
    cgpa: Optional[float]
    linkedin_url: Optional[str]
    github_username: Optional[str]
    avatar_url: Optional[str]
    bio: Optional[str]

    class Config:
        from_attributes = True

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    college_name: Optional[str] = None
    degree: Optional[str] = None
    specialization: Optional[str] = None
    graduation_year: Optional[int] = None
    cgpa: Optional[float] = None
    linkedin_url: Optional[str] = None
    github_username: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None

@router.get("/", response_model=ProfileResponse)
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    profile = current_user.profile
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

@router.patch("/", response_model=ProfileResponse)
def update_profile(
    profile_in: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    profile = current_user.profile
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    update_data = profile_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    if profile.college_name and current_user.onboarding_step == "profile":
        current_user.onboarding_step = "assessment"
        
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile
