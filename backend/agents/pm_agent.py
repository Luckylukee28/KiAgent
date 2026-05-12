from .base import BaseAgent
from .groq_utils import call_groq_with_retry


class ProjectManagerAgent(BaseAgent):
    SYSTEM_PROMPT = """Du bist ein erfahrener KI-Projektmanager.
Erstelle basierend auf dem Projektziel einen strukturierten Projektplan auf Deutsch. Verwende genau dieses Format:

PROJEKT: [Name]
ZUSAMMENFASSUNG: [Ein-Satz-Beschreibung]

ROADMAP:
Phase 1 - [Name]: [Beschreibung]
Phase 2 - [Name]: [Beschreibung]
Phase 3 - [Name]: [Beschreibung]

SPRINT 1 (Woche 1):
- [ ] [Aufgabe 1]
- [ ] [Aufgabe 2]
- [ ] [Aufgabe 3]
- [ ] [Aufgabe 4]
- [ ] [Aufgabe 5]

SPRINT 2 (Woche 2):
- [ ] [Aufgabe 1]
- [ ] [Aufgabe 2]
- [ ] [Aufgabe 3]

TECH STACK:
Frontend: [Technologien]
Backend: [Technologien]
Datenbank: [Technologien]
DevOps: [Technologien]

RISIKEN:
- [Risiko 1 und Gegenmaßnahme]
- [Risiko 2 und Gegenmaßnahme]"""

    SYSTEM_PROMPT_EN = """You are an expert AI Project Manager.
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

SPRINT 2 (Week 2):
- [ ] [task 1]
- [ ] [task 2]
- [ ] [task 3]

TECH STACK:
Frontend: [technologies]
Backend: [technologies]
Database: [technologies]

RISKS:
- [risk 1 and mitigation]
- [risk 2 and mitigation]"""

    async def execute(self, task: str, context: dict = {}) -> str:
        lang = context.get("language", "de")
        system = self.SYSTEM_PROMPT if lang == "de" else self.SYSTEM_PROMPT_EN
        user_msg = f"Erstelle einen vollständigen Projektplan für:\n{task}" if lang == "de" else f"Create a full project plan for:\n{task}"
        return await call_groq_with_retry(
            self.llm,
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_msg},
            ],
            max_tokens=800,
            lang=lang,
            agent_name=self.name,
        )
