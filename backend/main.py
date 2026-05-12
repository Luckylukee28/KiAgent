from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import AsyncGroq
import os

from websocket.manager import ConnectionManager
from orchestrator.orchestrator import Orchestrator

load_dotenv()

groq_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))
google_api_key = os.getenv("GOOGLE_API_KEY", "")
mistral_api_key = os.getenv("MISTRAL_API_KEY", "")
openrouter_api_key = os.getenv("OPENROUTER_API_KEY", "")
openrouter_reasoning_key = os.getenv("OPENROUTER_REASONING_API_KEY", "")
# Reasoning agent is active if a dedicated key is set, OR the flag is on
enable_reasoning = bool(openrouter_reasoning_key) or os.getenv("OPENROUTER_REASONING", "").lower() in ("1", "true", "yes", "on")

manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Multi-Agent Platform starting...")
    yield
    print("Shutting down...")


app = FastAPI(title="Multi-Agent Platform", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TaskRequest(BaseModel):
    goal: str
    language: str = "de"


class ChatRequest(BaseModel):
    message: str
    context: str = ""
    language: str = "de"


@app.get("/")
async def root():
    return {"status": "running", "agents": ["Architect", "Coder", "Reviewer"]}


@app.post("/api/run")
async def run_task(request: TaskRequest):
    orchestrator = Orchestrator(
        groq_client,
        google_api_key=google_api_key,
        mistral_api_key=mistral_api_key,
        openrouter_api_key=openrouter_api_key,
        openrouter_reasoning_key=openrouter_reasoning_key,
        enable_reasoning=enable_reasoning,
    )
    results = await orchestrator.run_pipeline(
        goal=request.goal,
        broadcast=manager.broadcast,
        language=request.language,
    )
    return {"status": "done", "results": results}


@app.post("/api/chat")
async def chat(request: ChatRequest):
    orchestrator = Orchestrator(
        groq_client,
        google_api_key=google_api_key,
        mistral_api_key=mistral_api_key,
        openrouter_api_key=openrouter_api_key,
        openrouter_reasoning_key=openrouter_reasoning_key,
        enable_reasoning=enable_reasoning,
    )
    result = await orchestrator.chat(
        message=request.message,
        context=request.context,
        broadcast=manager.broadcast,
        language=request.language,
    )
    return {"status": "done", "result": result}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo back for now; orchestrator sends via broadcast
            await websocket.send_text(f'{{"echo": "{data}"}}')
    except WebSocketDisconnect:
        manager.disconnect(websocket)
