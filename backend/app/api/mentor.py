import re
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.api import deps
from app.core.cache import get_cache, set_cache, delete_cache, redis_client
from app.db.session import get_db
from app.models.user import User
from app.models.mentor import MentorConversation, MentorMessage
from app.services.context_builder import build_mentor_context, build_teacher_context
from app.services.ai_service import generate_mentor_response_async


router = APIRouter()

# ---------------------------------------------------------------------------
# Teaching keyword detection
# ---------------------------------------------------------------------------

TEACHING_TRIGGERS = re.compile(
    r"\b(teach|explain|what is|what are|how does|how do|tell me about|help me understand)\b",
    re.IGNORECASE,
)


def _extract_teach_topic(message: str) -> Optional[str]:
    """Return a cleaned topic string if the message looks like a teaching request."""
    if not TEACHING_TRIGGERS.search(message):
        return None
    # Strip common lead-ins and return the remainder as the topic
    stripped = re.sub(
        r"(?i)^(teach me (about|how to use|what is)?|explain|what is|what are|how does|how do|tell me about|help me understand)\s*:?\s*",
        "",
        message.strip(),
    )
    return stripped.strip() or None


# ---------------------------------------------------------------------------
# Rate limiting helper
# ---------------------------------------------------------------------------

#def _check_rate_limit(user_id: int, limit: int = 15, window_seconds: int = 60):
#    """Sliding window rate limit. Raises 429 if exceeded."""
 #   if not redis_client:
 #       return  # Redis unavailable — skip rate limiting gracefully
#    key = f"mentor:ratelimit:{user_id}"
#    count = redis_client.incr(key)
#    if count == 1:
#        redis_client.expire(key, window_seconds)
#    if count > limit:
#        raise HTTPException(
#            status_code=429,
 #           detail="Message rate limit reached. Please wait a moment.",
#            headers={"Retry-After": str(window_seconds)},
#        )


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class CreateConversationRequest(BaseModel):
    title: Optional[str] = "New conversation"


class MessageRequest(BaseModel):
    content: str
    seed_context: Optional[dict] = None


class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: str


class ConversationSummary(BaseModel):
    id: int
    title: str
    updated_at: str

    class Config:
        from_attributes = True


class ConversationDetail(BaseModel):
    id: int
    title: str
    messages: list[dict]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/conversations", response_model=list[ConversationSummary])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    convos = (
        db.query(MentorConversation)
        .filter(MentorConversation.user_id == current_user.id)
        .order_by(MentorConversation.updated_at.desc())
        .limit(20)
        .all()
    )
    return [
        ConversationSummary(
            id=c.id,
            title=c.title,
            updated_at=c.updated_at.isoformat() if c.updated_at else "",
        )
        for c in convos
    ]


