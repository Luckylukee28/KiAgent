from .base import BaseAgent


class ArchitectAgent(BaseAgent):
    SYSTEM_PROMPT = """You are an expert software architect.
Your job is to analyze requirements and propose a clean, scalable architecture.
Be concise and specific. Output structured plans."""

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
