# app/api/v1/hub.py

import hashlib
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status as http_status
from pydantic import BaseModel as PydanticBase
from sqlalchemy import func, cast, Date
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.cache import delete_cache, get_cache, set_cache
from app.db.session import get_db
from app.models.hub import DSAProblem, InterviewQuestion, QuizQuestion
from app.models.hub_progress import UserCodingProgress
from app.models.user import User

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# DSA / Coding Problems
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/coding")
def list_coding_problems(
    last_id:    int            = Query(0,  description="Keyset cursor — pass next_cursor from previous page"),
    limit:      int            = Query(20, le=20),
    difficulty: Optional[str] = None,
    topic:      Optional[str] = None,
    company:    Optional[str] = None,
    db: Session = Depends(get_db),
):
    filters_str = f"{last_id}:{limit}:{difficulty}:{topic}:{company}"
    cache_key   = f"coding:list:{hashlib.md5(filters_str.encode()).hexdigest()}"

    cached = get_cache(cache_key)
    if cached:
        return cached

    query = db.query(
        DSAProblem.id,
        DSAProblem.frontend_id,
        DSAProblem.title,
        DSAProblem.difficulty,
        DSAProblem.companies,
        DSAProblem.topic_tags,
        DSAProblem.acRate,
    ).filter(DSAProblem.id > last_id)

    if difficulty:
        query = query.filter(DSAProblem.difficulty == difficulty)
    if topic:
        # JSONB array containment: topic_tags @> '["Arrays"]'
        query = query.filter(DSAProblem.topic_tags.contains([topic]))
    if company:
        query = query.filter(DSAProblem.companies.contains([company]))

    results = query.order_by(DSAProblem.id.asc()).limit(limit).all()

    items = [
        {
            "id":          r.id,
            "frontend_id": r.frontend_id,
            "title":       r.title,
            "difficulty":  r.difficulty,
            "companies":   r.companies,
            "topic_tags":  r.topic_tags,
            "acRate":      r.acRate,
        }
        for r in results
    ]

    response_data = {
        "items":       items,
        "next_cursor": items[-1]["id"] if items else None,
    }
    set_cache(cache_key, response_data, 7200)   # 2 h
    return response_data


