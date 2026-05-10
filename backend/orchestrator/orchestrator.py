import asyncio
from typing import Callable

from agents.architect import ArchitectAgent
from agents.coder import CoderAgent
from agents.reviewer import ReviewerAgent
from agents.debate_agent import DebateAgent, DebateJudge
from agents.parallel_agents import FrontendAgent, BackendCoderAgent
from agents.pm_agent import ProjectManagerAgent
from agents.self_improver import SelfImprover, build_improved_prompt
from memory.memory_manager import init_db, store_memory, search_memories


class Orchestrator:
    def __init__(self, groq_client):
        self.groq = groq_client
        self.architect = ArchitectAgent("Architect", groq_client)
        self.coder = CoderAgent("Coder", groq_client)
        self.reviewer = ReviewerAgent("Reviewer", groq_client)
        self.frontend_agent = FrontendAgent("Frontend Agent", groq_client)
        self.backend_agent = BackendCoderAgent("Backend Agent", groq_client)
        self.judge = DebateJudge("Judge", groq_client)
        self.pm = ProjectManagerAgent("Project Manager", groq_client)
        self.improver = SelfImprover("Self Improver", groq_client)

    async def run_pipeline(
        self, goal: str, broadcast: Callable[[dict], None] = None
    ) -> dict:
        await init_db()
        results = {}

        async def emit(agent: str, content: str):
            results[agent] = content
            if broadcast:
                await broadcast({"agent": agent, "message": content})

        # ── PHASE 0: PROJECT MANAGER ─────────────────────────────────
        await emit("Project Manager", "Erstelle Projektplan und Roadmap...")
        past_plans = await search_memories("Project Manager", goal, limit=2)
        pm_context = ""
        if past_plans:
            pm_context = "\n\nÄhnliche vergangene Projekte als Referenz:\n" + "\n".join(
                p["output"][:200] for p in past_plans
            )
        project_plan = await self.pm.execute(goal + pm_context)
        await emit("Project Manager", project_plan)
        await store_memory("Project Manager", goal, project_plan)

        # ── PHASE 1: DEBATE ──────────────────────────────────────────
        await emit("Debate", "Architektur-Debatte startet...")

        agent_a = DebateAgent("Agent A", self.groq, "Use a monolithic architecture for simplicity and faster MVP delivery")
        agent_b = DebateAgent("Agent B", self.groq, "Use a microservices architecture for scalability and separation of concerns")

        arg_a = await agent_a.argue(goal)
        await emit("Agent A", arg_a)

        arg_b = await agent_b.argue(goal, previous_arguments=f"Agent A: {arg_a}")
        await emit("Agent B", arg_b)

        arg_a2 = await agent_a.argue(goal, previous_arguments=f"Agent A: {arg_a}\nAgent B: {arg_b}")
        await emit("Agent A", arg_a2)

        transcript = f"Agent A: {arg_a}\nAgent B: {arg_b}\nAgent A rebuttal: {arg_a2}"
        verdict = await self.judge.judge(goal, transcript)
        await emit("Judge", verdict)

        # ── PHASE 2: ARCHITECTURE ────────────────────────────────────
        await emit("Architect", "Entwerfe Architektur basierend auf dem Debattenergebnis...")
        past_arch = await search_memories("Architect", goal, limit=2)
        arch_hint = "\n\nPast successful architectures:\n" + "\n".join(
            p["output"][:300] for p in past_arch
        ) if past_arch else ""
        architecture = await self.architect.execute(goal + arch_hint, context={"debate_verdict": verdict})
        await emit("Architect", architecture)
        await store_memory("Architect", goal, architecture)

        # ── PHASE 3: PARALLEL CODING ─────────────────────────────────
        await emit("System", "Paralleles Coding startet: Frontend & Backend gleichzeitig...")

        frontend_task = self.frontend_agent.execute(goal, context={"architecture": architecture})
        backend_task = self.backend_agent.execute(goal, context={"architecture": architecture})
        frontend_code, backend_code = await asyncio.gather(frontend_task, backend_task)

        await emit("Frontend Agent", frontend_code)
        await emit("Backend Agent", backend_code)
        await store_memory("Frontend Agent", goal, frontend_code)
        await store_memory("Backend Agent", goal, backend_code)

        # ── PHASE 4: SELF-IMPROVEMENT ────────────────────────────────
        await emit("Self Improver", "Bewerte Outputs und speichere Erkenntnisse...")
        fe_eval, be_eval = await asyncio.gather(
            self.improver.evaluate(goal, frontend_code, "Frontend Agent"),
            self.improver.evaluate(goal, backend_code, "Backend Agent"),
        )
        await emit("Self Improver", f"**Frontend-Bewertung:**\n{fe_eval}\n\n**Backend-Bewertung:**\n{be_eval}")

        # ── PHASE 5: REVIEW ──────────────────────────────────────────
        await emit("Reviewer", "Überprüfe den gesamten generierten Code...")
        combined = f"FRONTEND:\n{frontend_code}\n\nBACKEND:\n{backend_code}"
        review = await self.reviewer.execute(goal, context={"code": combined})
        await emit("Reviewer", review)
        await store_memory("Reviewer", goal, review)

        return results
