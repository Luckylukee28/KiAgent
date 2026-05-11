from google import genai
from google.genai import errors as genai_errors
from .base import BaseAgent


def _make_client(api_key: str) -> genai.Client:
    return genai.Client(api_key=api_key)


class GeminiAgent(BaseAgent):
    """Agent powered by Google Gemini — communicates with Groq agents."""

    def __init__(self, name: str, api_key: str, role: str = ""):
        super().__init__(name, llm_client=None)
        self.client = _make_client(api_key)
        self.role = role

    async def execute(self, task: str, context: dict = {}) -> str:
        lang = context.get("language", "de")
        groq_output = context.get("groq_output", "")
        phase = context.get("phase", "general")

        system_de = f"""Du bist Gemini, ein KI-Agent von Google.
Du arbeitest zusammen mit einem Groq-Agenten (Llama) an der gleichen Aufgabe.
Deine Rolle: {self.role or phase}
Antworte auf Deutsch. Sei konstruktiv und präzise."""

        system_en = f"""You are Gemini, an AI agent by Google.
You collaborate with a Groq agent (Llama) on the same task.
Your role: {self.role or phase}
Be constructive and precise."""

        system = system_de if lang == "de" else system_en

        if groq_output:
            collab_de = f"Der Groq-Agent hat folgendes vorgeschlagen:\n\n{groq_output}\n\nDeine Aufgabe:\n{task}\n\nÜberprüfe, verbessere und ergänze den Vorschlag:"
            collab_en = f"The Groq agent proposed the following:\n\n{groq_output}\n\nYour task:\n{task}\n\nReview, improve and extend the proposal:"
            prompt = collab_de if lang == "de" else collab_en
        else:
            start_de = f"Aufgabe: {task}\n\nDein Vorschlag:"
            start_en = f"Task: {task}\n\nYour proposal:"
            prompt = start_de if lang == "de" else start_en

        try:
            response = self.client.models.generate_content(
                model="gemini-2.0-flash",
                contents=f"{system}\n\n{prompt}",
            )
            return response.text
        except genai_errors.ClientError as e:
            if e.code == 429:
                fallback = "⚠️ Gemini-Kontingent erschöpft – Groq-Ergebnis wird verwendet." if lang == "de" else "⚠️ Gemini quota exhausted – using Groq result."
            else:
                fallback = f"⚠️ Gemini nicht verfügbar ({e.code}) – Groq-Ergebnis wird verwendet." if lang == "de" else f"⚠️ Gemini unavailable ({e.code}) – using Groq result."
            return f"{fallback}\n\n{groq_output}"


class GeminiSynthesizer(BaseAgent):
    """Combines outputs from Groq and Gemini into one final answer."""

    def __init__(self, name: str, api_key: str):
        super().__init__(name, llm_client=None)
        self.client = _make_client(api_key)

    async def execute(self, task: str, context: dict = {}) -> str:
        lang = context.get("language", "de")
        # Support both old (groq_output/gemini_output) and new (agent_outputs dict) format
        agent_outputs: dict = context.get("agent_outputs", {})
        if not agent_outputs:
            groq_output = context.get("groq_output", "")
            gemini_output = context.get("gemini_output", "")
            if groq_output:
                agent_outputs["Groq"] = groq_output
            if gemini_output and not gemini_output.startswith("⚠️"):
                agent_outputs["Gemini"] = gemini_output

        # Filter out fallback/error outputs
        valid_outputs = {k: v for k, v in agent_outputs.items() if not v.startswith("⚠️")}

        if not valid_outputs:
            return list(agent_outputs.values())[0] if agent_outputs else ""

        if len(valid_outputs) == 1:
            return list(valid_outputs.values())[0]

        outputs_text = "\n\n".join(f"**{name}:**\n{output}" for name, output in valid_outputs.items())

        prompt_de = f"""Du bist ein neutraler Synthesizer.
Kombiniere die besten Teile aller KI-Antworten zu einer optimalen Lösung.
Antworte auf Deutsch.

Aufgabe: {task}

{outputs_text}

Kombiniere das Beste aller Vorschläge zu einer finalen, optimierten Antwort:"""

        prompt_en = f"""You are a neutral synthesizer.
Combine the best parts of all AI responses into one optimal solution.

Task: {task}

{outputs_text}

Combine the best of all proposals into a final, optimized answer:"""

        try:
            response = self.client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt_de if lang == "de" else prompt_en,
            )
            return response.text
        except genai_errors.ClientError as e:
            if e.code == 429:
                fallback = "⚠️ Synthesizer-Kontingent erschöpft." if lang == "de" else "⚠️ Synthesizer quota exhausted."
            else:
                fallback = f"⚠️ Synthesizer nicht verfügbar ({e.code})." if lang == "de" else f"⚠️ Synthesizer unavailable ({e.code})."
            return f"{fallback}\n\n{list(valid_outputs.values())[0]}"