@router.get("/coding/{problem_id}")
def get_coding_problem(problem_id: int, db: Session = Depends(get_db)):
    cache_key = f"coding:q:{problem_id}"
    cached = get_cache(cache_key)
    if cached:
        return cached

    problem = db.query(DSAProblem).filter(DSAProblem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    data = {
        "id":            problem.id,
        "frontend_id":   problem.frontend_id,
        "title":         problem.title,
        "difficulty":    problem.difficulty,
        "content":       problem.content,       # full HTML — only on detail
        "topic_tags":    problem.topic_tags,
        "code_snippets": problem.code_snippets,
        "acRate":        problem.acRate,
        "companies":     problem.companies,
        "problem_URL":   problem.problem_URL,
    }
    set_cache(cache_key, data, 43200)           # 12 h — content never changes
    return data


# ─────────────────────────────────────────────────────────────────────────────
# Interview Q&A
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/interview")
def list_interview_questions(
    last_id:    int            = Query(0,  description="Keyset cursor"),
    limit:      int            = Query(20, le=20),
    category:   Optional[str] = None,
    skill:      Optional[str] = None,   # ← NEW: e.g. Python, React, OOP
    difficulty: Optional[str] = None,
    role:       Optional[str] = None,
    db: Session = Depends(get_db),
):
    # skill included in cache key to avoid collisions
    filters_str = f"{last_id}:{limit}:{category}:{skill}:{difficulty}:{role}"
    cache_key   = f"iq:list:{hashlib.md5(filters_str.encode()).hexdigest()}"

    cached = get_cache(cache_key)
    if cached:
        return cached

    query = db.query(
        InterviewQuestion.id,
        InterviewQuestion.title,
        InterviewQuestion.category,
        InterviewQuestion.skill,        # ← returned on list so frontend can group/label
        InterviewQuestion.difficulty,
        InterviewQuestion.roles,
    ).filter(
        InterviewQuestion.id > last_id,
    )

    if category:
        query = query.filter(InterviewQuestion.category == category)
    if skill:
        # Case-insensitive match — skill values are title-cased in DB (Python, React.js)
        query = query.filter(InterviewQuestion.skill.ilike(skill))
    if difficulty:
        query = query.filter(InterviewQuestion.difficulty == difficulty)
    if role:
        # ARRAY containment: 'Backend Engineer' = ANY(roles)
        query = query.filter(InterviewQuestion.roles.any(role))

    results = query.order_by(InterviewQuestion.id.asc()).limit(limit).all()

    items = [
        {
            "id":         r.id,
            "title":      r.title,
            "category":   r.category,
            "skill":      r.skill,
            "difficulty": r.difficulty,
            "roles":      r.roles,
        }
        for r in results
    ]

    response_data = {
        "items":       items,
        "next_cursor": items[-1]["id"] if items else None,
    }
    set_cache(cache_key, response_data, 3600)   # 1 h
    return response_data


@router.get("/interview/{question_id}")
def get_interview_question(question_id: int, db: Session = Depends(get_db)):
    cache_key = f"iq:q:{question_id}"
    cached = get_cache(cache_key)
    if cached:
        return cached

    q = db.query(InterviewQuestion).filter(InterviewQuestion.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    data = {
        "id":         q.id,
        "title":      q.title,
        "body":       q.body,
        "category":   q.category,
        "skill":      q.skill,          # ← included in detail response
        "difficulty": q.difficulty,
        "roles":      q.roles,
    }
    set_cache(cache_key, data, 43200)   # 12 h
    return data


# ─────────────────────────────────────────────────────────────────────────────
# Quiz MCQ
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/quiz")
def list_quiz_questions(
    last_id:    int            = Query(0, description="Keyset cursor"),
    limit:      int            = Query(20, le=20),
    section:    Optional[str] = None,
    topic:      Optional[str] = None,
    difficulty: Optional[str] = None,
    db: Session = Depends(get_db),
):
    filters_str = f"{last_id}:{limit}:{section}:{topic}:{difficulty}"
    cache_key   = f"quiz:list:{hashlib.md5(filters_str.encode()).hexdigest()}"

    cached = get_cache(cache_key)
    if cached:
        return cached

    query = db.query(QuizQuestion).filter(QuizQuestion.id > last_id)

    if section:
        query = query.filter(QuizQuestion.section == section)
    if topic:
        query = query.filter(QuizQuestion.topic == topic)
    if difficulty:
        query = query.filter(QuizQuestion.difficulty == difficulty)

    results = query.order_by(QuizQuestion.id.asc()).limit(limit).all()

    items = [
        {
            "id":         r.id,
            "section":    r.section,
            "topic":      r.topic,
            "difficulty": r.difficulty,
            "question":   r.question,
            "option_a":   r.option_a,
            "option_b":   r.option_b,
            "option_c":   r.option_c,
            "option_d":   r.option_d,
            # correct_ans deliberately omitted — sent only on /quiz/attempt response
        }
        for r in results
    ]

    response_data = {
        "items":       items,
        "next_cursor": items[-1]["id"] if items else None,
    }
    set_cache(cache_key, response_data, 3600)   # 1 h
    return response_data


# ─────────────────────────────────────────────────────────────────────────────
# DSA Progress  (per-user)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/stats/dsa")
def get_dsa_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cache_key = f"dsa:stats:{current_user.id}"
    cached = get_cache(cache_key)
    if cached:
        return cached

    total_target = db.query(func.count(DSAProblem.id)).scalar() or 0

    total_solved = (
        db.query(func.count(func.distinct(UserCodingProgress.dsa_id)))
        .filter(
            UserCodingProgress.user_id == current_user.id,
            UserCodingProgress.status  == "solved",
        )
        .scalar() or 0
    )

    diff_rows = (
        db.query(DSAProblem.difficulty, func.count(func.distinct(UserCodingProgress.dsa_id)))
        .join(UserCodingProgress, UserCodingProgress.dsa_id == DSAProblem.id)
        .filter(
            UserCodingProgress.user_id == current_user.id,
            UserCodingProgress.status  == "solved",
        )
        .group_by(DSAProblem.difficulty)
        .all()
    )
    diff_map = {row[0]: row[1] for row in diff_rows}

    # Consecutive-day streak
    rows = (
        db.query(cast(UserCodingProgress.created_at, Date))
        .filter(
            UserCodingProgress.user_id == current_user.id,
            UserCodingProgress.status  == "solved",
        )
        .distinct()
        .order_by(cast(UserCodingProgress.created_at, Date).desc())
        .limit(365)
        .all()
    )
    solve_dates = sorted({r[0] for r in rows}, reverse=True)
    streak, expected = 0, date.today()
    for d in solve_dates:
        if d == expected or d == expected - timedelta(days=1):
            streak  += 1
            expected = d - timedelta(days=1)
        else:
            break

    data = {
        "total_solved":  total_solved,
        "total_target":  total_target,
        "easy_solved":   diff_map.get("Easy",   diff_map.get("EASY",   0)),
        "medium_solved": diff_map.get("Medium", diff_map.get("MEDIUM", 0)),
        "hard_solved":   diff_map.get("Hard",   diff_map.get("HARD",   0)),
        "streak":        streak,
    }
    set_cache(cache_key, data, 300)     # 5 min
    return data


@router.get("/coding/{problem_id}/progress")
def get_coding_progress(
    problem_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = db.query(UserCodingProgress).filter(
        UserCodingProgress.user_id == current_user.id,
        UserCodingProgress.dsa_id  == problem_id,
    ).first()
    return {"status": record.status if record else None}


class ProgressUpdate(PydanticBase):
    status: str     # "solved" | "attempted"


@router.post("/coding/{problem_id}/progress", status_code=http_status.HTTP_200_OK)
def update_coding_progress(
    problem_id: int,
    body: ProgressUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(UserCodingProgress).filter(
        UserCodingProgress.user_id == current_user.id,
        UserCodingProgress.dsa_id  == problem_id,
    ).first()

    if existing:
        existing.status = body.status
    else:
        db.add(UserCodingProgress(
            user_id=current_user.id,
            dsa_id=problem_id,
            status=body.status,
        ))
    db.commit()

    delete_cache(f"dsa:stats:{current_user.id}")
    return {"success": True, "status": body.status}