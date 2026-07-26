"""
ai_service.py — All Gemini AI interactions.
Each function targets a specific feature: mentor chat, weekly task generation, daily breakdown, and role roadmap.
"""
import asyncio
import json

import google.generativeai as genai

from app.core.config import settings

genai.configure(api_key=settings.GEMINI_API_KEY)

# Single model instance reused across all features
roadmap_model = genai.GenerativeModel(settings.GEMINI_MODEL)

# Limits concurrent Gemini calls per process to protect latency
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

    tone = context.get("tone_instruction", "Act as a patient, encouraging teacher who explains concepts clearly.")
    
    prompt = f"""
You are PlacementOS AI, acting as a hybrid Career Mentor and Expert Teacher for an engineering student preparing for placements.

Student Profile
Name: {profile.get("full_name","Student")}
College: {profile.get("college","Unknown")}
Target Role: {profile.get("target_role","Software Engineer")}
Weak Areas: {weak}

Persona Instructions:
1. When the student asks technical questions or needs help understanding a topic: Act as an expert, patient TEACHER. Break down complex concepts clearly and provide highly educational, easy-to-understand explanations.
2. When the student asks about planning, career advice, or their schedule: Act as a Career MENTOR. Apply the following tone based on their current progress:
   -> Mentor Tone: {tone}

Important: Never be aggressive, harsh, or condescending. Always remain supportive.

Conversation History
"""

    for turn in history[-6:]:
        role = turn["role"].capitalize()
        prompt += f"\n{role}: {turn['content']}"

    prompt += f"""

User:
{message}

Give a personalized answer. Keep it practical and highly educational. Answer in 2-4 short paragraphs.
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


def _parse_gemini_json(text: str) -> any:
    """Strip markdown code fences from Gemini JSON responses, then parse."""
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return json.loads(text)


async def generate_weekly_tasks_async(
    ctx: dict,
    carry_over_titles: list[str],
    new_count: int,
) -> list[dict]:
    """
    Generate new weekly tasks using the AI.

    Args:
        ctx: Pre-built context from build_weekly_plan_context() — includes
             profile, progress (readiness, planner completion, dsa solved),
             weak_areas, and completed_task_titles.
        carry_over_titles: Task titles being carried over from last week.
        new_count: How many new tasks to generate.
    """
    profile   = ctx.get("profile", {})
    progress  = ctx.get("progress", {})
    weak_areas = ctx.get("weak_areas", [])
    done_titles = ctx.get("completed_task_titles", [])

    target_role       = profile.get("target_role", "Software Engineer")
    target_companies  = ", ".join(profile.get("target_companies", [])) or "Not specified"
    college           = profile.get("college", "Unknown")
    specialization    = profile.get("specialization", "Unknown")
    grad_year         = profile.get("graduation_year", "Unknown")

    readiness     = progress.get("readiness_score", 0)
    plan_done_pct = progress.get("planner_completion", 0)
    dsa_solved    = progress.get("dsa_solved", 0)

    completed_str   = "\n".join(f"- {t}" for t in done_titles) if done_titles else "None yet"
    carry_str       = "\n".join(f"- {t}" for t in carry_over_titles) if carry_over_titles else "None"
    weak_str        = ", ".join(weak_areas) if weak_areas else "None identified"

    prompt = f"""You are an expert AI Career Coach.

## Student Profile
- Target Role: {target_role}
- Target Companies: {target_companies}
- College: {college} | {specialization} | Graduation: {grad_year}

## Current Progress
- Readiness Score: {readiness:.0f}/100
- Last week planner completion: {plan_done_pct:.0f}%
- DSA problems solved: {dsa_solved}

## Task History
### Carrying over from last week (DO NOT duplicate):
{carry_str}

### Already completed in past weeks (DO NOT repeat these topics):
{completed_str}

### Weak areas to prioritize:
{weak_str}

