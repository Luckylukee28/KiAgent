from .base import BaseAgent


class FrontendAgent(BaseAgent):
    SYSTEM_PROMPT = """You are an expert frontend engineer.
Write clean React/Next.js/TypeScript code based on the task and architecture decision.
Focus only on the frontend part. Include component structure, state management, and UI logic."""

    async def execute(self, task: str, context: dict = {}) -> str:
        architecture = context.get("architecture", "")
        response = await self.llm.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": f"Architecture decision:\n{architecture}\n\nTask:\n{task}\n\nWrite the frontend code:"},
            ],
            max_tokens=1500,
        )
        return response.choices[0].message.content


class BackendCoderAgent(BaseAgent):
    SYSTEM_PROMPT = """You are an expert backend engineer.
Write clean Python/FastAPI code based on the task and architecture decision.
Focus only on the backend part. Include routes, models, and business logic."""

    async def execute(self, task: str, context: dict = {}) -> str:
        architecture = context.get("architecture", "")
        response = await self.llm.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": f"Architecture decision:\n{architecture}\n\nTask:\n{task}\n\nWrite the backend code:"},
            ],
            max_tokens=1500,
        )
        return response.choices[0].message.content
