import asyncio
from typing import Callable

from agents.architect import ArchitectAgent
from agents.coder import CoderAgent
from agents.reviewer import ReviewerAgent
from agents.debate_agent import DebateAgent, DebateJudge
from agents.parallel_agents import FrontendAgent, BackendCoderAgent
from agents.pm_agent import ProjectManagerAgent
from agents.self_improver import SelfImprover
from agents.gemini_agent import GeminiAgent, GeminiSynthesizer
from memory.memory_manager import init_db, store_memory, search_memories


class Orchestrator:
    def __init__(self, groq_client, google_api_key: str = ""):
        self.groq = groq_client
        self.google_api_key = google_api_key

        # Groq agents
        self.architect = ArchitectAgent("Architect", groq_client)
        self.coder = CoderAgent("Coder", groq_client)
        self.reviewer = ReviewerAgent("Reviewer", groq_client)
        self.frontend_agent = FrontendAgent("Frontend Agent", groq_client)
        self.backend_agent = BackendCoderAgent("Backend Agent", groq_client)
        self.judge = DebateJudge("Judge", groq_client)
        self.pm = ProjectManagerAgent("Project Manager", groq_client)
        self.improver = SelfImprover("Self Improver", groq_client)

        # Gemini agents (only if key provided)
        self.has_gemini = bool(google_api_key)
        if self.has_gemini:
            self.gemini_architect = GeminiAgent("Gemini", google_api_key, role="Architektur-Review")
            self.gemini_frontend = GeminiAgent("Gemini", google_api_key, role="Frontend-Review")
            self.gemini_backend = GeminiAgent("Gemini", google_api_key, role="Backend-Review")
            self.gemini_reviewer = GeminiAgent("Gemini", google_api_key, role="Code-Review")
            self.synthesizer = GeminiSynthesizer("Synthesizer", google_api_key)

    async def _collaborate(
        self,
        task: str,
        groq_agent,
        gemini_agent,
        context: dict,
        emit: Callable,
        phase_name: str,
        lang: str,
    ) -> str:
        """Run Groq → Gemini → Synthesizer for any task."""
        is_de = lang == "de"

        # Round 1: Groq proposes
        groq_label = f"Groq · {phase_name}"
        thinking = "Erarbeite Lösung..." if is_de else "Working on solution..."
        await emit(groq_label, thinking)
        groq_output = await groq_agent.execute(task, {**context, "language": lang})
        await emit(groq_label, groq_output)

        if not self.has_gemini:
            return groq_output

        # Round 2: Gemini reviews Groq's output
        gemini_label = f"Gemini · {phase_name}"
        review_msg = "Überprüfe und verbessere Groq-Vorschlag..." if is_de else "Reviewing and improving Groq's proposal..."
        await emit(gemini_label, review_msg)
        gemini_output = await gemini_agent.execute(
            task, {**context, "language": lang, "groq_output": groq_output, "phase": phase_name}
        )
        await emit(gemini_label, gemini_output)

        # Round 3: Synthesizer combines best of both
        synth_label = "Synthesizer"
        synth_msg = "Kombiniere das Beste aus Groq und Gemini..." if is_de else "Combining the best of Groq and Gemini..."
        await emit(synth_label, synth_msg)
        final = await self.synthesizer.execute(
            task, {"language": lang, "groq_output": groq_output, "gemini_output": gemini_output}
        )
        await emit(synth_label, final)
        return final

    async def run_pipeline(
        self, goal: str, broadcast: Callable[[dict], None] = None, language: str = "de"
    ) -> dict:
        await init_db()
        results = {}
        lang = language
        is_de = lang == "de"

        async def emit(agent: str, content: str):
            results[agent] = content
            if broadcast:
                await broadcast({"agent": agent, "message": content})

        # ── PHASE 0: PROJECT MANAGER ─────────────────────────────────
        await emit("Project Manager", "Erstelle Projektplan..." if is_de else "Creating project plan...")
        past_plans = await search_memories("Project Manager", goal, limit=2)
        pm_context = ("\n\nÄhnliche Projekte:\n" if is_de else "\n\nSimilar past projects:\n") + "\n".join(
            p["output"][:200] for p in past_plans
        ) if past_plans else ""
        project_plan = await self.pm.execute(goal + pm_context, context={"language": lang})
        await emit("Project Manager", project_plan)
        await store_memory("Project Manager", goal, project_plan)

        # ── PHASE 1: DEBATE ──────────────────────────────────────────
        await emit("Debate", "Architektur-Debatte startet..." if is_de else "Starting architecture debate...")
        pos_a = "Monolithische Architektur für Einfachheit und schnelle MVP-Entwicklung" if is_de else "Monolithic architecture for simplicity and faster MVP delivery"
        pos_b = "Microservices-Architektur für Skalierbarkeit und Trennung der Zuständigkeiten" if is_de else "Microservices architecture for scalability and separation of concerns"
        agent_a = DebateAgent("Agent A", self.groq, pos_a, language=lang)
        agent_b = DebateAgent("Agent B", self.groq, pos_b, language=lang)
        self.judge._lang = lang

        arg_a = await agent_a.argue(goal)
        await emit("Agent A", arg_a)
        arg_b = await agent_b.argue(goal, previous_arguments=f"Agent A: {arg_a}")
        await emit("Agent B", arg_b)
        arg_a2 = await agent_a.argue(goal, previous_arguments=f"Agent A: {arg_a}\nAgent B: {arg_b}")
        await emit("Agent A", arg_a2)
        transcript = f"Agent A: {arg_a}\nAgent B: {arg_b}\nAgent A: {arg_a2}"
        verdict = await self.judge.judge(goal, transcript)
        await emit("Judge", verdict)

        # ── PHASE 2: ARCHITECTURE COLLABORATION ──────────────────────
        await emit("Collaboration", "🤝 Groq + Gemini arbeiten gemeinsam an der Architektur..." if is_de else "🤝 Groq + Gemini collaborating on architecture...")
        architecture = await self._collaborate(
            task=goal,
            groq_agent=self.architect,
            gemini_agent=self.gemini_architect if self.has_gemini else self.architect,
            context={"debate_verdict": verdict},
            emit=emit,
            phase_name="Architektur" if is_de else "Architecture",
            lang=lang,
        )
        await store_memory("Architect", goal, architecture)

        # ── PHASE 3: PARALLEL CODING COLLABORATION ───────────────────
        await emit("Collaboration", "🤝 Paralleles Coding: Groq + Gemini gleichzeitig an Frontend & Backend..." if is_de else "🤝 Parallel coding: Groq + Gemini on Frontend & Backend simultaneously...")

        async def frontend_collab():
            return await self._collaborate(
                task=goal,
                groq_agent=self.frontend_agent,
                gemini_agent=self.gemini_frontend if self.has_gemini else self.frontend_agent,
                context={"architecture": architecture},
                emit=emit,
                phase_name="Frontend",
                lang=lang,
            )

        async def backend_collab():
            return await self._collaborate(
                task=goal,
                groq_agent=self.backend_agent,
                gemini_agent=self.gemini_backend if self.has_gemini else self.backend_agent,
                context={"architecture": architecture},
                emit=emit,
                phase_name="Backend",
                lang=lang,
            )

        frontend_code, backend_code = await asyncio.gather(frontend_collab(), backend_collab())
        await store_memory("Frontend Agent", goal, frontend_code)
        await store_memory("Backend Agent", goal, backend_code)

        # ── PHASE 4: SELF-IMPROVEMENT ────────────────────────────────
        await emit("Self Improver", "Bewerte Outputs und speichere Erkenntnisse..." if is_de else "Evaluating outputs and storing learnings...")
        fe_eval, be_eval = await asyncio.gather(
            self.improver.evaluate(goal, frontend_code, "Frontend Agent", lang),
            self.improver.evaluate(goal, backend_code, "Backend Agent", lang),
        )
        fe_label = "Frontend-Bewertung" if is_de else "Frontend Evaluation"
        be_label = "Backend-Bewertung" if is_de else "Backend Evaluation"
        await emit("Self Improver", f"**{fe_label}:**\n{fe_eval}\n\n**{be_label}:**\n{be_eval}")

        # ── PHASE 5: REVIEW COLLABORATION ────────────────────────────
        await emit("Collaboration", "🤝 Groq + Gemini reviewen gemeinsam den Code..." if is_de else "🤝 Groq + Gemini reviewing code together...")
        combined_code = f"FRONTEND:\n{frontend_code}\n\nBACKEND:\n{backend_code}"
        await self._collaborate(
            task=goal,
            groq_agent=self.reviewer,
            gemini_agent=self.gemini_reviewer if self.has_gemini else self.reviewer,
            context={"code": combined_code},
            emit=emit,
            phase_name="Review",
            lang=lang,
        )

        return results
