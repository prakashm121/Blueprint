import json
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.dashboard_stats import DashboardStatistics
from app.models.assessment import UserSkillAssessment
from app.models.planner import WeeklyPlan


def build_user_context(db: Session, user: User, seed_context: dict | None = None) -> dict:
    profile = user.profile
    stats = db.query(DashboardStatistics).filter(DashboardStatistics.user_id == user.id).first()
    assessments = db.query(UserSkillAssessment).filter(UserSkillAssessment.user_id == user.id).all()
    active_plan = (
        db.query(WeeklyPlan)
        .filter(WeeklyPlan.user_id == user.id, WeeklyPlan.status == "active")
        .first()
    )

    weak_areas = [
        a.skill_key.replace("_", " ").title()
        for a in assessments
        if a.self_rated_confidence < 50
    ]

    target_companies = []
    if user.target_companies:
        try:
            target_companies = json.loads(user.target_companies)
        except json.JSONDecodeError:
            target_companies = []

    return {
        "profile": {
            "full_name": profile.full_name if profile else user.full_name,
            "college": profile.college_name if profile else None,
            "degree": profile.degree if profile else None,
            "graduation_year": profile.graduation_year if profile else None,
            "target_role": user.target_role,
            "target_companies": target_companies,
        },
        "progress": {
            "readiness_score": float(stats.readiness_score or 0) if stats else 0,
            "dsa_solved": int(stats.dsa_solved or 0) if stats else 0,
            "subjects_completed": int(stats.subjects_completed or 0) if stats else 0,
            "planner_completion": float(stats.planner_completion or 0) if stats else 0,
            "active_plan_title": active_plan.title if active_plan else None,
        },
        "weak_areas": weak_areas,
        "seed_context": seed_context or {},
    }
