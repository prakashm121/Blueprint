from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.planner import WeeklyPlan, PlannerTask
from app.models.planner_generation import PlannerGeneration
from app.models.dashboard_stats import DashboardStatistics
from app.workers.outbox import enqueue_outbox
from app.workers import event_types as ET
from app.services.ai_service import generate_weekly_tasks_async
from app.services.context_builder import build_weekly_plan_context
import asyncio

def generate_initial_plan(db: Session, generation_id: int) -> None:
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
        
        # Build user context with existing session, then call AI
        ctx = build_weekly_plan_context(db, user)
        tasks = asyncio.run(generate_weekly_tasks_async(ctx, [], 7))

        # Fallback if AI generation failed
        if not tasks:
            tasks = [
                {"title": "Review core CS fundamentals", "category": "Subjects", "priority": "Medium", "estimated_minutes": 60, "day": 1},
                {"title": "Solve 2 DSA problems", "category": "DSA", "priority": "High", "estimated_minutes": 90, "day": 2},
                {"title": "Update resume with latest work", "category": "Resume", "priority": "Medium", "estimated_minutes": 45, "day": 3},
                {"title": "Research target company interview process", "category": "Company Preparation", "priority": "Medium", "estimated_minutes": 45, "day": 4},
                {"title": "Practice behavioral interview answers", "category": "Mock Interview", "priority": "Low", "estimated_minutes": 30, "day": 5},
                {"title": "Review a recent project", "category": "Projects", "priority": "Medium", "estimated_minutes": 60, "day": 6},
                {"title": "Do a mock interview", "category": "Mock Interview", "priority": "High", "estimated_minutes": 60, "day": 7},
            ]

        plan = WeeklyPlan(
            user_id=user.id,
            title=f"Initial Plan - Week {iso_cal[1]}",
            description="Your first weekly plan to kickstart your preparation.",
            week_number=iso_cal[1],
            start_date=today,
            end_date=today + timedelta(days=6),
            generation_source="ai",
            status="active",
        )
        db.add(plan)
        db.flush()

        for i, task in enumerate(tasks):
            # Try to get 'day' from the AI output (1-7), fallback to index+1
            task_day = task.get("day", i + 1)
            task_due = datetime.combine(
               today + timedelta(days=min(task_day - 1, 6)),
               datetime.min.time(),
               tzinfo=timezone.utc,
            )

            db.add(
                PlannerTask(
                    weekly_plan_id=plan.id,
                    user_id=user.id,
                    title=task.get("title", f"Task {i+1}"),
                    category=task.get("category", "Custom"),
                    priority=task.get("priority", "Medium"),
                    estimated_minutes=task.get("estimated_minutes", 60),
                    ai_generated=True,
                    reminder_enabled=True,
                    due_date=task_due,
                    display_order=i,
                )
            )

        plan.total_tasks = len(tasks)
        generation.weekly_plan_id = plan.id
        generation.status = "completed"

        stats = db.query(DashboardStatistics).filter(DashboardStatistics.user_id == user.id).first()
        if stats:
            stats.planner_completion = 0
            stats.readiness_score = min(100, float(stats.readiness_score or 0) + 5)

        notify_key = f"initial-plan-ready:{generation.id}"
        profile_name = user.profile.full_name if user.profile else user.full_name
        enqueue_outbox(
            db,
            ET.NOTIFICATION_ROADMAP_READY, # keeping the same event type to avoid touching the enum/frontend
            {"user_id": user.id},
            idempotency_key=f"{notify_key}:notification",
        )
        enqueue_outbox(
            db,
            ET.EMAIL_ROADMAP_READY, # keeping the same event type to avoid touching the enum/email templates
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
