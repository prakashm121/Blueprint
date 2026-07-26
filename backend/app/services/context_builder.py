"""
context_builder.py — Builds context dicts passed to AI prompts and planner endpoints.
"""
import json
import hashlib
from datetime import date, datetime, timedelta, timezone
from sqlalchemy import cast, Date
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.dashboard_stats import DashboardStatistics
from app.models.assessment import UserSkillAssessment
from app.models.planner import WeeklyPlan, PlannerTask
from app.core.cache import get_cache, set_cache


def _decode_companies(user: User) -> list[str]:
    """Parse the JSON-encoded target_companies field safely."""
    try:
        return json.loads(user.target_companies) if user.target_companies else []
    except json.JSONDecodeError:
        return []


# ---------------------------------------------------------------------------
# Weekly plan generation context
# Used by: planner.py (create_plan) and initial_plan_service.py
# ---------------------------------------------------------------------------

def build_weekly_plan_context(db: Session, user: User) -> dict:
    """
    Returns everything the AI needs to generate a personalized weekly plan.
    Fetches from the caller's existing DB session — no extra connections opened.
    """
    profile = user.profile

    stats = (
        db.query(DashboardStatistics)
        .filter(DashboardStatistics.user_id == user.id)
        .first()
    )

    assessments = (
        db.query(UserSkillAssessment)
        .filter(UserSkillAssessment.user_id == user.id)
        .all()
    )
    weak_areas = [
        a.skill_key.replace("_", " ").title()
        for a in assessments if a.self_rated_confidence < 50
    ]

    # Last 20 completed/archived tasks so AI won't repeat them.
    # "Archived" tasks are ones the user deleted from the dashboard after completing them.
    completed_tasks = (
        db.query(PlannerTask)
        .filter(
            PlannerTask.user_id == user.id,
            PlannerTask.status.in_(["Completed", "Archived"])
        )
        .order_by(PlannerTask.due_date.desc())
        .limit(20)
        .all()
    )

    return {
        "profile": {
            "full_name": profile.full_name if profile else user.full_name,
            "college": getattr(profile, "college_name", None) or "Unknown",
            "specialization": getattr(profile, "specialization", None) or "Unknown",
            "graduation_year": getattr(profile, "graduation_year", None) or "Unknown",
            "target_role": user.target_role or "Software Engineer",
            "target_companies": _decode_companies(user),
        },
        "progress": {
            "readiness_score": float(stats.readiness_score or 0) if stats else 0,
            "planner_completion": float(stats.planner_completion or 0) if stats else 0,
            "dsa_solved": int(stats.dsa_solved or 0) if stats else 0,
        },
        "weak_areas": weak_areas,
        "completed_task_titles": [t.title for t in completed_tasks],
    }


def build_daily_planner_context(
    db: Session,
    user: User,
    available_minutes: int,
    custom_tasks: list,
) -> dict:
    today = date.today()
    # Compare using UTC-aware noon of today — avoids timezone edge cases where
    # tasks stored at midnight UTC look like they're in the future on UTC+5:30.
    today_utc_end = datetime.combine(today, datetime.max.time(), tzinfo=timezone.utc)
    today_utc_start = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)

    active_plan = (
        db.query(WeeklyPlan)
        .filter(WeeklyPlan.user_id == user.id, WeeklyPlan.status == "active")
        .first()
    )

    all_pending = []
    if active_plan:
        all_pending = (
            db.query(PlannerTask)
            .filter(
                PlannerTask.weekly_plan_id == active_plan.id,
                PlannerTask.status == "Pending",
            )
            .order_by(PlannerTask.display_order)
            .all()
        )

    # Include tasks due today OR overdue (due_date <= end of today UTC)
    # A task with no due_date is always included.
    todays_tasks = [
        t for t in all_pending
        if t.due_date is None or t.due_date <= today_utc_end
    ]

    # Fallback: if nothing is due yet, show today's task by display_order position.
    # Use the weekday index (0=Mon…6=Sun) to pick the right task for today.
    if not todays_tasks and all_pending:
        weekday = today.weekday()  # 0=Monday, 4=Friday
        idx = min(weekday, len(all_pending) - 1)
        todays_tasks = [all_pending[idx]]

    # Recent completion rate over the last 7 days
    week_ago_dt = datetime.combine(today - timedelta(days=7), datetime.min.time(), tzinfo=timezone.utc)
    recent_tasks = (
        db.query(PlannerTask)
        .filter(
            PlannerTask.user_id == user.id,
            PlannerTask.due_date >= week_ago_dt,
        )
        .all()
    )
    total_recent = len(recent_tasks)
    done_recent = sum(1 for t in recent_tasks if t.status == "Completed")
    completion_pct = round((done_recent / total_recent * 100), 1) if total_recent else 0

    return {
        "available_minutes": available_minutes,
        "todays_pending_tasks": [
            {
                "id": t.id,
                "title": t.title,
                "category": t.category,
                "priority": t.priority,
                "estimated_minutes": t.estimated_minutes or 45,
            }
            for t in todays_tasks
        ],
        "custom_tasks": custom_tasks,
        "recent_completion_rate": completion_pct,
        "target_role": user.target_role or "Software Engineer",
    }


# ---------------------------------------------------------------------------
# Mentor context
# ---------------------------------------------------------------------------

TONE_INSTRUCTIONS = {
    "firm_accountability": (
        "The student is slightly behind on their plan. Be encouraging and supportive. "
        "Acknowledge the situation gently, but focus entirely on helping them learn and catch up. "
        "Act as a patient teacher who provides clear, easy-to-understand explanations and actionable advice."
    ),
    "encouraging": (
        "The student is on track. Be warm, celebrate their progress, "
        "and act as an inspiring teacher who helps them push toward the next milestone with clear explanations."
    ),
    "balanced": (
        "Give balanced, constructive guidance. Act as a patient teacher, acknowledging progress "
        "while providing clear, easy-to-understand explanations for any concepts they ask about."
    ),
}


