from openai import AsyncOpenAI
from .base import BaseAgent

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
FREE_MODEL = "baidu/cobuddy:free"


class OpenRouterAgent(BaseAgent):
    """Agent via OpenRouter — access to many free models with one API key."""

    def __init__(self, name: str, api_key: str, model: str = FREE_MODEL):
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

        system_de = f"""Du bist ein KI-Agent (OpenRouter / Llama 3.1).
Du arbeitest in einem Multi-Agenten-Team.
Aktuelle Phase: {phase}
Antworte auf Deutsch. Fokussiere auf praktische Umsetzung."""

        system_en = f"""You are an AI agent (OpenRouter / Llama 3.1).
You work in a multi-agent team.
Current phase: {phase}
Focus on practical implementation."""

        system = system_de if lang == "de" else system_en

        if previous_outputs:
            collab_de = f"Team-Vorschläge:\n\n{previous_outputs}\n\nAufgabe: {task}\n\nDeine praktische Ergänzung:"
            collab_en = f"Team proposals:\n\n{previous_outputs}\n\nTask: {task}\n\nYour practical addition:"
            prompt = collab_de if lang == "de" else collab_en
        else:
            prompt = f"Aufgabe: {task}\n\nDein Vorschlag:" if lang == "de" else f"Task: {task}\n\nYour proposal:"

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            print(f"[OpenRouter error] {type(e).__name__}: {e}")
            fallback = f"⚠️ OpenRouter nicht verfügbar ({type(e).__name__}) – wird übersprungen." if lang == "de" else f"⚠️ OpenRouter unavailable ({type(e).__name__}) – skipping."
            return fallback
