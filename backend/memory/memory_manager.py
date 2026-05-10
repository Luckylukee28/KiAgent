import aiosqlite
import json
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "memory.db"


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent TEXT NOT NULL,
                task TEXT NOT NULL,
                output TEXT NOT NULL,
                score REAL DEFAULT 0,
                tags TEXT DEFAULT '[]',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS agent_learning (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_name TEXT NOT NULL,
                problem TEXT NOT NULL,
                solution TEXT NOT NULL,
                outcome_score REAL NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.commit()


async def store_memory(agent: str, task: str, output: str, score: float = 0.0, tags: list = []):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO memories (agent, task, output, score, tags) VALUES (?, ?, ?, ?, ?)",
            (agent, task, output, score, json.dumps(tags)),
        )
        await db.commit()


async def search_memories(query: str, agent: str = None, limit: int = 3) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        words = query.lower().split()[:5]
        like_clauses = " OR ".join(["lower(task) LIKE ?" for _ in words])
        params = [f"%{w}%" for w in words]

        if agent:
            sql = f"""SELECT * FROM memories WHERE agent = ? AND ({like_clauses})
                      ORDER BY score DESC, created_at DESC LIMIT ?"""
            params = [agent] + params + [limit]
        else:
            sql = f"""SELECT * FROM memories WHERE {like_clauses}
                      ORDER BY score DESC, created_at DESC LIMIT ?"""
            params = params + [limit]

        async with db.execute(sql, params) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]


async def store_learning(agent_name: str, problem: str, solution: str, score: float):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO agent_learning (agent_name, problem, solution, outcome_score) VALUES (?, ?, ?, ?)",
            (agent_name, problem, solution, score),
        )
        await db.commit()


async def get_best_patterns(agent_name: str, problem: str, limit: int = 2) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        words = problem.lower().split()[:4]
        like_clauses = " OR ".join(["lower(problem) LIKE ?" for _ in words])
        params = [agent_name] + [f"%{w}%" for w in words] + [limit]
        sql = f"""SELECT * FROM agent_learning
                  WHERE agent_name = ? AND ({like_clauses})
                  ORDER BY outcome_score DESC LIMIT ?"""
        async with db.execute(sql, params) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]
