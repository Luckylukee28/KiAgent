from .base import BaseAgent


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

    async def execute(self, task: str, context: dict = {}) -> str:
        response = await self.llm.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": f"Erstelle einen vollständigen Projektplan für:\n{task}"},
            ],
            max_tokens=800,
        )
        return response.choices[0].message.content
