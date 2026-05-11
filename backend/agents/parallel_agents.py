from .base import BaseAgent


class FrontendAgent(BaseAgent):
    async def execute(self, task: str, context: dict = {}) -> str:
        lang = context.get("language", "de")
        architecture = context.get("architecture", "")
        system = self.prompt(
            de="Du bist ein erfahrener Frontend-Entwickler. Schreibe sauberen React/Next.js/TypeScript Code. Kommentare auf Deutsch.",
            en="You are an expert frontend engineer. Write clean React/Next.js/TypeScript code. Focus only on the frontend part.",
            language=lang,
        )
        response = await self.llm.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": f"{'Architekturentscheidung' if lang == 'de' else 'Architecture'}:\n{architecture}\n\n{'Aufgabe' if lang == 'de' else 'Task'}:\n{task}\n\n{'Schreibe den Frontend-Code' if lang == 'de' else 'Write the frontend code'}:"},
            ],
            max_tokens=1500,
        )
        return response.choices[0].message.content


class BackendCoderAgent(BaseAgent):
    async def execute(self, task: str, context: dict = {}) -> str:
        lang = context.get("language", "de")
        architecture = context.get("architecture", "")
        system = self.prompt(
            de="Du bist ein erfahrener Backend-Entwickler. Schreibe sauberen Python/FastAPI Code. Kommentare auf Deutsch.",
            en="You are an expert backend engineer. Write clean Python/FastAPI code. Focus only on the backend part.",
            language=lang,
        )
        response = await self.llm.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": f"{'Architekturentscheidung' if lang == 'de' else 'Architecture'}:\n{architecture}\n\n{'Aufgabe' if lang == 'de' else 'Task'}:\n{task}\n\n{'Schreibe den Backend-Code' if lang == 'de' else 'Write the backend code'}:"},
            ],
            max_tokens=1500,
        )
        return response.choices[0].message.content
