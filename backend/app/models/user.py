"""
user.py — Core user account model.
target_companies is stored as a JSON-encoded list of strings.
"""
from sqlalchemy import Boolean, Column, Integer, String, DateTime, Text, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, index=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    onboarding_step = Column(String(30), nullable=False, default="profile")
    target_role = Column(String(100), nullable=True)
    target_companies = Column(Text, nullable=True)  # JSON array of company names
    onboarding_completed_at = Column(DateTime(timezone=True), nullable=True)
    email_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_user_target_role", "target_role"),
    )

    profile = relationship("Profile", back_populates="user", uselist=False)
