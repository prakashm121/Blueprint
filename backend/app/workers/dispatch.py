"""Route deferred work to Celery, with BackgroundTasks fallback."""

import logging

from fastapi import BackgroundTasks

from app.workers.celery_tasks import generate_roadmap_task

logger = logging.getLogger("placementos.dispatch")


def dispatch_roadmap_generation(generation_id: int, background_tasks: BackgroundTasks) -> None:
    """
    Dispatches roadmap generation to Celery via .delay().
    Falls back to in-process BackgroundTasks if the broker is unreachable.
    """
    try:
        generate_roadmap_task.delay(generation_id)
        logger.info("Enqueued generate_roadmap_task into Celery for gen_id=%s", generation_id)
    except Exception as e:
        logger.error("Failed to push task to Celery broker: %s. Falling back to background tasks.", e)
        from app.workers.deferred import run_generate_roadmap
        background_tasks.add_task(run_generate_roadmap, generation_id)