@router.post("/conversations")
def create_conversation(
    body: CreateConversationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    convo = MentorConversation(
        user_id=current_user.id,
        title=body.title or "New conversation",
    )
    db.add(convo)
    db.commit()
    db.refresh(convo)
    return {"id": convo.id, "title": convo.title}


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    convo = db.query(MentorConversation).filter(
        MentorConversation.id == conversation_id,
        MentorConversation.user_id == current_user.id,
    ).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = (
        db.query(MentorMessage)
        .filter(MentorMessage.conversation_id == convo.id)
        .order_by(MentorMessage.created_at.asc(), MentorMessage.id.asc())
        .all()
    )
    return ConversationDetail(
        id=convo.id,
        title=convo.title,
        messages=[
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
    )


@router.post("/conversations/{conversation_id}/message")
async def send_message(
    conversation_id: int,
    body: MessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    trimmed = (body.content or "").strip()
    if not trimmed:
        raise HTTPException(status_code=422, detail="Message cannot be empty")

    # Rate limit: 15 messages per minute
    #_check_rate_limit(current_user.id, limit=15, window_seconds=60)

    convo = db.query(MentorConversation).filter(
        MentorConversation.id == conversation_id,
        MentorConversation.user_id == current_user.id,
    ).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Fetch last 6 messages as history
    history_msgs = (
        db.query(MentorMessage)
        .filter(MentorMessage.conversation_id == convo.id)
        .order_by(MentorMessage.created_at.asc(), MentorMessage.id.asc())
        .limit(20)
        .all()
    )
    history = [{"role": m.role, "content": m.content} for m in history_msgs]

    # Detect teaching intent and build appropriate context
    teach_topic = _extract_teach_topic(trimmed)
    if teach_topic:
        # Teacher mode: daily-quota rate limit (20/day)
        if redis_client:
            teacher_key = f"teacher:ratelimit:{current_user.id}:{datetime.utcnow().date().isoformat()}"
            t_count = redis_client.incr(teacher_key)
            if t_count == 1:
                # TTL until midnight
                from datetime import date
                import time
                midnight = datetime.combine(
                    date.today() + timedelta(days=1), datetime.min.time()
                )
                secs = int((midnight - datetime.utcnow()).total_seconds())
                redis_client.expire(teacher_key, max(secs, 1))
            if t_count > 20:
                raise HTTPException(
                    429, "Daily teaching limit reached. Try again tomorrow."
                )

        # Check explanation cache (shared across users, 24 hr)
        import hashlib
        topic_hash = hashlib.md5(teach_topic.lower().strip().encode()).hexdigest()
        explain_key = f"teacher:explain:{topic_hash}"
        cached_explain = get_cache(explain_key)

        if cached_explain:
            reply_text = cached_explain
        else:
            teacher_ctx = build_teacher_context(db, current_user, teach_topic)
            # Build a teacher-specific prompt and call Gemini
            teach_prompt = (
                f"Teach the following topic at {teacher_ctx['student_proficiency']} level for a student "
                f"targeting {teacher_ctx['target_role']}:\n\nTopic: {teach_topic}\n\n"
                f"Structure:\n1. Core concept (2-3 sentences)\n2. How it works (with code example if applicable)\n"
                f"3. Common interview angle using these questions: {teacher_ctx['example_interview_questions']}\n"
                f"4. What to practice next\n"
            )
            if teacher_ctx["related_dsa_problems"]:
                teach_prompt += f"\nRelated problems: {teacher_ctx['related_dsa_problems']}\n"
            teach_prompt += "\nKeep it under 400 words. Be direct and practical."
            reply_text = await generate_mentor_response_async({}, teach_prompt, history)
            set_cache(explain_key, reply_text, 86400)  # 24 hr
    else:
        # Standard mentor mode: use cached context
        context = build_mentor_context(db, current_user)
        # Inject tone instruction into the message for _call_gemini
        tone_instruction = context.get("accountability", {}).get("tone_instruction", "")
        augmented_message = f"[Tone: {tone_instruction}]\n\n{trimmed}" if tone_instruction else trimmed
        reply_text = await generate_mentor_response_async(context, augmented_message, history)

    # Save both messages
    user_msg = MentorMessage(
        conversation_id=convo.id,
        user_id=current_user.id,
        role="user",
        content=trimmed,
    )
    db.add(user_msg)
    db.flush()

    assistant_msg = MentorMessage(
        conversation_id=convo.id,
        user_id=current_user.id,
        role="assistant",
        content=reply_text,
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(user_msg)
    db.refresh(assistant_msg)

    return {
        "id": assistant_msg.id,
        "role": "assistant",
        "content": assistant_msg.content,
        "created_at": assistant_msg.created_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# Legacy endpoint (kept for backwards compat if anything still calls /message)
# ---------------------------------------------------------------------------

@router.post("/message")
async def send_message_legacy(
    body,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    raise HTTPException(
        status_code=410,
        detail="Use POST /api/v1/mentor/conversations/{id}/message instead.",
    )
