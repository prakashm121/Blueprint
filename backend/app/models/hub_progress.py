from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Index
from sqlalchemy.sql import func
from app.db.session import Base

class UserQuizAttempt(Base):
    __tablename__ = "user_quiz_attempts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    quiz_id = Column(Integer, ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False)
    is_correct = Column(Boolean, nullable=False)
    selected_option = Column(String(10))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    __table_args__ = (
        Index('idx_user_quiz_uid', 'user_id'),
        Index('idx_user_quiz_uid_qid', 'user_id', 'quiz_id'),
        Index('idx_user_quiz_uid_correct', 'user_id', 'is_correct'),
    )

class UserCodingProgress(Base):
    __tablename__ = "user_coding_progress"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    dsa_id = Column(Integer, ForeignKey("dsa_problems.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), nullable=False) # e.g., 'attempted', 'solved'
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    __table_args__ = (
        Index('idx_user_coding_uid', 'user_id'),
        Index('idx_user_coding_uid_qid', 'user_id', 'dsa_id'),
        Index('idx_user_coding_uid_status', 'user_id', 'status'),
    )

class UserQuestionProgress(Base):
    __tablename__ = "user_question_progress"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    interview_q_id = Column(Integer, ForeignKey("interview_questions.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), nullable=False) # e.g., 'viewed', 'mastered'
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    __table_args__ = (
        Index('idx_user_iq_uid', 'user_id'),
        Index('idx_user_iq_uid_qid', 'user_id', 'interview_q_id'),
        Index('idx_user_iq_uid_status', 'user_id', 'status'),
    )
