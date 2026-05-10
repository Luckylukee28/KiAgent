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
                    "content": f"""Du bist {self.name}, ein erfahrener Ingenieur in einer technischen Debatte.
Deine Position: {self.position}
Antworte auf Deutsch. Sei präzise (3-5 Sätze). Verteidige deine Position mit konkreten technischen Argumenten.
Erkenne gültige Punkte des Gegners an, widerlege sie aber.""",
                },
                {
                    "role": "user",
                    "content": f"Thema: {topic}{context}\n\nDein Argument:",
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
                    "content": """Du bist ein neutraler technischer Richter.
Analysiere die Debatte und wähle den besten Ansatz. Antworte auf Deutsch im Format:
ENTSCHEIDUNG: [gewählter Ansatz in einem Satz]
BEGRÜNDUNG: [Warum in 2-3 Sätzen]
FINALE ARCHITEKTUR: [konkrete technische Entscheidung zur Umsetzung]""",
                },
                {
                    "role": "user",
                    "content": f"Thema: {topic}\n\nDebatte:\n{debate_transcript}\n\nDein Urteil:",
                },
            ],
            max_tokens=300,
        )
        return response.choices[0].message.content
