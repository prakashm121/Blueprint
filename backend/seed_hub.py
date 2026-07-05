# seed_hub.py

import os
import sys
import csv
import ast
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.sql import text

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.db.session import SessionLocal
from app.models.hub import QuizQuestion, InterviewQuestion, DSAProblem

# ── Paths relative to this file's location ───────────────────────────────────
# seed_hub.py lives in  backend/seeds/
# CSVs live in          backend/csv/
# So: __file__ → seeds/seed_hub.py → .. → backend/ → csv/
_HERE    = os.path.dirname(os.path.abspath(__file__))
_CSV_DIR = os.path.join(_HERE, "..", "csv")

QUIZ_CSV      = os.path.join(_CSV_DIR, "seed_quiz_questions.csv")
INTERVIEW_CSV = os.path.join(_CSV_DIR, "seed_interview_questions_clean.csv")
DSA_CSV       = os.path.join(_CSV_DIR, "ultimate_master_coding_questions.csv")

BATCH_SIZE = 500


def parse_array(val):
    """Safely converts string representations of lists into Python lists."""
    if not val:
        return []
    try:
        parsed = ast.literal_eval(val)
        if isinstance(parsed, list):
            return parsed
        return []
    except (ValueError, SyntaxError):
        return [val] if val else []


def seed_quiz(db: Session):
    print("Seeding Quiz Questions Safely...")
    if not os.path.exists(QUIZ_CSV):
        print(f"File not found: {QUIZ_CSV}")
        return

    existing_questions = set(db.scalars(text("SELECT question FROM quiz_questions")).all())
    print(f"Found {len(existing_questions)} existing quiz questions in DB. Skipping duplicates...")

    with open(QUIZ_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        batch = []
        for row in reader:
            question_text = row.get("question", "").strip()

            if question_text in existing_questions:
                continue

            batch.append({
                "section":    row.get("section", ""),
                "topic":      row.get("topic", ""),
                "difficulty": row.get("difficulty", ""),
                "question":   question_text,
                "option_a":   row.get("option_a", ""),
                "option_b":   row.get("option_b", ""),
                "option_c":   row.get("option_c", ""),
                "option_d":   row.get("option_d", ""),
                "correct_ans":row.get("correct_ans", ""),
            })

            if len(batch) >= BATCH_SIZE:
                db.execute(insert(QuizQuestion).values(batch))
                db.commit()
                batch = []
        if batch:
            db.execute(insert(QuizQuestion).values(batch))
            db.commit()
    print("Quiz seeding process complete.")


def seed_interview(db: Session):
    print("Seeding Interview Questions Safely...")
    if not os.path.exists(INTERVIEW_CSV):
        print(f"File not found: {INTERVIEW_CSV}")
        return

    existing_titles = set(db.scalars(text("SELECT title FROM interview_questions")).all())
    print(f"Found {len(existing_titles)} existing interview questions in DB. Skipping duplicates...")

    with open(INTERVIEW_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        batch = []
        for row in reader:
            title_text = row.get("title", "").strip()

            if title_text in existing_titles:
                continue

            skill = row.get("skill", "").strip()
            batch.append({
                "title":      title_text,
                "body":       row.get("body", "") or None,
                "category":   row.get("category", ""),
                "skill":      skill if skill else None,
                "difficulty": row.get("difficulty", "Medium"),
                "roles":      parse_array(row.get("roles", "[]")),
                "source":     row.get("source", "curated"),
            })

            if len(batch) >= BATCH_SIZE:
                db.execute(insert(InterviewQuestion).values(batch))
                db.commit()
                batch = []
        if batch:
            db.execute(insert(InterviewQuestion).values(batch))
            db.commit()
    print("Interview seeding process complete.")


def seed_dsa(db: Session):
    print("Seeding DSA Problems Safely...")
    if not os.path.exists(DSA_CSV):
        print(f"File not found: {DSA_CSV}")
        return

    try:
        csv.field_size_limit(sys.maxsize)
    except OverflowError:
        csv.field_size_limit(2147483647)

    with open(DSA_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        batch = []
        for row in reader:
            acRate = row.get("acRate", "")
            try:
                acRate_f = float(acRate.strip("%")) if acRate else 0.0
            except ValueError:
                acRate_f = 0.0

            batch.append({
                "frontend_id":   int(row.get("frontend_id", 0)),
                "title":         row.get("title", ""),
                "titleSlug":     row.get("titleSlug", ""),
                "difficulty":    row.get("difficulty", ""),
                "content":       row.get("content", ""),
                "topic_tags":    parse_array(row.get("topic_tags", "[]")),
                "code_snippets": row.get("code_snippets", ""),
                "acRate":        acRate_f,
                "companies":     parse_array(row.get("companies", "[]")),
                "problem_URL":   row.get("problem_URL", ""),
                "is_premium":    row.get("is_premium", "false"),
            })

            if len(batch) >= BATCH_SIZE:
                stmt = insert(DSAProblem).values(batch).on_conflict_do_nothing(index_elements=["frontend_id"])
                db.execute(stmt)
                db.commit()
                batch = []
        if batch:
            stmt = insert(DSAProblem).values(batch).on_conflict_do_nothing(index_elements=["frontend_id"])
            db.execute(stmt)
            db.commit()
    print("DSA seeding process complete.")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_quiz(db)
        seed_interview(db)
        seed_dsa(db)
    except Exception as e:
        print(f"An unexpected error occurred during seeding: {e}")
        db.rollback()
    finally:
        db.close()