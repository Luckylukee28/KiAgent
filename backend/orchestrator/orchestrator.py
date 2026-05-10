import asyncio
from typing import Callable

from agents.architect import ArchitectAgent
from agents.coder import CoderAgent
from agents.reviewer import ReviewerAgent
from agents.debate_agent import DebateAgent, DebateJudge
from agents.parallel_agents import FrontendAgent, BackendCoderAgent


class Orchestrator:
    def __init__(self, groq_client):
        self.groq = groq_client
        self.architect = ArchitectAgent("Architect", groq_client)
        self.coder = CoderAgent("Coder", groq_client)
        self.reviewer = ReviewerAgent("Reviewer", groq_client)
        self.frontend_agent = FrontendAgent("Frontend Agent", groq_client)
        self.backend_agent = BackendCoderAgent("Backend Agent", groq_client)
        self.judge = DebateJudge("Judge", groq_client)

    async def run_pipeline(
        self, goal: str, broadcast: Callable[[dict], None] = None
    ) -> dict:
        results = {}

        async def emit(agent: str, content: str):
            results[agent] = content
            if broadcast:
                await broadcast({"agent": agent, "message": content})

        # ── PHASE 1: DEBATE ──────────────────────────────────────────
        await emit("Debate", "Starting architecture debate...")

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
        await emit("Architect", "Designing architecture based on debate outcome...")
        architecture = await self.architect.execute(
            goal, context={"debate_verdict": verdict}
        )
        await emit("Architect", architecture)

        # ── PHASE 3: PARALLEL CODING ─────────────────────────────────
        await emit("System", "Starting parallel coding: Frontend & Backend simultaneously...")

        frontend_task = self.frontend_agent.execute(goal, context={"architecture": architecture})
        backend_task = self.backend_agent.execute(goal, context={"architecture": architecture})

        frontend_code, backend_code = await asyncio.gather(frontend_task, backend_task)

        await emit("Frontend Agent", frontend_code)
        await emit("Backend Agent", backend_code)

        # ── PHASE 4: REVIEW ──────────────────────────────────────────
        await emit("Reviewer", "Reviewing all generated code...")
        combined = f"FRONTEND:\n{frontend_code}\n\nBACKEND:\n{backend_code}"
        review = await self.reviewer.execute(goal, context={"code": combined})
        await emit("Reviewer", review)

        return results
