from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.api import deps
from app.db.session import get_db
from app.models.user import User
from app.models.mentor import MentorConversation, MentorMessage
from app.services.context_builder import build_user_context
from app.services.ai_service import generate_mentor_response_async


router = APIRouter()


class MessageRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None
    seed_context: Optional[dict] = None


class MessageResponse(BaseModel):
    conversation_id: int
    user_message: dict
    assistant_message: dict


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
        .order_by(MentorMessage.created_at.asc())
        .all()
    )
    return ConversationDetail(
        id=convo.id,
        title=convo.title,
        messages=[
            {"id": m.id, "role": m.role, "content": m.content, "created_at": m.created_at.isoformat()}
            for m in messages
        ],
    )


@router.post("/message", response_model=MessageResponse)
async def send_message(
    body: MessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):


    if not body.message.strip():
        raise HTTPException(status_code=422, detail="Message cannot be empty")

    convo = None
    if body.conversation_id:
        convo = db.query(MentorConversation).filter(
            MentorConversation.id == body.conversation_id,
            MentorConversation.user_id == current_user.id,
        ).first()
        if not convo:
            raise HTTPException(status_code=404, detail="Conversation not found")

    if not convo:
        title = body.message[:60] + ("..." if len(body.message) > 60 else "")
        convo = MentorConversation(user_id=current_user.id, title=title)
        db.add(convo)
        db.flush()

    history_msgs = (
        db.query(MentorMessage)
        .filter(MentorMessage.conversation_id == convo.id)
        .order_by(MentorMessage.created_at.asc())
        .all()
    )
    history = [{"role": m.role, "content": m.content} for m in history_msgs]

    user_msg = MentorMessage(
        conversation_id=convo.id,
        user_id=current_user.id,
        role="user",
        content=body.message.strip(),
    )
    db.add(user_msg)
    db.flush()
    
    context = build_user_context(db, current_user, body.seed_context)
    reply_text = await generate_mentor_response_async(
        context,
        body.message.strip(),
        history,
    )

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

    return MessageResponse(
        conversation_id=convo.id,
        user_message={"id": user_msg.id, "role": "user", "content": user_msg.content},
        assistant_message={"id": assistant_msg.id, "role": "assistant", "content": assistant_msg.content},
    )
