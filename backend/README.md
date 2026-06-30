# PlacementOS Backend

FastAPI backend with scalable worker architecture. See [docs/SCALING_PLAN.md](../../docs/SCALING_PLAN.md).

## Quick start (local, single process)

```powershell
cd Workspace\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python migrate_dev.py
uvicorn main:app --reload
```

Uses `APP_ROLE=all` + `WORKER_MODE=embedded` — API and scheduler in one process.

## Production-like local (PostgreSQL + Redis + split API/worker)

```powershell
cd Workspace
docker compose up --build
```

- API: http://localhost:8000  
- Postgres: `localhost:5432`  
- Redis: `localhost:6379`  
- Worker: ARQ process handles outbox, reminders, roadmap jobs

## Run modes

The application uses Celery for background tasks and Celery Beat for scheduled jobs.

| Component | Command | What runs |
|-----------|---------|-----------|
| API | `uvicorn main:app --host 0.0.0.0 --port 8000` | FastAPI server |
| Celery Worker | `celery -A app.workers.celery_app worker --loglevel=info --concurrency=4 --without-gossip --without-mingle --without-heartbeat` | Background task processing |
| Celery Beat | `celery -A app.workers.celery_app beat --loglevel=info` | Cron scheduler |

## Commands

```bash
# API Server
uvicorn main:app --host 0.0.0.0 --port 8000

# Celery Worker (with flags to save Upstash quota)
celery -A app.workers.celery_app worker --loglevel=info --concurrency=4 --without-gossip --without-mingle --without-heartbeat

# Celery Beat
celery -A app.workers.celery_app beat --loglevel=info

# Worker health
curl http://localhost:8000/api/v1/status/workers
```

## Deploy (Render)

Use [render.yaml](../../render.yaml) at repo root — provisions API web service, worker service, PostgreSQL, and Redis.

## Migrations

```bash
python migrate_dev.py          # SQLite dev bootstrap
alembic upgrade head           # PostgreSQL / production
```
