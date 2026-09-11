def get_mentor_prompt(context: dict) -> str:
    profile = context.get("profile", {})
    accountability = context.get("accountability", {})
    tone = accountability.get("tone_instruction", "Act as a patient, encouraging teacher who explains concepts clearly.")
    roadmap = context.get("roadmap", {})
    target_role = profile.get("target_role", "Software Engineer")

    # Build role assessment table grouped by category
    skill_profile: dict = accountability.get("skill_profile", {})
    weak_areas: list = accountability.get("weak_areas", [])
    strong_areas: list = accountability.get("strong_areas", [])

    skill_table_lines = []
    if skill_profile:
        skill_table_lines.append(f"## Role Assessment Profile: {target_role}")
        skill_table_lines.append("| Category | Skill | Confidence |")
        skill_table_lines.append("|----------|-------|------------|")
        for category_name, skills in skill_profile.items():
            for label, conf in skills.items():
                marker = " \u26a0\ufe0f" if conf < 50 else (" \u2705" if conf >= 75 else "")
                skill_table_lines.append(f"| {category_name} | {label} | {conf}%{marker} |")
    else:
        weak_str = ", ".join(weak_areas) or "None identified"
        skill_table_lines.append(f"Weak Areas: {weak_str}")

    skill_table = "\n".join(skill_table_lines)
    weak_summary = ", ".join(weak_areas[:5]) or "None"
    strong_summary = ", ".join(strong_areas[:5]) or "None"

    roadmap_line = ""
    if roadmap.get("role"):
        total = roadmap.get("total", 0)
        completed = roadmap.get("completed", 0)
        roadmap_line = f"Roadmap Role: {roadmap['role']} ({completed}/{total} milestones completed)"
        nm = roadmap.get("next_milestone")
        if nm:
            roadmap_line += f"\nNext Roadmap Milestone: {nm['title']} ({nm['category']})"

    prompt = f"""CURRENT AGENT: MENTOR

You are PlacementOS AI, continuing an ongoing mentoring session for an engineering student preparing for placements.
Remain in Mentor mode unless the application explicitly tells you that the mode has changed.
Focus on career, roadmap, skill gaps, projects, interviews and learning priorities rather than turning every question into a lesson.

## Student Profile
Name: {profile.get("full_name", "Student")}
College: {profile.get("college", "Unknown")}
Target Role: {target_role}
{roadmap_line}

{skill_table}

Summary:
- Weak areas needing attention (< 50%): {weak_summary}
- Strong areas to leverage (>= 75%): {strong_summary}

## Mentoring Instructions
- This student is preparing for {target_role} roles.
- When giving career advice, focus on skills most evaluated in {target_role} interviews.
- Reference the student's actual weak areas above when giving prioritization advice.
- Reference the student's roadmap milestone to keep advice grounded in their actual goals.

## Persona Tone
{tone}
Important: Never be aggressive, harsh, or condescending. Always remain supportive.
"""
    return prompt
