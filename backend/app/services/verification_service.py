from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core import security
from app.core.config import settings
from app.models.email_verification import EmailVerification
from app.models.user import User


def create_verification_record(db: Session, user: User) -> str:
    """Persist token hash and return raw token for outbox email handler."""
    raw_token, token_hash = security.generate_verification_token()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.EMAIL_VERIFICATION_EXPIRE_HOURS)

    db.query(EmailVerification).filter(
        EmailVerification.user_id == user.id,
        EmailVerification.used_at.is_(None),
    ).delete()

    db.add(EmailVerification(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
    ))
    return raw_token


def verify_email_token(db: Session, raw_token: str) -> tuple[bool, str]:
    """
    Verify email using a single-use token.
    Fully idempotent and deterministic.
    """

    now = datetime.now(timezone.utc)
    token_hash = security.hash_verification_token(raw_token)

    # 1. Find token record
    record = (
        db.query(EmailVerification)
        .filter(EmailVerification.token_hash == token_hash)
        .first()
    )

    if record is None:
        return False, "Invalid verification link."

    # 2. Load user
    user = db.query(User).filter(User.id == record.user_id).first()
    if user is None:
        return False, "User account not found."

    # 3. Already verified (single source of truth: user)
    if user.email_verified:
        return True, "Email already verified."

    # 4. Expiry check
    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if now > expires_at:
        return False, "Verification link expired."

    # 5. Already used token check
    if record.used_at is not None:
        return False, "Verification link already used."

    # 6. Apply verification atomically
    user.email_verified = True
    record.used_at = now

    db.commit()

    return True, "Email verified successfully."