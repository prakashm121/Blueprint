"""Celery tasks — clean wrappers around existing business logic.

No asyncio.to_thread needed: Celery workers run synchronously
in their own isolated processes.
"""

import logging
from app.workers.celery_app import celery_app
from app.db.session import SessionLocal
from app.workers.outbox import process_outbox_events
from app.workers.scheduler_jobs import scan_due_planner_tasks, reconcile_stuck_generations
from app.services.roadmap_service import generate_roadmap

logger = logging.getLogger("placementos.celery")


@celery_app.task(name="app.workers.celery_tasks.process_outbox_task")
def process_outbox_task():
    n = process_outbox_events()
    if n:
        logger.info("Celery outbox processed %d events", n)


@celery_app.task(name="app.workers.celery_tasks.scan_planner_reminders_task")
def scan_planner_reminders_task():
    scan_due_planner_tasks()


@celery_app.task(name="app.workers.celery_tasks.reconcile_generations_task")
def reconcile_generations_task():
    reconcile_stuck_generations()


@celery_app.task(name="app.workers.celery_tasks.generate_roadmap_task")
def generate_roadmap_task(generation_id: int):
    db = SessionLocal()
    try:
        generate_roadmap(db, generation_id)
    except Exception:
        logger.exception("generate_roadmap failed generation_id=%s", generation_id)
    finally:
        db.close()
