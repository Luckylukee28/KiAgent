from .base import BaseAgent


class CoderAgent(BaseAgent):
    SYSTEM_PROMPT = """Du bist ein erfahrener Software-Entwickler.
Deine Aufgabe ist es, sauberen, produktionsreifen Code basierend auf der Aufgabe und Architektur zu schreiben.
Füge immer Type Hints hinzu. Gib nur den Code aus mit minimalen Kommentaren auf Deutsch."""

    async def execute(self, task: str, context: dict = {}) -> str:
        architecture = context.get("architecture", "")
        user_content = f"Architecture:\n{architecture}\n\nTask:\n{task}" if architecture else task

        response = await self.llm.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            max_tokens=2000,
        )
        return response.choices[0].message.content
