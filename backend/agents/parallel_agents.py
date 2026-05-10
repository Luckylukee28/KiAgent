from .base import BaseAgent


class FrontendAgent(BaseAgent):
    SYSTEM_PROMPT = """Du bist ein erfahrener Frontend-Entwickler.
Schreibe sauberen React/Next.js/TypeScript Code basierend auf der Aufgabe und Architekturentscheidung.
Konzentriere dich nur auf den Frontend-Teil. Kommentare auf Deutsch."""

    async def execute(self, task: str, context: dict = {}) -> str:
        architecture = context.get("architecture", "")
        response = await self.llm.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": f"Architekturentscheidung:\n{architecture}\n\nAufgabe:\n{task}\n\nSchreibe den Frontend-Code:"},
            ],
            max_tokens=1500,
        )
        return response.choices[0].message.content


class BackendCoderAgent(BaseAgent):
    SYSTEM_PROMPT = """Du bist ein erfahrener Backend-Entwickler.
Schreibe sauberen Python/FastAPI Code basierend auf der Aufgabe und Architekturentscheidung.
Konzentriere dich nur auf den Backend-Teil. Kommentare auf Deutsch."""

    async def execute(self, task: str, context: dict = {}) -> str:
        architecture = context.get("architecture", "")
        response = await self.llm.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": f"Architekturentscheidung:\n{architecture}\n\nAufgabe:\n{task}\n\nSchreibe den Backend-Code:"},
            ],
            max_tokens=1500,
        )
        return response.choices[0].message.content
