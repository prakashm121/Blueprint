"""Canonical outbox event type constants — stable across worker backends."""

EMAIL_VERIFICATION = "email.verification"
EMAIL_WELCOME = "email.welcome"
EMAIL_ROADMAP_READY = "email.roadmap_ready"
EMAIL_PLANNER_REMINDER = "email.planner_reminder"

NOTIFICATION_WELCOME = "notification.welcome"
NOTIFICATION_ROADMAP_READY = "notification.roadmap_ready"
NOTIFICATION_PLANNER_REMINDER = "notification.planner_reminder"

PLANNER_TASK_COMPLETED = "planner.task_completed"
