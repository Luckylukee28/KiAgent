from .base import BaseAgent


class CoderAgent(BaseAgent):
    async def execute(self, task: str, context: dict = {}) -> str:
        lang = context.get("language", "de")
        architecture = context.get("architecture", "")
        system = self.prompt(
            de="Du bist ein erfahrener Software-Entwickler. Schreibe sauberen, produktionsreifen Code. Füge Type Hints hinzu. Kommentare auf Deutsch.",
            en="You are an expert software engineer. Write clean, production-ready code. Always include type hints. Output only the code with minimal comments.",
            language=lang,
        )
        arch_label = "Architektur" if lang == "de" else "Architecture"
        task_label = "Aufgabe" if lang == "de" else "Task"
        user_content = f"{arch_label}:\n{architecture}\n\n{task_label}:\n{task}" if architecture else task

        response = await self.llm.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_content},
            ],
            max_tokens=2000,
        )
        return response.choices[0].message.content
