from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Index
from sqlalchemy.sql import func
from app.db.session import Base


class PlannerGeneration(Base):
    __tablename__ = "planner_generations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    status = Column(String(20), nullable=False, default="queued")  # queued, processing, completed, failed
    generated_by = Column(String(20), nullable=False, default="ai")
    weekly_plan_id = Column(Integer, ForeignKey("weekly_plans.id"), nullable=True)
    error_message = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_pg_user_status", "user_id", "status"),
    )
