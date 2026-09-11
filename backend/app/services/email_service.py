import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger("placementos.email")


def _send_smtp(to_email: str, subject: str, html_body: str, text_body: str) -> bool:
    if not settings.SMTP_HOST:
        logger.warning(
            "SMTP not configured — email to %s | subject: %s | verify link in logs above",
            to_email,
            subject,
        )
        logger.info("EMAIL BODY (dev):\n%s", text_body)
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        # Port 465 = implicit SSL (SMTP_SSL). Port 587/25 = STARTTLS.
        if settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM, [to_email], msg.as_string())
        logger.info("Email sent to %s: %s", to_email, subject)
        return True
    except Exception as exc:
        logger.exception("Failed to send email to %s", to_email)
        raise exc


def send_verification_email(to_email: str, full_name: str | None, raw_token: str) -> None:
    """App Flow §3.3 — dispatched as BackgroundTask after registration."""
    name = full_name or "there"
    verify_url = f"{settings.FRONTEND_URL}/auth/verify?token={raw_token}"
    subject = "Verify your PlacementOS account"
    text = (
        f"Hi {name},\n\n"
        f"Welcome to PlacementOS! Please verify your email by clicking the link below:\n\n"
        f"{verify_url}\n\n"
        f"This link expires in {settings.EMAIL_VERIFICATION_EXPIRE_HOURS} hours.\n\n"
        f"If you did not create an account, you can ignore this email.\n\n"
        f"— PlacementOS"
    )
    html = f"""
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#0ea5e9">Welcome to PlacementOS</h2>
      <p>Hi {name},</p>
      <p>Please verify your email to start your placement preparation journey.</p>
      <p><a href="{verify_url}" style="display:inline-block;background:#0ea5e9;color:#0f172a;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600">Verify my email</a></p>
      <p style="color:#64748b;font-size:13px">Or copy this link: {verify_url}</p>
      <p style="color:#64748b;font-size:13px">Link expires in {settings.EMAIL_VERIFICATION_EXPIRE_HOURS} hours.</p>
    </div>
    """
    logger.info("Verification link for %s: %s", to_email, verify_url)
    _send_smtp(to_email, subject, html, text)


def send_welcome_email(to_email: str, full_name: str | None) -> None:
    """App Flow §14.2 — send_welcome_notification (email companion)."""
    name = full_name or "there"
    dashboard_url = f"{settings.FRONTEND_URL}/dashboard"
    subject = "Welcome to PlacementOS — your roadmap is ready"
    text = (
        f"Hi {name},\n\n"
        f"Your onboarding is complete! Your personalized weekly plan is being prepared.\n\n"
        f"Open your dashboard: {dashboard_url}\n\n"
        f"— PlacementOS"
    )
    html = f"""
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#0ea5e9">You're all set!</h2>
      <p>Hi {name}, onboarding is complete. Your personalized roadmap and weekly planner are ready.</p>
      <p><a href="{dashboard_url}" style="display:inline-block;background:#0ea5e9;color:#0f172a;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600">Go to Dashboard</a></p>
    </div>
    """
    _send_smtp(to_email, subject, html, text)


def send_planner_reminder_email(to_email: str, full_name: str | None, task_title: str, due_label: str) -> None:
    """Planner reminder email — App Flow §5.6 (email digest companion to in-app notification)."""
    name = full_name or "there"
    planner_url = f"{settings.FRONTEND_URL}/planner"
    subject = f"Reminder: {task_title}"
    text = (
        f"Hi {name},\n\n"
        f"You have a planner task due {due_label}:\n\n"
        f"  • {task_title}\n\n"
        f"Open your planner: {planner_url}\n\n"
        f"— PlacementOS"
    )
    html = f"""
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#0ea5e9">Planner reminder</h2>
      <p>Hi {name}, you have a task due <strong>{due_label}</strong>:</p>
      <p style="background:#0f172a;padding:16px;border-radius:12px;color:#e2e8f0">{task_title}</p>
      <p><a href="{planner_url}" style="display:inline-block;background:#0ea5e9;color:#0f172a;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600">Open Planner</a></p>
    </div>
    """
    _send_smtp(to_email, subject, html, text)


def send_roadmap_ready_email(to_email: str, full_name: str | None) -> None:
    """App Flow §5.7 — plan ready notification email."""
    name = full_name or "there"
    planner_url = f"{settings.FRONTEND_URL}/planner"
    subject = "Your weekly roadmap is ready"
    text = f"Hi {name},\n\nYour personalized weekly plan has been generated.\n\nView it: {planner_url}\n\n— PlacementOS"
    html = f"""
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#0ea5e9">Your roadmap is ready</h2>
      <p>Hi {name}, your personalized weekly plan has been generated.</p>
      <p><a href="{planner_url}" style="display:inline-block;background:#0ea5e9;color:#0f172a;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600">View Weekly Plan</a></p>
    </div>
    """
    _send_smtp(to_email, subject, html, text)
