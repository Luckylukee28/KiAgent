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
from agents.mistral_agent import MistralAgent
from agents.openrouter_agent import OpenRouterAgent
from memory.memory_manager import init_db, store_memory, search_memories


class Orchestrator:
    def __init__(self, groq_client, google_api_key: str = "", mistral_api_key: str = "", openrouter_api_key: str = ""):
        self.groq = groq_client

        # Groq agents (always available)
        self.architect = ArchitectAgent("Architect", groq_client)
        self.coder = CoderAgent("Coder", groq_client)
        self.reviewer = ReviewerAgent("Reviewer", groq_client)
        self.frontend_agent = FrontendAgent("Frontend Agent", groq_client)
        self.backend_agent = BackendCoderAgent("Backend Agent", groq_client)
        self.judge = DebateJudge("Judge", groq_client)
        self.pm = ProjectManagerAgent("Project Manager", groq_client)
        self.improver = SelfImprover("Self Improver", groq_client)

        # Gemini agents
        self.has_gemini = bool(google_api_key)
        if self.has_gemini:
            self.gemini = GeminiAgent("Gemini", google_api_key)
            self.synthesizer = GeminiSynthesizer("Synthesizer", google_api_key)

        # Mistral agents
        self.has_mistral = bool(mistral_api_key)
        if self.has_mistral:
            self.mistral = MistralAgent("Mistral", mistral_api_key)

        # OpenRouter agents
        self.has_openrouter = bool(openrouter_api_key)
        if self.has_openrouter:
            self.openrouter = OpenRouterAgent("OpenRouter", openrouter_api_key)

    def _active_providers(self) -> list[str]:
        providers = ["Groq"]
        if self.has_gemini:
            providers.append("Gemini")
        if self.has_mistral:
            providers.append("Mistral")
        if self.has_openrouter:
            providers.append("OpenRouter")
        return providers

    async def _collaborate(
        self,
        task: str,
        groq_agent,
        context: dict,
        emit: Callable,
        phase_name: str,
        lang: str,
    ) -> str:
        """Run all available agents in parallel, then synthesize."""
        is_de = lang == "de"

        async def run_agent(agent, label: str, provider: str) -> tuple[str, str]:
            thinking = "Erarbeite Lösung..." if is_de else "Working on solution..."
            await emit(label, thinking)
            output = await agent.execute(task, {**context, "language": lang, "phase": phase_name})
            await emit(label, output)
            return provider, output

        tasks = [run_agent(groq_agent, f"Groq · {phase_name}", "Groq")]

        if self.has_gemini:
            tasks.append(run_agent(self.gemini, f"Gemini · {phase_name}", "Gemini"))
        if self.has_mistral:
            tasks.append(run_agent(self.mistral, f"Mistral · {phase_name}", "Mistral"))
        if self.has_openrouter:
            tasks.append(run_agent(self.openrouter, f"OpenRouter · {phase_name}", "OpenRouter"))

        results = await asyncio.gather(*tasks)
        agent_outputs = dict(results)

        # If only Groq available or Gemini synthesizer not present, return Groq output
        if not self.has_gemini or len(agent_outputs) == 1:
            return agent_outputs["Groq"]

        # Synthesize all outputs
        synth_msg = f"Kombiniere {len(agent_outputs)} KI-Antworten..." if is_de else f"Combining {len(agent_outputs)} AI responses..."
        await emit("Synthesizer", synth_msg)
        final = await self.synthesizer.execute(
            task, {"language": lang, "agent_outputs": agent_outputs}
        )
        await emit("Synthesizer", final)
        return final

    async def chat(
        self, message: str, context: str = "", broadcast=None, language: str = "de"
    ) -> str:
        """Single follow-up question — all agents collaborate, then synthesize."""
        results = {}
        is_de = language == "de"

        async def emit(agent: str, content: str):
            results[agent] = content
            if broadcast:
                await broadcast({"agent": agent, "message": content})

        task = message
        ctx = {"previous_context": context} if context else {}

        label = "💬 " + ("Folgefrage" if is_de else "Follow-up")
        await emit(label, "Alle Agenten bearbeiten deine Frage..." if is_de else "All agents working on your question...")

        result = await self._collaborate(
            task=task,
            groq_agent=self.coder,
            context=ctx,
            emit=emit,
            phase_name="Folgefrage" if is_de else "Follow-up",
            lang=language,
        )
        return result

    async def run_pipeline(
        self, goal: str, broadcast: Callable[[dict], None] = None, language: str = "de"
    ) -> dict:
        await init_db()
        results = {}
        lang = language
        is_de = lang == "de"

        providers = self._active_providers()
        provider_list = " + ".join(providers)

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
        collab_msg = f"🤝 {provider_list} arbeiten gemeinsam an der Architektur..." if is_de else f"🤝 {provider_list} collaborating on architecture..."
        await emit("Collaboration", collab_msg)
        architecture = await self._collaborate(
            task=goal,
            groq_agent=self.architect,
            context={"debate_verdict": verdict},
            emit=emit,
            phase_name="Architektur" if is_de else "Architecture",
            lang=lang,
        )
        await store_memory("Architect", goal, architecture)

        # ── PHASE 3: PARALLEL CODING COLLABORATION ───────────────────
        collab_msg2 = f"🤝 Paralleles Coding: {provider_list} gleichzeitig an Frontend & Backend..." if is_de else f"🤝 Parallel coding: {provider_list} on Frontend & Backend simultaneously..."
        await emit("Collaboration", collab_msg2)

        async def frontend_collab():
            return await self._collaborate(
                task=goal,
                groq_agent=self.frontend_agent,
                context={"architecture": architecture},
                emit=emit,
                phase_name="Frontend",
                lang=lang,
            )

        async def backend_collab():
            return await self._collaborate(
                task=goal,
                groq_agent=self.backend_agent,
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
        collab_msg3 = f"🤝 {provider_list} reviewen gemeinsam den Code..." if is_de else f"🤝 {provider_list} reviewing code together..."
        await emit("Collaboration", collab_msg3)
        combined_code = f"FRONTEND:\n{frontend_code}\n\nBACKEND:\n{backend_code}"
        await self._collaborate(
            task=goal,
            groq_agent=self.reviewer,
            context={"code": combined_code},
            emit=emit,
            phase_name="Review",
            lang=lang,
        )

        return results
