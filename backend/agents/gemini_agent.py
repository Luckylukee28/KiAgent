import google.generativeai as genai
from .base import BaseAgent


class GeminiAgent(BaseAgent):
    """Agent powered by Google Gemini — communicates with Groq agents."""

    def __init__(self, name: str, api_key: str, role: str = ""):
        super().__init__(name, llm_client=None)
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel("gemini-1.5-flash")
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

        response = self.model.generate_content(f"{system}\n\n{prompt}")
        return response.text


class GeminiSynthesizer(BaseAgent):
    """Combines outputs from Groq and Gemini into one final answer."""

    def __init__(self, name: str, api_key: str):
        super().__init__(name, llm_client=None)
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel("gemini-1.5-flash")

    async def execute(self, task: str, context: dict = {}) -> str:
        lang = context.get("language", "de")
        groq_output = context.get("groq_output", "")
        gemini_output = context.get("gemini_output", "")

        prompt_de = f"""Du bist ein neutraler Synthesizer.
Kombiniere die besten Teile beider KI-Antworten zu einer optimalen Lösung.
Antworte auf Deutsch.

Aufgabe: {task}

Groq (Llama) Vorschlag:
{groq_output}

Gemini Vorschlag:
{gemini_output}

Kombiniere das Beste aus beiden zu einer finalen, optimierten Antwort:"""

        prompt_en = f"""You are a neutral synthesizer.
Combine the best parts of both AI responses into one optimal solution.

Task: {task}

Groq (Llama) proposal:
{groq_output}

Gemini proposal:
{gemini_output}

Combine the best of both into a final, optimized answer:"""

        response = self.model.generate_content(prompt_de if lang == "de" else prompt_en)
        return response.text
