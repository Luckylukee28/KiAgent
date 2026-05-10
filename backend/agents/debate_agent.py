from .base import BaseAgent


class DebateAgent(BaseAgent):
    def __init__(self, name: str, llm_client, position: str):
        super().__init__(name, llm_client)
        self.position = position

    async def execute(self, task: str, context: dict = {}) -> str:
        return await self.argue(task)

    async def argue(self, topic: str, previous_arguments: str = "") -> str:
        context = f"\nPrevious arguments:\n{previous_arguments}" if previous_arguments else ""
        response = await self.llm.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": f"""You are {self.name}, a senior engineer debating a technical decision.
Your position: {self.position}
Be concise (3-5 sentences). Defend your position with concrete technical arguments.
Acknowledge valid points from opponents but counter them.""",
                },
                {
                    "role": "user",
                    "content": f"Topic: {topic}{context}\n\nMake your argument:",
                },
            ],
            max_tokens=300,
        )
        return response.choices[0].message.content


class DebateJudge(BaseAgent):
    async def execute(self, task: str, context: dict = {}) -> str:
        return await self.judge(task, context.get("transcript", ""))

    async def judge(self, topic: str, debate_transcript: str) -> str:
        response = await self.llm.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": """You are a neutral technical judge.
Analyze the debate and pick the best approach. Output:
DECISION: [chosen approach in one sentence]
REASONING: [why in 2-3 sentences]
FINAL ARCHITECTURE: [concrete technical decision to implement]""",
                },
                {
                    "role": "user",
                    "content": f"Topic: {topic}\n\nDebate:\n{debate_transcript}\n\nYour verdict:",
                },
            ],
            max_tokens=300,
        )
        return response.choices[0].message.content
