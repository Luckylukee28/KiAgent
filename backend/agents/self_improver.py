from .base import BaseAgent
from memory.memory_manager import store_learning, get_best_patterns


class SelfImprover(BaseAgent):
    """Evaluates agent outputs and stores learnings for future improvement."""

    async def execute(self, task: str, context: dict = {}) -> str:
        return await self.evaluate(task, context.get("output", ""), context.get("agent", "unknown"))

    async def evaluate(self, task: str, output: str, agent_name: str) -> str:
        response = await self.llm.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": """Du bist ein Qualitätsprüfer für KI-generierte Ausgaben.
Bewerte den Output von 1-10 und gib kurze Verbesserungsvorschläge auf Deutsch.
Antworte genau in diesem Format:
BEWERTUNG: [Zahl]
STÄRKEN: [ein Satz]
VERBESSERUNGEN: [ein oder zwei konkrete Vorschläge]""",
                },
                {
                    "role": "user",
                    "content": f"Agent: {agent_name}\nTask: {task}\n\nOutput to evaluate:\n{output[:1500]}",
                },
            ],
            max_tokens=200,
        )
        evaluation = response.choices[0].message.content

        score = self._parse_score(evaluation)
        await store_learning(agent_name, task, output[:500], score)

        return evaluation

    def _parse_score(self, evaluation: str) -> float:
        for line in evaluation.split("\n"):
            if line.startswith("BEWERTUNG:") or line.startswith("SCORE:"):
                try:
                    return float(line.split(":")[1].strip().split("/")[0])
                except Exception:
                    pass
        return 5.0


async def build_improved_prompt(base_prompt: str, task: str, agent_name: str) -> str:
    patterns = await get_best_patterns(agent_name, task, limit=2)
    if not patterns:
        return base_prompt

    examples = "\n\n".join(
        f"Past successful solution (score {p['outcome_score']}/10):\n{p['solution']}"
        for p in patterns
    )
    return f"{base_prompt}\n\n--- LEARNED FROM PAST SUCCESS ---\n{examples}\n--- END ---"
