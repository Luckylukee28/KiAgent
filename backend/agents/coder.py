from .base import BaseAgent


class CoderAgent(BaseAgent):
    SYSTEM_PROMPT = """You are an expert software engineer.
Your job is to write clean, production-ready code based on the given task and architecture.
Always include type hints. Output only the code with minimal comments."""

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