def build_mentor_context(db: Session, user: User) -> dict:
    """Full motivational context. Cached at mentor:context:{user_id} TTL 5 min."""
    cache_key = f"mentor:context:{user.id}"
    cached = get_cache(cache_key)
    if cached:
        return cached

    profile = user.profile
    stats = (
        db.query(DashboardStatistics)
        .filter(DashboardStatistics.user_id == user.id)
        .first()
    )

    active_plan = (
        db.query(WeeklyPlan)
        .filter(WeeklyPlan.user_id == user.id, WeeklyPlan.status == "active")
        .first()
    )

    today = date.today()
    overdue_tasks = (
        db.query(PlannerTask.title)
        .filter(
            PlannerTask.user_id == user.id,
            PlannerTask.status != "Completed",
            cast(PlannerTask.due_date, Date) < today,
        )
        .limit(5)
        .all()
    )

    weak = (
        db.query(UserSkillAssessment)
        .filter(UserSkillAssessment.user_id == user.id)
        .order_by(UserSkillAssessment.self_rated_confidence.asc())
        .limit(3)
        .all()
    )
    weak_areas = [a.skill_key.replace("_", " ").title() for a in weak]

    from app.models.hub_progress import UserCodingProgress
    solve_dates_rows = (
        db.query(cast(UserCodingProgress.created_at, Date))
        .filter(
            UserCodingProgress.user_id == user.id,
            UserCodingProgress.status == "solved",
        )
        .distinct()
        .order_by(cast(UserCodingProgress.created_at, Date).desc())
        .limit(30)
        .all()
    )
    solve_dates = sorted({r[0] for r in solve_dates_rows}, reverse=True)
    streak, expected = 0, today
    for d in solve_dates:
        if d == expected or d == expected - timedelta(days=1):
            streak += 1
            expected = d - timedelta(days=1)
        else:
            break

    plan_completion = float(active_plan.completion_percentage or 0) if active_plan else 0
    if plan_completion < 40:
        tone = "firm_accountability"
    elif plan_completion >= 70:
        tone = "encouraging"
    else:
        tone = "balanced"

    target_companies = []
    if user.target_companies:
        try:
            target_companies = json.loads(user.target_companies)
        except json.JSONDecodeError:
            pass

    ctx = {
        "profile": {
            "full_name": profile.full_name if profile else user.full_name,
            "target_role": user.target_role or "Software Engineer",
            "target_companies": target_companies,
        },
        "progress": {
            "readiness_score": float(stats.readiness_score or 0) if stats else 0,
            "dsa_solved": int(stats.dsa_solved or 0) if stats else 0,
            "planner_completion": plan_completion,
            "active_plan_title": active_plan.title if active_plan else None,
            "streak_days": streak,
        },
        "accountability": {
            "overdue_tasks": [r[0] for r in overdue_tasks],
            "weak_areas": weak_areas,
            "tone": tone,
            "tone_instruction": TONE_INSTRUCTIONS.get(tone, ""),
        },
    }
    set_cache(cache_key, ctx, 300)
    return ctx


# ---------------------------------------------------------------------------
# Teacher context
# ---------------------------------------------------------------------------

def build_teacher_context(db: Session, user: User, topic: str) -> dict:
    """Fetches context for a teaching session. Interview questions cached 12 hr shared."""
    from app.models.hub import InterviewQuestion, DSAProblem

    topic_hash = hashlib.md5(topic.lower().strip().encode()).hexdigest()

    q_cache_key = f"teacher:questions:{topic_hash}"
    cached_qs = get_cache(q_cache_key)

    if cached_qs:
        interview_qs = cached_qs
    else:
        iq_rows = (
            db.query(InterviewQuestion.title, InterviewQuestion.body, InterviewQuestion.difficulty)
            .filter(InterviewQuestion.skill.ilike(f"%{topic}%"))
            .order_by(InterviewQuestion.difficulty.asc())
            .limit(3)
            .all()
        )
        interview_qs = [
            {"title": r.title, "body": r.body, "difficulty": r.difficulty}
            for r in iq_rows
        ]
        set_cache(q_cache_key, interview_qs, 43200)  # 12 hr

    assessment = (
        db.query(UserSkillAssessment)
        .filter(
            UserSkillAssessment.user_id == user.id,
            UserSkillAssessment.skill_key.ilike(f"%{topic.lower().replace(' ', '_')}%"),
        )
        .first()
    )
    if assessment:
        confidence = assessment.self_rated_confidence
        proficiency = "beginner" if confidence < 40 else "intermediate" if confidence < 70 else "advanced"
    else:
        proficiency = "beginner"

    dsa_problems = []
    algorithmic_keywords = {
        "array", "tree", "graph", "dp", "dynamic programming",
        "sorting", "searching", "recursion", "backtracking",
        "linked list", "stack", "queue", "heap", "hash",
    }
    if any(kw in topic.lower() for kw in algorithmic_keywords):
        dsa_rows = (
            db.query(DSAProblem.title, DSAProblem.difficulty, DSAProblem.frontend_id)
            .filter(DSAProblem.topic_tags.contains([topic]))
            .order_by(DSAProblem.acRate.desc())
            .limit(2)
            .all()
        )
        dsa_problems = [
            {"title": r.title, "difficulty": r.difficulty, "id": r.frontend_id}
            for r in dsa_rows
        ]

    return {
        "topic": topic,
        "student_proficiency": proficiency,
        "target_role": user.target_role or "Software Engineer",
        "example_interview_questions": interview_qs,
        "related_dsa_problems": dsa_problems,
    }
