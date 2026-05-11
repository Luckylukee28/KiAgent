from mistralai import Mistral
from mistralai.models import SDKError
from .base import BaseAgent


class MistralAgent(BaseAgent):
    """Agent powered by Mistral AI — joins the multi-agent collaboration."""

    def __init__(self, name: str, api_key: str):
        super().__init__(name, llm_client=None)
        self.client = Mistral(api_key=api_key)

    async def execute(self, task: str, context: dict = {}) -> str:
        lang = context.get("language", "de")
        phase = context.get("phase", "general")
        previous_outputs = context.get("previous_outputs", "")

        system_de = f"""Du bist Mistral, ein KI-Agent von Mistral AI.
Du arbeitest in einem Multi-Agenten-Team (Groq, Gemini, Mistral).
Aktuelle Phase: {phase}
Antworte auf Deutsch. Sei präzise und ergänze die anderen Agenten."""

        system_en = f"""You are Mistral, an AI agent by Mistral AI.
You work in a multi-agent team (Groq, Gemini, Mistral).
Current phase: {phase}
Be precise and complement the other agents."""

        system = system_de if lang == "de" else system_en

        if previous_outputs:
            collab_de = f"Die anderen Agenten haben vorgeschlagen:\n\n{previous_outputs}\n\nAufgabe: {task}\n\nDeine einzigartige Perspektive und Ergänzungen:"
            collab_en = f"The other agents proposed:\n\n{previous_outputs}\n\nTask: {task}\n\nYour unique perspective and additions:"
            prompt = collab_de if lang == "de" else collab_en
        else:
            prompt = f"Aufgabe: {task}\n\nDein Vorschlag:" if lang == "de" else f"Task: {task}\n\nYour proposal:"

        try:
            response = await self.client.chat.complete_async(
                model="mistral-small-latest",
                messages=[{"role": "user", "content": f"{system}\n\n{prompt}"}],
            )
            return response.choices[0].message.content
        except SDKError as e:
            fallback = f"⚠️ Mistral nicht verfügbar ({e.status_code}) – wird übersprungen." if lang == "de" else f"⚠️ Mistral unavailable ({e.status_code}) – skipping."
            return fallback
        except Exception as e:
            fallback = "⚠️ Mistral Fehler – wird übersprungen." if lang == "de" else "⚠️ Mistral error – skipping."
            return fallback