## Instructions
Generate exactly {new_count} NEW tasks for this week that:
1. Do NOT repeat any carried-over or already-completed topics.
2. Prioritize the student's weak areas.
3. Are specific and actionable (not generic).
4. Are relevant to the target role: {target_role}.
5. Are balanced across: DSA, Core Subjects, Resume, Projects, Company Preparation.

Return a JSON array of exactly {new_count} objects:
[
  {{
    "title": "Specific actionable task title",
    "category": "DSA",
    "priority": "High",
    "estimated_minutes": 60
  }}
]

Category must be one of: DSA, Subjects, Resume, Projects, Company Preparation, Mock Interview, Custom.
priority must be one of: High, Medium, Low.
"""
    try:
        timeout_s = float(getattr(settings, "GEMINI_REQUEST_TIMEOUT", 45.0))
        async with _GEMINI_SEMAPHORE:
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    roadmap_model.generate_content,
                    prompt,
                    generation_config=genai.GenerationConfig(response_mime_type="application/json"),
                ),
                timeout=timeout_s,
            )
        tasks = _parse_gemini_json(response.text)
        if not isinstance(tasks, list):
            raise ValueError("Expected a JSON array of tasks.")
        return tasks[:new_count]
    except Exception as e:
        print(f"Failed to generate weekly tasks: {e}")
        return []

async def generate_daily_breakdown_async(task_titles: list[str], available_minutes: int) -> list[dict]:
    tasks_str = "\n".join(f"- {t}" for t in task_titles)
    prompt = f"""You are an expert AI Career Coach helping a student prepare for placements.

The student has {available_minutes} minutes available today and these tasks planned:
{tasks_str}

Break each task into specific, actionable sub-steps that fit within the available time.

Return ONLY a JSON array. Each object must have exactly these fields:
- "title": string (specific sub-task or step)
- "category": string (match the parent task category)
- "estimated_minutes": integer
- "status": "Pending"
- "source": "ai_daily_breakdown"

Example: [{{"title": "Solve Two Sum on LeetCode", "category": "DSA", "estimated_minutes": 30, "status": "Pending", "source": "ai_daily_breakdown"}}]"""
    try:
        timeout_s = float(getattr(settings, "GEMINI_REQUEST_TIMEOUT", 45.0))
        async with _GEMINI_SEMAPHORE:
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    roadmap_model.generate_content,
                    prompt,
                    generation_config=genai.GenerationConfig(temperature=0.7),
                ),
                timeout=timeout_s,
            )
        schedule = _parse_gemini_json(response.text)
        if not isinstance(schedule, list):
            raise ValueError("Expected a JSON array for daily schedule.")
        return schedule
    except Exception as e:
        print(f"Failed to generate daily breakdown: {e}")
        return []

async def generate_role_roadmap_async(target_role: str) -> list[dict]:
    prompt = f"""
You are an expert AI Career Coach. Generate a comprehensive, step-by-step learning roadmap for a {target_role}, going from beginner to advanced topics.

Return a JSON array of objects, where each object represents a milestone or phase in the roadmap. Each object must have:
- "phase": string (e.g., "Phase 1: Foundations", "Phase 2: Core Skills")
- "description": string (A brief summary of this phase)
- "topics": list of strings (The key topics to learn in this phase)
"""
    try:
        timeout_s = float(getattr(settings, "GEMINI_REQUEST_TIMEOUT", 45.0))
        async with _GEMINI_SEMAPHORE:
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    roadmap_model.generate_content,
                    prompt,
                    generation_config=genai.GenerationConfig(response_mime_type="application/json"),
                ),
                timeout=timeout_s,
            )
        roadmap = _parse_gemini_json(response.text)
        if not isinstance(roadmap, list):
            raise ValueError("Expected a JSON array for roadmap.")
        return roadmap
    except Exception as e:
        print(f"Failed to generate role roadmap: {e}")
        return []



