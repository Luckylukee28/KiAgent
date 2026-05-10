from .base import BaseAgent


class ArchitectAgent(BaseAgent):
    SYSTEM_PROMPT = """Du bist ein erfahrener Software-Architekt.
Deine Aufgabe ist es, Anforderungen zu analysieren und eine saubere, skalierbare Architektur vorzuschlagen.
Antworte immer auf Deutsch. Sei präzise und strukturiert."""

    async def execute(self, task: str, context: dict = {}) -> str:
        response = await self.llm.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": task},
            ],
            max_tokens=1000,
        )
        return response.choices[0].message.content
