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
    target_role : str | None = None

class DashboardTask(BaseModel):
    id: int
    text: str
    completed: bool
    category: str

class DashboardSummary(BaseModel):
    profile: DashboardProfile
    overall_readiness: float
    weekly_tasks_completed: int
    weekly_tasks_total: int
    next_milestone: str
    planner_completion: float
    dsa_solved: int
    dsa_total: int = 200
    subjects_completed: int
    resume_score: float
    unread_notifications_count: int = 0
    focus_tasks: list[DashboardTask] = []


@router.get("", response_model=DashboardSummary)
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
        target_role = profile.user.target_role if profile.user else None
    )

    from app.models.hub_progress import UserCodingProgress, UserQuizAttempt
    from app.models.hub import DSAProblem
    from sqlalchemy import func

    # Calculate DSA solved dynamically : temporary calculation
    dsa_solved = db.query(func.count(func.distinct(UserCodingProgress.dsa_id))).filter(
        UserCodingProgress.user_id == current_user.id,
        UserCodingProgress.status == "solved"
    ).scalar() or 0

    dsa_total = db.query(DSAProblem).count()

    # Calculate Core Subjects (distinct correct quiz questions)
    subjects_completed = db.query(func.count(func.distinct(UserQuizAttempt.quiz_id))).filter(
        UserQuizAttempt.user_id == current_user.id,
        UserQuizAttempt.is_correct == True
    ).scalar() or 0

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

    # Calculate overall readiness dynamically : temporarily
    dsa_score = min((dsa_solved / dsa_total) * 100, 100) if dsa_total > 0 else 0
    weekly_score = (weekly_completed / weekly_total * 100) if weekly_total > 0 else 0
    resume_score = round(float(stats.resume_score or 0), 1)
    overall_readiness = round((dsa_score * 0.4) + (weekly_score * 0.4) + (resume_score * 0.2), 1)

    return DashboardSummary(
        profile=profile_data,
        overall_readiness=overall_readiness,
        weekly_tasks_completed=weekly_completed,
        weekly_tasks_total=weekly_total,
        upcoming_interviews=int(stats.interviews_completed or 0),
        next_milestone=next_milestone,
        planner_completion=planner_completion,
        dsa_solved=dsa_solved,
        dsa_total=dsa_total,
        subjects_completed=subjects_completed,
        resume_score=resume_score,
        unread_notifications_count=get_unread_count(db, current_user.id),
    )
