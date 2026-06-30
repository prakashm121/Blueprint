from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api.deps import get_current_active_user
from app.db.session import get_db
from app.models.user import User
from app.models.planner import WeeklyPlan
from app.models.dashboard_stats import DashboardStatistics
from app.services.notification_service import get_unread_count

router = APIRouter()


class DashboardProfile(BaseModel):
    full_name: str | None = None
    college_name: str | None = None
    degree: str | None = None
    graduation_year: int | None = None


class DashboardSummary(BaseModel):
    profile: DashboardProfile
    overall_readiness: float
    weekly_tasks_completed: int
    weekly_tasks_total: int
    upcoming_interviews: int
    next_milestone: str
    planner_completion: float
    dsa_solved: int
    subjects_completed: int
    resume_score: float
    applications_sent: int
    unread_notifications_count: int = 0


@router.get("/", response_model=DashboardSummary)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    profile = current_user.profile
    stats = db.query(DashboardStatistics).filter(
        DashboardStatistics.user_id == current_user.id
    ).first()

    # Auto-create stats row if missing
    if not stats:
        stats = DashboardStatistics(user_id=current_user.id)
        db.add(stats)
        db.commit()
        db.refresh(stats)

    # Determine next milestone
    next_milestone = "Complete onboarding profile"
    if profile and profile.college_name:
        next_milestone = "Create your first weekly plan"
        if float(stats.planner_completion or 0) > 0:
            next_milestone = "Keep completing tasks to improve readiness"

    profile_data = DashboardProfile(
        full_name=profile.full_name if profile else current_user.full_name,
        college_name=profile.college_name if profile else None,
        degree=profile.degree if profile else None,
        graduation_year=profile.graduation_year if profile else None,
    )

    # Sync weekly task counts from active planner
    active_plan = (
        db.query(WeeklyPlan)
        .filter(WeeklyPlan.user_id == current_user.id, WeeklyPlan.status == "active")
        .first()
    )
    weekly_completed = 0
    weekly_total = 0
    planner_completion = float(stats.planner_completion or 0)
    if active_plan:
        weekly_total = active_plan.total_tasks or 0
        weekly_completed = active_plan.completed_tasks or 0
        planner_completion = float(active_plan.completion_percentage or 0)
        if stats.planner_completion != planner_completion:
            stats.planner_completion = planner_completion
            db.commit()

    return DashboardSummary(
        profile=profile_data,
        overall_readiness=float(stats.readiness_score or 0),
        weekly_tasks_completed=weekly_completed,
        weekly_tasks_total=weekly_total,
        upcoming_interviews=int(stats.interviews_completed or 0),
        next_milestone=next_milestone,
        planner_completion=planner_completion,
        dsa_solved=int(stats.dsa_solved or 0),
        subjects_completed=int(stats.subjects_completed or 0),
        resume_score=float(stats.resume_score or 0),
        applications_sent=int(stats.applications_sent or 0),
        unread_notifications_count=get_unread_count(db, current_user.id),
    )
