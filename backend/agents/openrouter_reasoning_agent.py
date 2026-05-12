"""OpenRouter agent with reasoning enabled.

Same provider as OpenRouterAgent but with `extra_body={"reasoning": {"enabled": True}}`,
which makes the model think before answering. Useful for architecture / review phases
where deeper analysis pays off. Uses more tokens, so toggle via env var.
"""

from openai import AsyncOpenAI
from .base import BaseAgent

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
REASONING_MODEL = "baidu/cobuddy:free"


class OpenRouterReasoningAgent(BaseAgent):
    def __init__(self, name: str, api_key: str, model: str = REASONING_MODEL):
        super().__init__(name, llm_client=None)
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=OPENROUTER_BASE_URL,
            default_headers={
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Multi-Agent Platform",
            },
        )
        self.model = model

    async def execute(self, task: str, context: dict = {}) -> str:
        lang = context.get("language", "de")
        phase = context.get("phase", "general")
        previous_outputs = context.get("previous_outputs", "")

        system_de = (
            f"Du bist ein durchdenkender KI-Agent (OpenRouter, Reasoning aktiv). "
            f"Aktuelle Phase: {phase}. Analysiere gründlich, antworte präzise auf Deutsch."
        )
        system_en = (
            f"You are a reasoning AI agent (OpenRouter with reasoning enabled). "
            f"Current phase: {phase}. Analyze carefully, answer precisely."
        )
        system = system_de if lang == "de" else system_en

        if previous_outputs:
            user_de = f"Team-Vorschläge:\n\n{previous_outputs}\n\nAufgabe: {task}\n\nDein durchdachter Vorschlag:"
            user_en = f"Team proposals:\n\n{previous_outputs}\n\nTask: {task}\n\nYour reasoned proposal:"
            user_msg = user_de if lang == "de" else user_en
        else:
            user_msg = f"Aufgabe: {task}\n\nDein durchdachter Vorschlag:" if lang == "de" else f"Task: {task}\n\nYour reasoned proposal:"

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_msg},
                ],
                extra_body={"reasoning": {"enabled": True}},
            )
            message = response.choices[0].message
            content = message.content or ""

            # Try to surface the reasoning trace (visible in mind map / viewer)
            reasoning = getattr(message, "reasoning_details", None) or getattr(message, "reasoning", None)
            trace = self._format_reasoning(reasoning)
            if trace:
                reasoning_lbl = "🧠 Überlegung" if lang == "de" else "🧠 Reasoning"
                answer_lbl = "💡 Antwort" if lang == "de" else "💡 Answer"
                return f"**{reasoning_lbl}:**\n{trace}\n\n**{answer_lbl}:**\n{content}"
            return content

        except Exception as e:
            print(f"[OpenRouter Reasoning error] {type(e).__name__}: {e}")
            return (
                f"⚠️ OpenRouter Reasoning nicht verfügbar ({type(e).__name__})."
                if lang == "de"
                else f"⚠️ OpenRouter Reasoning unavailable ({type(e).__name__})."
            )

    @staticmethod
    def _format_reasoning(raw) -> str:
        if not raw:
            return ""
        if isinstance(raw, str):
            return raw.strip()
        if isinstance(raw, list):
            parts: list[str] = []
            for item in raw:
                if isinstance(item, dict):
                    txt = item.get("text") or item.get("content") or item.get("summary")
                    if txt:
                        parts.append(str(txt))
                elif hasattr(item, "model_dump"):
                    d = item.model_dump()
                    txt = d.get("text") or d.get("content") or d.get("summary")
                    if txt:
                        parts.append(str(txt))
                else:
                    parts.append(str(item))
            return "\n".join(p for p in parts if p).strip()
        if isinstance(raw, dict):
            return str(raw.get("text") or raw.get("content") or raw).strip()
        return str(raw).strip()
