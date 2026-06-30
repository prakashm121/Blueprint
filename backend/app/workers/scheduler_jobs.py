import logging
from datetime import date, datetime, timedelta, timezone

from app.db.session import SessionLocal
from app.models.planner import PlannerTask
from app.models.planner_generation import PlannerGeneration
from app.models.user import User
from app.workers import event_types as ET
from app.workers.outbox import enqueue_outbox

logger = logging.getLogger("placementos.scheduler_jobs")


def scan_due_planner_tasks() -> None:
    """App Flow §5.6 — find due tasks, enqueue notification + email via outbox."""
    db = SessionLocal()
    try:
        today = date.today()
        tomorrow = today + timedelta(days=1)

        tasks = (
            db.query(PlannerTask)
            .filter(
                PlannerTask.status != "Completed",
                PlannerTask.reminder_enabled.is_(True),
                PlannerTask.reminder_sent.is_(False),
                PlannerTask.due_date.isnot(None),
            )
            .all()
        )

        enqueued = 0
        for task in tasks:
            due = task.due_date
            if due.tzinfo is None:
                due = due.replace(tzinfo=timezone.utc)
            due_date = due.date()
            if due_date not in (today, tomorrow):
                continue

            user = db.query(User).filter(User.id == task.user_id).first()
            if not user:
                continue

            due_label = "today" if due_date == today else "tomorrow"
            name = user.profile.full_name if user.profile else user.full_name
            base_key = f"planner-reminder:{task.id}:{due_date.isoformat()}"

            enqueue_outbox(
                db,
                ET.NOTIFICATION_PLANNER_REMINDER,
                {"user_id": user.id, "task_title": task.title, "due_label": due_label},
                idempotency_key=f"{base_key}:notification",
            )
            enqueue_outbox(
                db,
                ET.EMAIL_PLANNER_REMINDER,
                {
                    "email": user.email,
                    "full_name": name,
                    "task_title": task.title,
                    "due_label": due_label,
                },
                idempotency_key=f"{base_key}:email",
            )
            task.reminder_sent = True
            db.add(task)
            enqueued += 1

        if enqueued:
            db.commit()
            logger.info("Planner reminder events enqueued: %d", enqueued)
    except Exception:
        logger.exception("Planner reminder scan failed")
        db.rollback()
    finally:
        db.close()


def reconcile_stuck_generations() -> None:
    """App Flow §14.5 — mark stuck planner_generations as failed."""
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
        stuck = (
            db.query(PlannerGeneration)
            .filter(
                PlannerGeneration.status.in_(["queued", "processing"]),
                PlannerGeneration.updated_at < cutoff,
            )
            .all()
        )
        for gen in stuck:
            gen.status = "failed"
            gen.error_message = "Job timed out — please retry."
            logger.warning("Marked stuck generation id=%s as failed", gen.id)
        if stuck:
            db.commit()
    except Exception:
        logger.exception("Stuck generation reconciliation failed")
        db.rollback()
    finally:
        db.close()
