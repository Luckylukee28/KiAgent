from .base import BaseAgent


class ProjectManagerAgent(BaseAgent):
    SYSTEM_PROMPT = """You are an expert AI Project Manager.
Given a project goal, produce a structured project plan. Output exactly this format:

PROJECT: [name]
SUMMARY: [one sentence description]

ROADMAP:
Phase 1 - [name]: [description]
Phase 2 - [name]: [description]
Phase 3 - [name]: [description]

SPRINT 1 (Week 1):
- [ ] [task 1]
- [ ] [task 2]
- [ ] [task 3]
- [ ] [task 4]
- [ ] [task 5]

SPRINT 2 (Week 2):
- [ ] [task 1]
- [ ] [task 2]
- [ ] [task 3]

TECH STACK:
Frontend: [technologies]
Backend: [technologies]
Database: [technologies]
DevOps: [technologies]

RISKS:
- [risk 1 and mitigation]
- [risk 2 and mitigation]"""

    async def execute(self, task: str, context: dict = {}) -> str:
        response = await self.llm.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": f"Create a full project plan for:\n{task}"},
            ],
            max_tokens=800,
        )
        return response.choices[0].message.content
