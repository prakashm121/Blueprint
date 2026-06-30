from datetime import datetime, timezone
import json

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.api import deps
from app.db.session import get_db
from app.models.user import User
from app.models.assessment import UserSkillAssessment
from app.models.planner_generation import PlannerGeneration
from app.workers.dispatch import dispatch_roadmap_generation
from app.workers.outbox import enqueue_outbox
from app.workers import event_types as ET

router = APIRouter()

ASSESSMENT_SUBJECTS = [
    {"key": "operating_systems", "label": "Operating Systems"},
    {"key": "dbms", "label": "DBMS"},
    {"key": "computer_networks", "label": "Computer Networks"},
    {"key": "system_design", "label": "System Design"},
]

ASSESSMENT_DSA = [
    {"key": "arrays_strings", "label": "Arrays & Strings"},
    {"key": "trees_graphs", "label": "Trees & Graphs"},
    {"key": "dynamic_programming", "label": "Dynamic Programming"},
    {"key": "sorting_searching", "label": "Sorting & Searching"},
]

TARGET_ROLES = [
    "Backend Engineer",
    "Full Stack Engineer",
    "Data Engineer",
    "Frontend Engineer",
    "DevOps Engineer",
    "Software Engineer",
]

SAMPLE_COMPANIES = [
    "Google", "Microsoft", "Amazon", "Flipkart", "Atlassian",
    "Razorpay", "PhonePe", "Swiggy", "Zomato", "Goldman Sachs",
]


class AssessmentItem(BaseModel):
    skill_key: str
    skill_type: str
    self_rated_confidence: int = Field(ge=0, le=100)


class AssessmentRequest(BaseModel):
    responses: list[AssessmentItem]


class GoalsRequest(BaseModel):
    target_role: str
    target_companies: list[str] = []


class StepResponse(BaseModel):
    onboarding_step: str


class GenerationResponse(BaseModel):
    planner_generation_id: int
    status: str


class GenerationStatusResponse(BaseModel):
    id: int
    status: str
    generated_by: str
    weekly_plan_id: int | None = None


class AssessmentCatalog(BaseModel):
    subjects: list[dict]
    dsa_topics: list[dict]
    target_roles: list[str]
    sample_companies: list[str]


@router.get("/catalog", response_model=AssessmentCatalog)
def get_onboarding_catalog():
    return AssessmentCatalog(
        subjects=ASSESSMENT_SUBJECTS,
        dsa_topics=ASSESSMENT_DSA,
        target_roles=TARGET_ROLES,
        sample_companies=SAMPLE_COMPANIES,
    )


@router.get("/status")
def get_onboarding_status(
    current_user: User = Depends(deps.get_current_active_user),
):
    return {
        "onboarding_step": current_user.onboarding_step,
        "onboarding_completed": current_user.onboarding_step == "completed",
        "target_role": current_user.target_role,
    }


@router.post("/assessment", response_model=StepResponse)
def submit_assessment(
    body: AssessmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    db.query(UserSkillAssessment).filter(UserSkillAssessment.user_id == current_user.id).delete()

    for item in body.responses:
        db.add(UserSkillAssessment(
            user_id=current_user.id,
            skill_key=item.skill_key,
            skill_type=item.skill_type,
            self_rated_confidence=item.self_rated_confidence,
        ))

    current_user.onboarding_step = "goals"
    db.commit()
    return StepResponse(onboarding_step="goals")


@router.post("/goals", response_model=StepResponse)
def submit_goals(
    body: GoalsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    current_user.target_role = body.target_role
    current_user.target_companies = json.dumps(body.target_companies[:5])
    current_user.onboarding_step = "generate_roadmap"
    db.commit()
    return StepResponse(onboarding_step="generate_roadmap")


@router.post("/generate-roadmap", status_code=202, response_model=GenerationResponse)
def trigger_roadmap_generation(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    existing = (
        db.query(PlannerGeneration)
        .filter(
            PlannerGeneration.user_id == current_user.id,
            PlannerGeneration.status.in_(["queued", "processing"]),
        )
        .first()
    )
    if existing:
        return GenerationResponse(planner_generation_id=existing.id, status=existing.status)

    generation = PlannerGeneration(user_id=current_user.id, status="queued")
    db.add(generation)
    current_user.onboarding_step = "completed"
    current_user.onboarding_completed_at = datetime.now(timezone.utc)

    name = current_user.profile.full_name if current_user.profile else current_user.full_name
    welcome_key = f"onboarding-welcome:{current_user.id}"
    enqueue_outbox(
        db,
        ET.NOTIFICATION_WELCOME,
        {"user_id": current_user.id},
        idempotency_key=f"{welcome_key}:notification",
    )
    enqueue_outbox(
        db,
        ET.EMAIL_WELCOME,
        {"email": current_user.email, "full_name": name},
        idempotency_key=f"{welcome_key}:email",
    )

    db.commit()
    db.refresh(generation)

    dispatch_roadmap_generation(generation.id, background_tasks)
    return GenerationResponse(planner_generation_id=generation.id, status="queued")


@router.get("/roadmap-status/{generation_id}", response_model=GenerationStatusResponse)
def get_roadmap_status(
    generation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    generation = db.query(PlannerGeneration).filter(
        PlannerGeneration.id == generation_id,
        PlannerGeneration.user_id == current_user.id,
    ).first()
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")
    return GenerationStatusResponse(
        id=generation.id,
        status=generation.status,
        generated_by=generation.generated_by,
        weekly_plan_id=generation.weekly_plan_id,
    )
