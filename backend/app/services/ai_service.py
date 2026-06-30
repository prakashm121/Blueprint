import asyncio
import json

import google.generativeai as genai

from app.core.config import settings

genai.configure(api_key=settings.GEMINI_API_KEY)

roadmap_model = genai.GenerativeModel(settings.GEMINI_MODEL)

# Gemini SDK is synchronous; this semaphore limits concurrent Gemini calls per API process
# to protect latency and avoid overwhelming the external provider.
_GEMINI_SEMAPHORE = asyncio.Semaphore(int(getattr(settings, "GEMINI_CONCURRENCY", 10)))


def generate_mentor_response(
    context: dict,
    message: str,
    history: list[dict],
) -> str:
    try:
        return _call_gemini(context, message, history)
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise e


async def generate_mentor_response_async(
    context: dict,
    message: str,
    history: list[dict],
) -> str:
    timeout_s = float(getattr(settings, "GEMINI_REQUEST_TIMEOUT", 45.0))
    async with _GEMINI_SEMAPHORE:
        return await asyncio.wait_for(
            asyncio.to_thread(generate_mentor_response, context, message, history),
            timeout=timeout_s,
        )


def _call_gemini(
    context: dict,
    message: str,
    history: list[dict],
) -> str:

    profile = context.get("profile", {})
    weak = ", ".join(context.get("weak_areas", [])) or "None"

    prompt = f"""
You are PlacementOS AI Mentor.

You are helping an engineering student prepare for placements.

Student Profile

Name: {profile.get("full_name","Student")}
College: {profile.get("college","Unknown")}
Target Role: {profile.get("target_role","Software Engineer")}
Weak Areas: {weak}

Conversation History
"""

    for turn in history[-6:]:
        role = turn["role"].capitalize()
        prompt += f"\n{role}: {turn['content']}"

    prompt += f"""

User:
{message}

Give a personalized answer.

Keep it practical.

Do not be generic.

Answer in 2-4 short paragraphs.
"""

    response = roadmap_model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            temperature=settings.GEMINI_TEMPERATURE,
            top_p=settings.GEMINI_TOP_P,
            top_k=settings.GEMINI_TOP_K,
            max_output_tokens=settings.GEMINI_MAX_TOKENS,
        ),
    )

    return response.text.strip()


def _fallback_response(context: dict, message: str) -> str:
    profile = context.get("profile", {})
    role = profile.get("target_role") or "your target role"
    weak = context.get("weak_areas", [])
    msg_lower = message.lower()

    if any(w in msg_lower for w in ("resume", "cv")):
        return (
            f"For {role} roles, keep your resume to one page with 3-4 strong projects. "
            "Lead each bullet with impact (metrics, scale, outcomes). "
            "Tailor keywords from job descriptions and highlight tools relevant to backend/system design."
        )
    if any(w in msg_lower for w in ("dsa", "coding", "leetcode", "interview")):
        weak_hint = f" Focus extra time on {weak[0]}." if weak else ""
        return (
            f"For coding interviews targeting {role}, practice 2-3 medium problems daily.{weak_hint} "
            "Use a pattern-based approach: identify the pattern first, then code. "
            "Always explain your thought process aloud — interviewers care about reasoning as much as the solution."
        )
    if any(w in msg_lower for w in ("company", "placement", "ready")):
        companies = profile.get("target_companies") or []
        co_hint = f" For {companies[0]}, research their tech stack and recent engineering blog posts." if companies else ""
        return (
            f"To assess readiness for {role},{co_hint} "
            "Map your skills against typical requirements: DSA, core subjects, projects, and system design basics. "
            "Use your weekly planner to close the biggest gaps first."
        )

    return (
        f"Great question! As you prepare for {role}, prioritize consistent weekly progress over cramming. "
        "Break preparation into DSA practice, core subjects, projects, and mock interviews. "
        "Check your planner for this week's tasks and tackle the highest-priority items first."
    )


def generate_ai_roadmap(user) -> dict:
    """Generate a personalized weekly roadmap using Gemini.

    Returns:
        {"title": "...", "description": "...", "tasks": [...]}\n
    Notes:
      - Kept synchronous because it is used by ARQ worker/background execution.
    """

    profile = user.profile

    prompt = f"""
You are an expert placement mentor.

Create a personalized weekly roadmap for this student.

Student Details

Name: {user.full_name}

Target Role: {user.target_role or "Software Engineer"}

College: {getattr(profile, "college", "Unknown")}

Branch: {getattr(profile, "branch", "Unknown")}

CGPA: {getattr(profile, "cgpa", "Unknown")}

Graduation Year: {getattr(profile, "graduation_year", "Unknown")}

Skills:
{getattr(profile, "skills", "Unknown")}

Projects:
{getattr(profile, "projects", "Unknown")}

Weak Subjects:
{getattr(profile, "weak_subjects", "Unknown")}

Target Companies:
{getattr(profile, "target_companies", "Unknown")}

Requirements:

- Create exactly 7-10 tasks.
- Distribute tasks across the week.
- Prioritize weak areas.
- Balance DSA, Core Subjects, Projects, Resume and Interview preparation.
- estimated_minutes must be between 30 and 180.
- priority must be High, Medium or Low.

Return ONLY valid JSON.

{{
    "title":"...",
    "description":"...",
    "tasks":[
        {{
            "title":"...",
            "category":"DSA",
            "priority":"High",
            "estimated_minutes":90,
            "day":1
        }}
    ]
}}
"""

    response = roadmap_model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=settings.GEMINI_TEMPERATURE,
            top_p=settings.GEMINI_TOP_P,
            top_k=settings.GEMINI_TOP_K,
            max_output_tokens=settings.GEMINI_MAX_TOKENS,
        ),
    )

    print("Gemini response:", response.text)
    if not response.text:
        raise RuntimeError("Gemini returned an empty response.")

    text = response.text.strip()

    if text.startswith("```json"):
        text = text[7:]

    if text.startswith("```"):
        text = text[3:]

    if text.endswith("```"):
        text = text[:-3]

    try:
        roadmap = json.loads(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid JSON returned from Gemini:\n{text}") from exc

    required_keys = {"title", "description", "tasks"}

    if not required_keys.issubset(roadmap):
        raise RuntimeError("Gemini returned incomplete roadmap.")

    if not isinstance(roadmap["tasks"], list):
        raise RuntimeError("Tasks must be a list.")

    return roadmap

