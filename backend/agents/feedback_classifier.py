"""
Agent 5 — Citizen Feedback Classifier.

Classifies citizen complaints (text and/or photo) and routes to the right
department. Uses Gemini 1.5 Flash (VLLM) for image+text classification.
"""
from __future__ import annotations

CATEGORIES = {
    "pothole": "Road Maintenance",
    "signal_malfunction": "Traffic Engineering",
    "illegal_parking": "Traffic Police",
    "flooding": "Drainage Department",
    "congestion": "Traffic Engineering",
    "other": "City Hall General",
}


async def run(complaint: dict) -> dict:
    """complaint: {text?: str, image_b64?: str}"""
    category = await _classify(complaint)
    return {
        "agent": "feedback_classifier",
        "category": category,
        "priority": "high" if category in ("signal_malfunction", "flooding") else "normal",
        "assigned_department": CATEGORIES.get(category, CATEGORIES["other"]),
        "auto_response": f"Your report was classified as '{category}' and routed to "
                         f"{CATEGORIES.get(category, CATEGORIES['other'])}.",
    }


async def _classify(complaint: dict) -> str:
    """Prototype keyword fallback. Production: Gemini 1.5 Flash.

        import google.generativeai as genai
        model = genai.GenerativeModel("gemini-1.5-flash")
        parts = []
        if complaint.get("image_b64"):
            parts.append({"mime_type": "image/jpeg", "data": complaint["image_b64"]})
        parts.append(
            "Classify this road complaint into exactly one of: "
            f"{list(CATEGORIES)}. Reply with only the label."
        )
        if complaint.get("text"):
            parts.append(complaint["text"])
        return model.generate_content(parts).text.strip()
    """
    text = (complaint.get("text") or "").lower()
    for key in CATEGORIES:
        if key.split("_")[0] in text:
            return key
    return "other"
