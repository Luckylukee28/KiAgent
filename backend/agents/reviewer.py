from .base import BaseAgent


class ReviewerAgent(BaseAgent):
    SYSTEM_PROMPT = """You are a senior code reviewer.
Review the provided code for: bugs, security issues, performance, and best practices.
Be direct. List issues with severity: CRITICAL / WARNING / SUGGESTION."""

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
