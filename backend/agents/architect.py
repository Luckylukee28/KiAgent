from .base import BaseAgent
from .groq_utils import call_groq_with_retry


class ArchitectAgent(BaseAgent):
    async def execute(self, task: str, context: dict = {}) -> str:
        lang = context.get("language", "de")
        system = self.prompt(
            de="Du bist ein erfahrener Software-Architekt. Analysiere die Anforderungen und schlage eine skalierbare Architektur vor. Antworte auf Deutsch. Sei präzise und strukturiert.",
            en="You are an expert software architect. Analyze the requirements and propose a clean, scalable architecture. Be concise and specific. Output structured plans.",
            language=lang,
        )
        return await call_groq_with_retry(
            self.llm,
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": task},
            ],
            max_tokens=1000,
            lang=lang,
            agent_name=self.name,
        )
