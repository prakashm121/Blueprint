import json
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.user import User
from app.models.planner import PlannerTask
from app.services.email_service import (
    send_verification_email,
    send_welcome_email,
    send_roadmap_ready_email,
    send_planner_reminder_email,
)
from app.services.notification_service import (
    notify_welcome,
    notify_roadmap_ready,
    notify_planner_reminder,
)
from app.workers import event_types as ET

logger = logging.getLogger("placementos.handlers")


def _user_name(user: User) -> str | None:
    return user.profile.full_name if user.profile else user.full_name


def handle_email_verification(payload: dict) -> None:
    db = SessionLocal()
    try:
        send_verification_email(
            payload["email"],
            payload.get("full_name"),
            payload["raw_token"],
        )
    finally:
        db.close()


def handle_email_welcome(payload: dict) -> None:
    send_welcome_email(payload["email"], payload.get("full_name"))


def handle_email_roadmap_ready(payload: dict) -> None:
    send_roadmap_ready_email(payload["email"], payload.get("full_name"))


def handle_email_planner_reminder(payload: dict) -> None:
    send_planner_reminder_email(
        payload["email"],
        payload.get("full_name"),
        payload["task_title"],
        payload["due_label"],
    )


def handle_notification_welcome(payload: dict) -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == payload["user_id"]).first()
        if user:
            notify_welcome(db, user)
    finally:
        db.close()


def handle_notification_roadmap_ready(payload: dict) -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == payload["user_id"]).first()
        if user:
            notify_roadmap_ready(db, user)
    finally:
        db.close()


def handle_notification_planner_reminder(payload: dict) -> None:
    db = SessionLocal()
    try:
        notify_planner_reminder(
            db,
            payload["user_id"],
            payload["task_title"],
            payload["due_label"],
        )
    finally:
        db.close()


def handle_planner_task_completed(payload: dict) -> None:
    """Future: achievement checks, dashboard cache invalidation (App Flow §5.5)."""
    logger.debug("planner.task_completed user_id=%s task_id=%s", payload.get("user_id"), payload.get("task_id"))


HANDLERS: dict[str, callable] = {
    ET.EMAIL_VERIFICATION: handle_email_verification,
    ET.EMAIL_WELCOME: handle_email_welcome,
    ET.EMAIL_ROADMAP_READY: handle_email_roadmap_ready,
    ET.EMAIL_PLANNER_REMINDER: handle_email_planner_reminder,
    ET.NOTIFICATION_WELCOME: handle_notification_welcome,
    ET.NOTIFICATION_ROADMAP_READY: handle_notification_roadmap_ready,
    ET.NOTIFICATION_PLANNER_REMINDER: handle_notification_planner_reminder,
    ET.PLANNER_TASK_COMPLETED: handle_planner_task_completed,
}
