from .base import BaseAgent
from .groq_utils import call_groq_with_retry


class ReviewerAgent(BaseAgent):
    async def execute(self, task: str, context: dict = {}) -> str:
        lang = context.get("language", "de")
        code = context.get("code", task)
        system = self.prompt(
            de="Du bist ein erfahrener Code-Reviewer. Überprüfe den Code auf Bugs, Sicherheit, Performance und Best Practices. Antworte auf Deutsch. Schweregrade: KRITISCH / WARNUNG / VORSCHLAG.",
            en="You are a senior code reviewer. Review the code for bugs, security issues, performance, and best practices. List issues with severity: CRITICAL / WARNING / SUGGESTION.",
            language=lang,
        )
        review_label = "Überprüfe diesen Code" if lang == "de" else "Review this code"
        return await call_groq_with_retry(
            self.llm,
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": f"{review_label}:\n\n{code}"},
            ],
            max_tokens=1000,
            lang=lang,
            agent_name=self.name,
        )
