from datetime import timedelta
from sqlalchemy.exc import IntegrityError
from fastapi import APIRouter, Depends, HTTPException, status

from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.core import security
from app.db.session import get_db
from app.models.user import User
from app.models.profile import Profile
from app.core.config import settings
from app.api import deps
from app.services.verification_service import create_verification_record, verify_email_token
from app.workers.outbox import enqueue_outbox
from app.workers import event_types as ET

router = APIRouter()

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str | None = None
    is_active: bool
    email_verified: bool = False
    onboarding_step: str = "profile"
    onboarding_completed: bool = False

    class Config:
        from_attributes = True

class RegisterResponse(BaseModel):
    user_id: int
    email: str
    email_verified: bool
    message: str

class Token(BaseModel):
    access_token: str
    token_type: str

class LoginData(BaseModel):
    email: EmailStr
    password: str

class ResendRequest(BaseModel):
    email: EmailStr

def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        email_verified=bool(user.email_verified),
        onboarding_step=user.onboarding_step,
        onboarding_completed=user.onboarding_step == "completed",
    )

def _queue_verification_email(db: Session, user: User) -> None:
    # DO NOT trigger lazy loading (force safe value)
    name = getattr(user, "full_name", None)

    # create token record (keep it minimal)
    raw_token = create_verification_record(db, user)

    # IMPORTANT: no extra queries, no relationship access
    enqueue_outbox(
        db,
        ET.EMAIL_VERIFICATION,
        {
            "user_id": user.id,
            "email": user.email,
            "full_name": name,
            "raw_token": raw_token,
        },
        idempotency_key=f"email-verify:{user.id}:{raw_token[:8]}",
    )

@router.post("/register", status_code=201, response_model=RegisterResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    # Race-safe: do both (pre-check + UNIQUE constraint fallback)
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    try:
        user = User(
            email=user_in.email,
            hashed_password=security.get_password_hash(user_in.password),
            full_name=user_in.full_name,
            email_verified=False,
        )

        db.add(user)
        db.flush()  # get user.id

        profile = Profile(
            user_id=user.id,
            full_name=user.full_name,
        )
        db.add(profile)

        _queue_verification_email(db, user)

        db.commit()
        db.refresh(user)

    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="User already exists")

    return RegisterResponse(
        user_id=user.id,
        email=user.email,
        email_verified=False,
        message="Check your email to verify your account.",
    )

@router.get("/verify")
def verify_email(token: str, db: Session = Depends(get_db)):
    ok, message = verify_email_token(db, token)
    if not ok:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "data": {"email_verified": True}, "message": message}

@router.post("/resend-verification")
def resend_verification(body: ResendRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if user and not user.email_verified:
        _queue_verification_email(db, user)
        db.commit()
    return {
        "success": True,
        "message": "If that email is registered and unverified, a verification link has been sent.",
    }

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(deps.get_current_active_user)):
    return _user_response(current_user)

@router.post("/login", response_model=Token)
def login(login_data: LoginData, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not security.verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    if not user.email_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email to continue. Check your inbox or resend the verification email.",
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}
