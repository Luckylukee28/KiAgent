from .base import BaseAgent
from .groq_utils import call_groq_with_retry


class CoderAgent(BaseAgent):
    async def execute(self, task: str, context: dict = {}) -> str:
        lang = context.get("language", "de")
        architecture = context.get("architecture", "")
        system = self.prompt(
            de="Du bist ein erfahrener Software-Entwickler. Schreibe sauberen, produktionsreifen Code. Füge Type Hints hinzu. Kommentare auf Deutsch.",
            en="You are an expert software engineer. Write clean, production-ready code. Always include type hints. Output only the code with minimal comments.",
            language=lang,
        )
        arch_label = "Architektur" if lang == "de" else "Architecture"
        task_label = "Aufgabe" if lang == "de" else "Task"
        user_content = f"{arch_label}:\n{architecture}\n\n{task_label}:\n{task}" if architecture else task

        return await call_groq_with_retry(
            self.llm,
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_content},
            ],
            max_tokens=1500,
            lang=lang,
            agent_name=self.name,
        )
