from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.planner import WeeklyPlan, PlannerTask
from app.models.planner_generation import PlannerGeneration
from app.models.dashboard_stats import DashboardStatistics
from app.workers.outbox import enqueue_outbox
from app.workers import event_types as ET
from app.services.ai_service import generate_ai_roadmap

# ROADMAP_TASK_TEMPLATES = {
#     "Backend Engineer": [
#         ("Review REST API design patterns", "Subjects", "High", 60),
#         ("Practice SQL joins and indexing", "Subjects", "High", 75),
#         ("Solve 3 medium array/hash problems", "DSA", "High", 90),
#         ("Build a small API project feature", "Projects", "Medium", 120),
#         ("Update resume with backend projects", "Resume", "Medium", 45),
#     ],
#     "Full Stack Engineer": [
#         ("Review React component patterns", "Subjects", "High", 60),
#         ("Practice system design basics", "Subjects", "Medium", 50),
#         ("Solve 2 graph/tree problems", "DSA", "High", 90),
#         ("Ship one full-stack feature end-to-end", "Projects", "High", 120),
#         ("Tailor resume for full-stack roles", "Resume", "Medium", 45),
#     ],
#     "Data Engineer": [
#         ("Review ETL pipeline concepts", "Subjects", "High", 60),
#         ("Practice SQL window functions", "Subjects", "High", 75),
#         ("Solve 2 string/array problems", "DSA", "Medium", 75),
#         ("Document a data pipeline project", "Projects", "Medium", 90),
#         ("Highlight data projects on resume", "Resume", "Medium", 45),
#     ],
# }

# DEFAULT_TASKS = [
#     ("Review core CS fundamentals", "Subjects", "Medium", 50),
#     ("Solve 2 DSA problems", "DSA", "High", 90),
#     ("Update resume with latest work", "Resume", "Medium", 45),
#     ("Research target company interview process", "Company Preparation", "Medium", 40),
#     ("Practice behavioral interview answers", "Mock Interview", "Low", 30),
# ]


# def _tasks_for_user(user: User) -> list[tuple]:
#     role = user.target_role or "Software Engineer"
#     for key, tasks in ROADMAP_TASK_TEMPLATES.items():
#         if key.lower() in role.lower() or role.lower() in key.lower():
#             return tasks
#     return DEFAULT_TASKS


def generate_roadmap(db: Session, generation_id: int) -> None:
    generation = db.query(PlannerGeneration).filter(PlannerGeneration.id == generation_id).first()
    if not generation:
        return

    user = db.query(User).filter(User.id == generation.user_id).first()
    if not user:
        generation.status = "failed"
        generation.error_message = "User not found"
        db.commit()
        return

    try:
        generation.status = "processing"
        db.commit()

        existing = (
            db.query(WeeklyPlan)
            .filter(WeeklyPlan.user_id == user.id, WeeklyPlan.status == "active")
            .first()
        )
        if existing:
            existing.status = "archived"
            db.add(existing)

        today = date.today()
        iso_cal = today.isocalendar()
        roadmap = generate_ai_roadmap(user)

        plan = WeeklyPlan(
            user_id=user.id,
            title=roadmap["title"],
            description=roadmap["description"],
            week_number=iso_cal[1],
            start_date=today,
            end_date=today + timedelta(days=6),
            generation_source="ai",
            status="active",
        )
        db.add(plan)
        db.flush()

        for i, task in enumerate(roadmap["tasks"]):
            task_due = datetime.combine(
               today + timedelta(days=min(task["day"] - 1, 6)),
               datetime.min.time(),
               tzinfo=timezone.utc,
            )

            db.add(
                PlannerTask(
                    weekly_plan_id=plan.id,
                    user_id=user.id,
                    title=task["title"],
                    category=task["category"],
                    priority=task["priority"],
                    estimated_minutes=task["estimated_minutes"],
                    ai_generated=True,
                    reminder_enabled=True,
                    due_date=task_due,
                    display_order=i,
                )
                )

        plan.total_tasks = len(roadmap["tasks"])
        generation.weekly_plan_id = plan.id
        generation.status = "completed"

        stats = db.query(DashboardStatistics).filter(DashboardStatistics.user_id == user.id).first()
        if stats:
            stats.planner_completion = 0
            stats.readiness_score = min(100, float(stats.readiness_score or 0) + 5)

        notify_key = f"roadmap-ready:{generation.id}"
        profile_name = user.profile.full_name if user.profile else user.full_name
        enqueue_outbox(
            db,
            ET.NOTIFICATION_ROADMAP_READY,
            {"user_id": user.id},
            idempotency_key=f"{notify_key}:notification",
        )
        enqueue_outbox(
            db,
            ET.EMAIL_ROADMAP_READY,
            {"email": user.email, "full_name": profile_name},
            idempotency_key=f"{notify_key}:email",
        )

        db.commit()
    except Exception as exc:
        db.rollback()
        generation = db.query(PlannerGeneration).filter(PlannerGeneration.id == generation_id).first()
        if generation:
            generation.status = "failed"
            generation.error_message = str(exc)[:500]
            db.commit()
