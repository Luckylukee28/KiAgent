from .base import BaseAgent


class DebateAgent(BaseAgent):
    def __init__(self, name: str, llm_client, position: str, language: str = "de"):
        super().__init__(name, llm_client)
        self.position = position
        self._lang = language

    async def execute(self, task: str, context: dict = {}) -> str:
        return await self.argue(task)

    async def argue(self, topic: str, previous_arguments: str = "") -> str:
        context = (f"\nVorherige Argumente:\n{previous_arguments}" if self._lang == "de" else f"\nPrevious arguments:\n{previous_arguments}") if previous_arguments else ""
        response = await self.llm.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": self.prompt(
                        de=f"Du bist {self.name}, ein erfahrener Ingenieur in einer technischen Debatte. Deine Position: {self.position}. Antworte auf Deutsch. Sei präzise (3-5 Sätze). Verteidige deine Position mit konkreten Argumenten.",
                        en=f"You are {self.name}, a senior engineer debating a technical decision. Your position: {self.position}. Be concise (3-5 sentences). Defend your position with concrete technical arguments.",
                        language=self._lang,
                    ),
                },
                {
                    "role": "user",
                    "content": f"{'Thema' if self._lang == 'de' else 'Topic'}: {topic}{context}\n\n{'Dein Argument' if self._lang == 'de' else 'Make your argument'}:",
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
                    "content": self.prompt(
                        de="Du bist ein neutraler technischer Richter. Analysiere die Debatte und wähle den besten Ansatz auf Deutsch.\nFormat:\nENTSCHEIDUNG: [Ansatz]\nBEGRÜNDUNG: [Warum]\nFINALE ARCHITEKTUR: [Entscheidung]",
                        en="You are a neutral technical judge. Analyze the debate and pick the best approach.\nFormat:\nDECISION: [approach]\nREASONING: [why]\nFINAL ARCHITECTURE: [decision]",
                        language=self._lang,
                    ),
                },
                {
                    "role": "user",
                    "content": f"{'Thema' if self._lang == 'de' else 'Topic'}: {topic}\n\n{'Debatte' if self._lang == 'de' else 'Debate'}:\n{debate_transcript}\n\n{'Dein Urteil' if self._lang == 'de' else 'Your verdict'}:",
                },
            ],
            max_tokens=300,
        )
        return response.choices[0].message.content
