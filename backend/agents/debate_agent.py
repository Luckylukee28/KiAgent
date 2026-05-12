from .base import BaseAgent
from .groq_utils import call_groq_with_retry


class DebateAgent(BaseAgent):
    def __init__(self, name: str, llm_client, position: str, language: str = "de"):
        super().__init__(name, llm_client)
        self.position = position
        self._lang = language

    async def execute(self, task: str, context: dict = {}) -> str:
        return await self.argue(task)

    async def argue(self, topic: str, previous_arguments: str = "") -> str:
        context = (
            f"\nVorherige Argumente:\n{previous_arguments}"
            if self._lang == "de" else
            f"\nPrevious arguments:\n{previous_arguments}"
        ) if previous_arguments else ""

        return await call_groq_with_retry(
            self.llm,
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": self.prompt(
                        de=f"Du bist {self.name}. Position: {self.position}. Verteidige sie in MAX 2 kurzen Sätzen mit dem stärksten Argument. Keine Floskeln, kein Wiederholen der Position.",
                        en=f"You are {self.name}. Position: {self.position}. Defend it in MAX 2 short sentences with the single strongest argument. No fluff, no restating the position.",
                        language=self._lang,
                    ),
                },
                {
                    "role": "user",
                    "content": f"{'Thema' if self._lang == 'de' else 'Topic'}: {topic}{context}",
                },
            ],
            max_tokens=120,
            lang=self._lang,
            agent_name=self.name,
        )


class DebateJudge(BaseAgent):
    def __init__(self, name: str, llm_client, language: str = "de"):
        super().__init__(name, llm_client)
        self._lang = language

    async def execute(self, task: str, context: dict = {}) -> str:
        return await self.judge(task, context.get("transcript", ""))

    async def judge(self, topic: str, debate_transcript: str) -> str:
        return await call_groq_with_retry(
            self.llm,
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": self.prompt(
                        de="Neutraler Richter. Sehr kurz auf Deutsch antworten — exakt dieses Format:\nENTSCHEIDUNG: [Ansatz in 3-6 Wörtern]\nBEGRÜNDUNG: [EIN Satz]",
                        en="Neutral judge. Reply very briefly — exact format:\nDECISION: [approach in 3-6 words]\nREASONING: [ONE sentence]",
                        language=self._lang,
                    ),
                },
                {
                    "role": "user",
                    "content": f"{'Thema' if self._lang == 'de' else 'Topic'}: {topic}\n\n{'Debatte' if self._lang == 'de' else 'Debate'}:\n{debate_transcript}",
                },
            ],
            max_tokens=120,
            lang=self._lang,
            agent_name=self.name,
        )
