"""One-off dev migration for new columns and tables."""
from sqlalchemy import text, inspect
from app.db.session import engine, init_db


def migrate():
    insp = inspect(engine)
    if "users" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("users")}
        with engine.begin() as conn:
            if "onboarding_step" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN onboarding_step VARCHAR(30)"))
                conn.execute(text("UPDATE users SET onboarding_step = 'profile' WHERE onboarding_step IS NULL"))
            if "target_role" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN target_role VARCHAR(100)"))
            if "target_companies" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN target_companies TEXT"))
            if "onboarding_completed_at" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN onboarding_completed_at DATETIME"))
            if "created_at" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN created_at DATETIME"))
            if "email_verified" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0"))
                conn.execute(text("UPDATE users SET email_verified = 1"))

    if "planner_tasks" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("planner_tasks")}
        with engine.begin() as conn:
            if "reminder_sent" not in cols:
                conn.execute(text("ALTER TABLE planner_tasks ADD COLUMN reminder_sent BOOLEAN DEFAULT 0"))

    init_db()
    print("Migration complete")


if __name__ == "__main__":
    migrate()
