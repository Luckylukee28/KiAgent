import asyncio
from typing import Callable

from agents.architect import ArchitectAgent
from agents.coder import CoderAgent
from agents.reviewer import ReviewerAgent
from agents.debate_agent import DebateJudge
from agents.parallel_agents import FrontendAgent, BackendCoderAgent
from agents.pm_agent import ProjectManagerAgent
from agents.self_improver import SelfImprover
from agents.gemini_agent import GeminiAgent, GeminiSynthesizer
from agents.mistral_agent import MistralAgent
from agents.openrouter_agent import OpenRouterAgent
from agents.openrouter_reasoning_agent import OpenRouterReasoningAgent
from agents.groq_utils import call_groq_with_retry
from memory.memory_manager import init_db, store_memory, search_memories


class Orchestrator:
    def __init__(
        self,
        groq_client,
        google_api_key: str = "",
        mistral_api_key: str = "",
        openrouter_api_key: str = "",
        openrouter_reasoning_key: str = "",
        enable_reasoning: bool = False,
    ):
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

        # OpenRouter with reasoning (more thorough but more tokens) — uses its own key
        # if provided, otherwise falls back to shared key when reasoning is enabled.
        reasoning_key = openrouter_reasoning_key or (openrouter_api_key if enable_reasoning else "")
        self.has_reasoning = bool(reasoning_key)
        if self.has_reasoning:
            self.openrouter_reasoning = OpenRouterReasoningAgent("OpenRouter Reasoning", reasoning_key)

    def _active_providers(self) -> list[str]:
        providers = ["Groq"]
        if self.has_gemini:
            providers.append("Gemini")
        if self.has_mistral:
            providers.append("Mistral")
        if self.has_openrouter:
            providers.append("OpenRouter")
        if self.has_reasoning:
            providers.append("OpenRouter Reasoning")
        return providers

    async def _debate_argue(self, provider: str, topic: str, transcript: str, lang: str) -> str:
        """Each AI model gives ONE short argument on the topic, seeing prior speakers."""
        is_de = lang == "de"
        position_hint = "(noch leer — du bist der Erste)" if is_de else "(empty — you go first)"
        prior = transcript.strip() if transcript.strip() else position_hint

        system = (
            f"Du bist {provider} in einer Architektur-Debatte. "
            f"Vertrete DEINE eigene Meinung in MAX 2 kurzen Sätzen. "
            f"Falls Vorredner sprachen: gehe knapp auf sie ein (zustimmen oder widersprechen). "
            f"Keine Floskeln, kein Wiederholen der Frage."
            if is_de else
            f"You are {provider} in an architecture debate. "
            f"Argue YOUR own view in MAX 2 short sentences. "
            f"If others spoke before: briefly engage with them (agree or disagree). "
            f"No fluff, no restating the question."
        )
        user_msg = (
            f"Aufgabe: {topic}\n\nBisherige Debatte:\n{prior}\n\nDein Argument:"
            if is_de else
            f"Task: {topic}\n\nDebate so far:\n{prior}\n\nYour argument:"
        )

        try:
            if provider == "Groq":
                return await call_groq_with_retry(
                    self.groq, model="llama-3.1-8b-instant",
                    messages=[{"role": "system", "content": system}, {"role": "user", "content": user_msg}],
                    max_tokens=120, lang=lang, agent_name=provider,
                )
            if provider == "Gemini":
                from google.genai import errors as genai_errors
                try:
                    resp = self.gemini.client.models.generate_content(
                        model="gemini-2.0-flash",
                        contents=f"{system}\n\n{user_msg}",
                    )
                    return (resp.text or "").strip()
                except genai_errors.ClientError as e:
                    return f"⚠️ Gemini ({e.code}) – übersprungen." if is_de else f"⚠️ Gemini ({e.code}) – skipped."
            if provider == "Mistral":
                try:
                    resp = await self.mistral.client.chat.complete_async(
                        model="mistral-small-latest",
                        messages=[{"role": "user", "content": f"{system}\n\n{user_msg}"}],
                        max_tokens=120,
                    )
                    return (resp.choices[0].message.content or "").strip()
                except Exception as e:
                    return f"⚠️ Mistral – {type(e).__name__}"
            if provider == "OpenRouter":
                try:
                    resp = await self.openrouter.client.chat.completions.create(
                        model="baidu/cobuddy:free",
                        messages=[{"role": "system", "content": system}, {"role": "user", "content": user_msg}],
                        max_tokens=120,
                    )
                    return (resp.choices[0].message.content or "").strip()
                except Exception as e:
                    return f"⚠️ OpenRouter – {type(e).__name__}"
        except Exception as e:
            return f"⚠️ {provider}-Fehler: {type(e).__name__}"
        return ""

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
        if self.has_reasoning:
            tasks.append(run_agent(self.openrouter_reasoning, f"OpenRouter Reasoning · {phase_name}", "OpenRouter Reasoning"))

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
        """Single follow-up question — agents collaborate, then synthesize.

        The previous-conversation context is baked into the task string so EVERY
        agent sees it, regardless of which context keys their execute() reads.
        """
        results = {}
        is_de = language == "de"

        async def emit(agent: str, content: str):
            results[agent] = content
            if broadcast:
                await broadcast({"agent": agent, "message": content})

        # Cap context to keep token usage reasonable (~5k chars ≈ 1.5k tokens)
        MAX_CTX = 5000
        trimmed_context = context[-MAX_CTX:] if len(context) > MAX_CTX else context

        if trimmed_context.strip():
            if is_de:
                task = (
                    "BISHERIGER PROJEKT-KONTEXT (vorherige Agenten-Ausgaben):\n"
                    "─────────────────────────────────────────────────────\n"
                    f"{trimmed_context}\n"
                    "─────────────────────────────────────────────────────\n\n"
                    f"FOLGEFRAGE DES NUTZERS:\n{message}\n\n"
                    "Wichtig: Beziehe dich konkret auf den Kontext oben. "
                    "Setze die Folgefrage direkt um — gib funktionierenden Code/Lösung, "
                    "nicht nur eine Erklärung. Falls Code geändert werden soll, "
                    "zeige die geänderte Stelle vollständig."
                )
            else:
                task = (
                    "PRIOR PROJECT CONTEXT (previous agent outputs):\n"
                    "─────────────────────────────────────────────\n"
                    f"{trimmed_context}\n"
                    "─────────────────────────────────────────────\n\n"
                    f"USER FOLLOW-UP:\n{message}\n\n"
                    "Important: Reference the context above directly. "
                    "Implement the follow-up — produce working code/solution, "
                    "not just an explanation. If code needs to change, show the "
                    "modified section in full."
                )
        else:
            task = message

        label = "💬 " + ("Folgefrage" if is_de else "Follow-up")
        await emit(label, "Alle Agenten bearbeiten deine Frage..." if is_de else "All agents working on your question...")

        result = await self._collaborate(
            task=task,
            groq_agent=self.coder,
            context={"is_follow_up": True},
            emit=emit,
            phase_name="Folgefrage" if is_de else "Follow-up",
            lang=language,
        )
        return result

    async def run_edit_pipeline(self, goal: str, existing_code: str, broadcast=None, language: str = "de") -> dict:
        results = {}
        lang = language
        is_de = lang == "de"

        async def emit(agent: str, content: str):
            results[agent] = content
            if broadcast:
                await broadcast({"agent": agent, "message": content})

        if len(existing_code) > 2000:
            try:
                from rag.indexer import ContextOptimizer
                rag_context = ContextOptimizer.build_context_from_text(existing_code, goal, max_tokens=4000)
                task = (
                    f"{rag_context}\n\n## Vollständiger Code (Referenz)\nAUFGABE (Änderungen durchführen):\n{goal}"
                    if is_de else
                    f"{rag_context}\n\n## Full Code (reference)\nTASK (implement changes):\n{goal}"
                )
            except Exception:
                task = (
                    f"BESTEHENDER CODE:\n```\n{existing_code}\n```\n\nAUFGABE (Änderungen durchführen):\n{goal}"
                    if is_de else
                    f"EXISTING CODE:\n```\n{existing_code}\n```\n\nTASK (implement changes):\n{goal}"
                )
        else:
            task = (
                f"BESTEHENDER CODE:\n```\n{existing_code}\n```\n\nAUFGABE (Änderungen durchführen):\n{goal}"
                if is_de else
                f"EXISTING CODE:\n```\n{existing_code}\n```\n\nTASK (implement changes):\n{goal}"
            )

        # Phase 1: Analysis
        await emit("Code Analyse", "Analysiere bestehenden Code..." if is_de else "Analyzing existing code...")
        plan = await self._collaborate(
            task=task,
            groq_agent=self.architect,
            context={"mode": "edit"},
            emit=emit,
            phase_name="Analyse" if is_de else "Analysis",
            lang=lang,
        )

        # Phase 2: Implementation
        await emit("Implementierung", "Implementiere Änderungen..." if is_de else "Implementing changes...")
        code = await self._collaborate(
            task=task,
            groq_agent=self.coder,
            context={"architecture": plan, "mode": "edit"},
            emit=emit,
            phase_name="Implementierung" if is_de else "Implementation",
            lang=lang,
        )

        # Phase 3: Review
        await self._collaborate(
            task=goal,
            groq_agent=self.reviewer,
            context={"code": code, "mode": "edit"},
            emit=emit,
            phase_name="Review",
            lang=lang,
        )

        return results

    async def run_debug_pipeline(self, goal: str, existing_code: str, error_message: str, broadcast=None, language: str = "de") -> dict:
        results = {}
        lang = language
        is_de = lang == "de"

        async def emit(agent: str, content: str):
            results[agent] = content
            if broadcast:
                await broadcast({"agent": agent, "message": content})

        error_block = f"FEHLERMELDUNG:\n{error_message}\n\n" if error_message else ""
        error_block_en = f"ERROR MESSAGE:\n{error_message}\n\n" if error_message else ""

        if len(existing_code) > 2000:
            try:
                from rag.indexer import ContextOptimizer
                bug_task = goal or ('Finde und behebe den Fehler.' if is_de else 'Find and fix the bug.')
                rag_context = ContextOptimizer.build_context_from_text(existing_code, bug_task, max_tokens=4000)
                debug_task = f"{rag_context}\n\n{error_block}AUFGABE:\n{bug_task}" if is_de else \
                             f"{rag_context}\n\n{error_block_en}TASK:\n{bug_task}"
            except Exception:
                debug_task = (
                    f"CODE MIT FEHLER:\n```\n{existing_code}\n```\n\n{error_block}"
                    f"AUFGABE:\n{goal or 'Finde und behebe den Fehler.'}"
                    if is_de else
                    f"CODE WITH BUG:\n```\n{existing_code}\n```\n\n{error_block_en}"
                    f"TASK:\n{goal or 'Find and fix the bug.'}"
                )
        else:
            debug_task = (
                f"CODE MIT FEHLER:\n```\n{existing_code}\n```\n\n{error_block}"
                f"AUFGABE:\n{goal or 'Finde und behebe den Fehler.'}"
                if is_de else
                f"CODE WITH BUG:\n```\n{existing_code}\n```\n\n{error_block_en}"
                f"TASK:\n{goal or 'Find and fix the bug.'}"
            )

        # Phase 1: Error Diagnosis
        await emit("Debug Analyse", "Analysiere Fehler und Code..." if is_de else "Analyzing error and code...")
        diagnosis = await self._collaborate(
            task=debug_task,
            groq_agent=self.reviewer,
            context={"mode": "debug"},
            emit=emit,
            phase_name="Diagnose" if is_de else "Diagnosis",
            lang=lang,
        )

        # Phase 2: Fix Generation
        await emit("Fix Generator", "Generiere Bugfix..." if is_de else "Generating bugfix...")
        await self._collaborate(
            task=debug_task,
            groq_agent=self.coder,
            context={"diagnosis": diagnosis, "mode": "debug"},
            emit=emit,
            phase_name="Bugfix",
            lang=lang,
        )

        return results

    def _enrich_with_vocab(self, task: str, language: str = "de") -> str:
        """Enrich task with vocabulary hints from the 194k word database."""
        try:
            from rag.indexer import VocabularyCache
            vc = VocabularyCache()
            return vc.enrich_task(task, lang='en')
        except Exception:
            return task

    def _enrich_with_project_context(self, task: str, project_path: str) -> str:
        """Retrieve relevant project snippets via RAG and prepend to task."""
        try:
            from rag.indexer import CodeRetriever, ContextOptimizer
            db_path = '/tmp/kiagent_rag.db'
            snippets = CodeRetriever.retrieve_from_db(task, db_path, project_path, top_k=6)
            if not snippets:
                return task
            context = ContextOptimizer.build_context(snippets, task, max_tokens=4000)
            return f"{context}\n\n## Aufgabe\n{task}"
        except Exception:
            return task

    async def run_pipeline(
        self, goal: str, broadcast: Callable[[dict], None] = None, language: str = "de",
        mode: str = "develop", existing_code: str = "", error_message: str = "",
        project_path: str = ""
    ) -> dict:
        await init_db()
        goal = self._enrich_with_vocab(goal, language)
        if mode == "edit":
            return await self.run_edit_pipeline(goal, existing_code, broadcast, language)
        if mode == "debug":
            return await self.run_debug_pipeline(goal, existing_code, error_message, broadcast, language)
        # develop mode — use RAG context if project_path provided
        if project_path:
            goal = self._enrich_with_project_context(goal, project_path)
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

        # ── PHASE 1: MULTI-MODEL DEBATE ──────────────────────────────
        # Each available AI model gives its own architectural opinion in turn,
        # seeing the previous speakers. Real different models = real different
        # views, not two roles played by the same Llama.
        debaters = ["Groq"]
        if self.has_gemini:     debaters.append("Gemini")
        if self.has_mistral:    debaters.append("Mistral")
        if self.has_openrouter: debaters.append("OpenRouter")

        intro = (
            f"🗣 Debatte ({len(debaters)} KI-Modelle): "
            + " → ".join(debaters)
            + "..."
            if is_de else
            f"🗣 Debate ({len(debaters)} AI models): "
            + " → ".join(debaters)
            + "..."
        )
        await emit("Debate", intro)
        self.judge._lang = lang

        phase_label = "Debatte" if is_de else "Debate"
        transcript_lines: list[str] = []
        for speaker in debaters:
            arg = await self._debate_argue(speaker, goal, "\n".join(transcript_lines), lang)
            # Use phase suffix so the debate contribution shows as a separate
            # sub-node under the base agent (alongside Frontend/Backend phases)
            await emit(f"{speaker} · {phase_label}", arg)
            transcript_lines.append(f"{speaker}: {arg}")

        verdict = await self.judge.judge(goal, "\n".join(transcript_lines))
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
