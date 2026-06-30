from datetime import date, timedelta, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from app.api import deps
from app.db.session import get_db
from app.models.user import User
from app.models.planner import WeeklyPlan, PlannerTask
from app.workers.outbox import enqueue_outbox
from app.workers import event_types as ET

router = APIRouter()


# --- Schemas ---

class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    category: str
    priority: str
    status: str
    estimated_minutes: Optional[int]
    display_order: int

    class Config:
        from_attributes = True


class PlanResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    week_number: int
    start_date: date
    end_date: date
    status: str
    completion_percentage: float
    total_tasks: int
    completed_tasks: int
    tasks: List[TaskResponse]

    class Config:
        from_attributes = True


class PlanCreate(BaseModel):
    title: str
    description: Optional[str] = None


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str = "Custom"
    priority: str = "Medium"
    estimated_minutes: Optional[int] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    estimated_minutes: Optional[int] = None


# --- Endpoints ---

@router.get("/plans", response_model=Optional[PlanResponse])
def get_active_plan(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    plan = (
        db.query(WeeklyPlan)
        .filter(WeeklyPlan.user_id == current_user.id, WeeklyPlan.status == "active")
        .first()
    )
    if not plan:
        return None
    return plan


@router.get("/plans/all", response_model=List[PlanResponse])
def get_all_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    plans = (
        db.query(WeeklyPlan)
        .filter(WeeklyPlan.user_id == current_user.id)
        .order_by(WeeklyPlan.created_at.desc())
        .all()
    )
    return plans


@router.post("/plans", response_model=PlanResponse)
def create_plan(
    plan_in: PlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    # Archive any existing active plan
    existing = (
        db.query(WeeklyPlan)
        .filter(WeeklyPlan.user_id == current_user.id, WeeklyPlan.status == "active")
        .first()
    )
    if existing:
        existing.status = "archived"
        db.add(existing)

    today = date.today()
    iso_cal = today.isocalendar()

    plan = WeeklyPlan(
        user_id=current_user.id,
        title=plan_in.title or f"Week {iso_cal[1]} Plan",
        description=plan_in.description,
        week_number=iso_cal[1],
        start_date=today,
        end_date=today + timedelta(days=6),
        generation_source="manual",
        status="active",
    )
    db.add(plan)
    db.flush()

    # Seed with some starter tasks
    default_tasks = [
        {"title": "Review DSA fundamentals", "category": "DSA", "priority": "High", "estimated_minutes": 60},
        {"title": "Update resume with latest project", "category": "Resume", "priority": "Medium", "estimated_minutes": 45},
        {"title": "Practice system design concepts", "category": "Subjects", "priority": "Medium", "estimated_minutes": 50},
        {"title": "Solve 2 LeetCode problems", "category": "DSA", "priority": "High", "estimated_minutes": 90},
        {"title": "Review company preparation notes", "category": "Company Preparation", "priority": "Low", "estimated_minutes": 30},
    ]

    for i, task_data in enumerate(default_tasks):
        task_due = datetime.combine(
            today + timedelta(days=min(i + 1, 6)),
            datetime.min.time(),
            tzinfo=timezone.utc,
        )
        task = PlannerTask(
            weekly_plan_id=plan.id,
            user_id=current_user.id,
            title=task_data["title"],
            category=task_data["category"],
            priority=task_data["priority"],
            estimated_minutes=task_data["estimated_minutes"],
            reminder_enabled=True,
            due_date=task_due,
            display_order=i,
        )
        db.add(task)

    plan.total_tasks = len(default_tasks)
    db.commit()
    db.refresh(plan)
    return plan


@router.post("/plans/{plan_id}/tasks", response_model=TaskResponse)
def add_task(
    plan_id: int,
    task_in: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    plan = db.query(WeeklyPlan).filter(
        WeeklyPlan.id == plan_id, WeeklyPlan.user_id == current_user.id
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    max_order = (
        db.query(PlannerTask.display_order)
        .filter(PlannerTask.weekly_plan_id == plan_id)
        .order_by(PlannerTask.display_order.desc())
        .first()
    )
    next_order = (max_order[0] + 1) if max_order else 0

    task = PlannerTask(
        weekly_plan_id=plan.id,
        user_id=current_user.id,
        title=task_in.title,
        description=task_in.description,
        category=task_in.category,
        priority=task_in.priority,
        estimated_minutes=task_in.estimated_minutes,
        display_order=next_order,
    )
    db.add(task)
    plan.total_tasks = (plan.total_tasks or 0) + 1
    db.commit()
    db.refresh(task)
    return task


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    task_in: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    task = db.query(PlannerTask).filter(
        PlannerTask.id == task_id, PlannerTask.user_id == current_user.id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    was_completed = task.status == "Completed"
    update_data = task_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)

    # Update plan completion counters
    now_completed = task.status == "Completed"
    if not was_completed and now_completed:
        plan = db.query(WeeklyPlan).get(task.weekly_plan_id)
        if plan:
            plan.completed_tasks = (plan.completed_tasks or 0) + 1
            if plan.total_tasks and plan.total_tasks > 0:
                plan.completion_percentage = round(
                    (plan.completed_tasks / plan.total_tasks) * 100, 2
                )
    elif was_completed and not now_completed:
        plan = db.query(WeeklyPlan).get(task.weekly_plan_id)
        if plan:
            plan.completed_tasks = max(0, (plan.completed_tasks or 0) - 1)
            if plan.total_tasks and plan.total_tasks > 0:
                plan.completion_percentage = round(
                    (plan.completed_tasks / plan.total_tasks) * 100, 2
                )

    if not was_completed and now_completed:
        enqueue_outbox(
            db,
            ET.PLANNER_TASK_COMPLETED,
            {"user_id": current_user.id, "task_id": task.id},
            idempotency_key=f"planner-completed:{task.id}",
        )

    db.commit()
    db.refresh(task)
    return task


@router.delete("/tasks/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    task = db.query(PlannerTask).filter(
        PlannerTask.id == task_id, PlannerTask.user_id == current_user.id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    plan = db.query(WeeklyPlan).get(task.weekly_plan_id)
    if plan:
        plan.total_tasks = max(0, (plan.total_tasks or 0) - 1)
        if task.status == "Completed":
            plan.completed_tasks = max(0, (plan.completed_tasks or 0) - 1)
        if plan.total_tasks and plan.total_tasks > 0:
            plan.completion_percentage = round(
                (plan.completed_tasks / plan.total_tasks) * 100, 2
            )
        else:
            plan.completion_percentage = 0

    db.delete(task)
    db.commit()
    return {"ok": True}
