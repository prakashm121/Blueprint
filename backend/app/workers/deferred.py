"""Deferred tasks with status columns — App Flow §14.2 / §14.5."""

import logging

from app.db.session import SessionLocal
from app.services.roadmap_service import generate_roadmap

logger = logging.getLogger("placementos.deferred")


def run_generate_roadmap(generation_id: int) -> None:
    db = SessionLocal()
    try:
        generate_roadmap(db, generation_id)
    except Exception:
        logger.exception("generate_roadmap failed generation_id=%s", generation_id)
    finally:
        db.close()
