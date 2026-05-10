# Multi-Agent Platform – Quick Start

## 1. API Key eintragen

```bash
cp backend/.env.example backend/.env
# Dann backend/.env öffnen und Key eintragen:
# GROQ_API_KEY=gsk_...
```

Groq Key holen: https://console.groq.com → API Keys → Create API Key

## 2. Backend starten

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend läuft auf: http://localhost:8000

## 3. Frontend starten

```bash
cd frontend
npm run dev
```

Frontend läuft auf: http://localhost:3000

## 4. Testen

1. Browser öffnen → http://localhost:3000
2. Aufgabe eingeben, z.B.: "Build a REST API for a todo app"
3. Agenten antworten in Echtzeit

## Agenten (MVP)

| Agent     | Modell                   | Aufgabe              |
|-----------|--------------------------|----------------------|
| Architect | llama-3.3-70b-versatile  | Architektur designen |
| Coder     | llama-3.3-70b-versatile  | Code schreiben       |
| Reviewer  | llama-3.3-70b-versatile  | Code reviewen        |

## Nächste Schritte (Woche 2)

- [ ] Debate System: Agenten diskutieren Lösungen
- [ ] Parallel Tasks: Frontend + Backend gleichzeitig
- [ ] Shared Memory (pgvector)
- [ ] Docker Sandbox für Code-Ausführung
