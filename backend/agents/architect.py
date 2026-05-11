from .base import BaseAgent


class ArchitectAgent(BaseAgent):
    async def execute(self, task: str, context: dict = {}) -> str:
        lang = context.get("language", "de")
        system = self.prompt(
            de="Du bist ein erfahrener Software-Architekt. Analysiere die Anforderungen und schlage eine skalierbare Architektur vor. Antworte auf Deutsch. Sei präzise und strukturiert.",
            en="You are an expert software architect. Analyze the requirements and propose a clean, scalable architecture. Be concise and specific. Output structured plans.",
            language=lang,
        )
        response = await self.llm.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": task},
            ],
            max_tokens=1000,
        )
        return response.choices[0].message.content
