from .base import BaseAgent


class ReviewerAgent(BaseAgent):
    SYSTEM_PROMPT = """Du bist ein erfahrener Code-Reviewer.
Überprüfe den Code auf: Bugs, Sicherheitsprobleme, Performance und Best Practices.
Antworte immer auf Deutsch. Liste Probleme mit Schweregrad: KRITISCH / WARNUNG / VORSCHLAG."""

    async def execute(self, task: str, context: dict = {}) -> str:
        code = context.get("code", task)
        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": f"Review this code:\n\n{code}"},
        ]
        response = await self.llm.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            max_tokens=1000,
        )
        return response.choices[0].message.content
