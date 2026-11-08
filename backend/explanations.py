"""Gemini can order approved explanation cards; numeric truth stays in Python."""

import json
import os
import re
from urllib.error import URLError
from urllib.request import Request, urlopen


def explain(result):
    cards = {
        "outcome": f"Under these assumptions, runway is {result['runway_display']}.",
        "cashflow": f"The simulated monthly shortfall is {result['monthly_shortfall']:.2f}.",
        "buffer": f"The simulated buffer remaining is {result['buffer_left']:.2f}.",
        "actions": "Compare hypothetical savings, income recovery and lower outflows in the safety-net planner.",
        "limits": "Constant cashflows are assumptions. This scenario does not establish EI eligibility or reveal cash spending purposes.",
    }
    order = list(cards)
    source = "deterministic_fallback"
    key, model = os.getenv("GEMINI_API_KEY"), os.getenv("GEMINI_MODEL")
    if key and model and re.fullmatch(r"[A-Za-z0-9._-]+", model):
        schema = {"type": "object", "properties": {"card_ids": {"type": "array",
                  "items": {"type": "string", "enum": list(cards)}, "minItems": len(cards), "maxItems": len(cards)}},
                  "required": ["card_ids"], "additionalProperties": False}
        payload = {"contents": [{"role": "user", "parts": [{"text":
            "Order these approved explanation cards for clarity. Return each ID exactly once. "
            "Do not generate prose or calculate numbers. " + json.dumps(cards)}]}],
            "generationConfig": {"responseMimeType": "application/json", "responseJsonSchema": schema}}
        request = Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                          data=json.dumps(payload).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": key})
        try:
            with urlopen(request, timeout=15) as response:
                raw = json.loads(response.read(65537))
            candidate = json.loads(raw["candidates"][0]["content"]["parts"][0]["text"])
            selected = candidate["card_ids"]
            if set(candidate) != {"card_ids"} or not isinstance(selected, list):
                raise ValueError("Invalid explanation structure")
            if len(selected) != len(cards) or set(selected) != set(cards):
                raise ValueError("Unknown or duplicate explanation cards")
            order, source = selected, "gemini_ordered_verified_cards"
        except (URLError, TimeoutError, ValueError, KeyError, IndexError, TypeError, OSError):
            pass
    return {"source": source, "cards": [{"id": k, "text": cards[k]} for k in order],
            "financial_result": result,
            "limitation": "Gemini selects presentation order only; all displayed wording and figures are server-rendered."}
