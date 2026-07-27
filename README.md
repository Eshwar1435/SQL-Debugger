# SQL AI Agent

An agentic AI system for SQL query debugging, optimization, and execution plan analysis. Built with LangGraph, FastAPI, PostgreSQL, and React.

---

## What it does

- **Natural Language → SQL** — type plain English, get a working SQL query
- **Debug SQL** — agent finds errors and suggests fixes autonomously
- **Optimize queries** — agent analyzes execution plans, detects seq scans, suggests indexes
- **Explain SQL** — get plain English explanations of complex queries
- **Execution Plan viewer** — visual tree of EXPLAIN ANALYZE output
- **Query history** — all runs saved locally with status

The agent is truly agentic — it autonomously calls tools (run query, check schema, analyze plan, check indexes) in a loop until it solves the problem. No manual steps between tool calls.

---

## Tech Stack

| Layer    | Technology                         |
| -------- | ---------------------------------- |
| Frontend | React + Vite + Tailwind CSS        |
| Editor   | Monaco Editor                      |
| Backend  | Python + FastAPI                   |
| AI Agent | LangGraph + LangChain              |
| LLM      | Groq API (Llama 3 70b) — free tier |
| Database | PostgreSQL + asyncpg               |

---

## Project Structure

```
sql-ai-agent/
├── backend/
│   ├── agent/
│   │   ├── graph.py      ← LangGraph agent loop
│   │   ├── nodes.py      ← agent thinking node
│   │   ├── tools.py      ← tools agent calls autonomously
│   │   └── state.py      ← agent working memory
│   ├── routes/
│   │   ├── agent.py      ← POST /api/agent/run
│   │   └── query.py      ← POST /api/query/run, /explain, GET /schema
│   ├── services/
│   │   ├── db.py         ← PostgreSQL pool + query execution
│   │   └── schema.py     ← table/column introspection
│   ├── middleware/
│   │   └── safety.py     ← blocks DROP/DELETE/TRUNCATE
│   ├── main.py           ← FastAPI app entry point
│   ├── config.py         ← settings from .env
│   ├── setup_db.sql      ← sample database setup
│   └── requirements.txt
└── frontend/
    └── src/
        ├── components/
        │   ├── TopBar.jsx
        │   ├── Sidebar.jsx
        │   ├── EditorPanel.jsx
        │   ├── AIPanel.jsx
        │   └── BottomPanel.jsx
        ├── store/
        │   └── useAppState.js
        └── api/
            └── client.js
```

---

## Setup Instructions

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Groq API key (free at console.groq.com)

---

### 1. Clone and setup backend

```bash
cd backend
python -m venv venv

# Mac/Linux
source venv/bin/activate

# Windows
venv\Scripts\activate

pip install -r requirements.txt
```

---

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sql_ai_agent
DB_USER=postgres
DB_PASSWORD=your_password

GROQ_API_KEY=gsk_xxxxxxxxxxxx

AGENT_MAX_ITERATIONS=10
QUERY_TIMEOUT_SECONDS=15
MAX_RESULT_ROWS=500
ALLOW_DESTRUCTIVE_QUERIES=false

FRONTEND_URL=http://localhost:5173
```

---

### 3. Create database and load sample data

```bash
psql -U postgres -c "CREATE DATABASE sql_ai_agent;"
psql -U postgres -d sql_ai_agent -f setup_db.sql
```

---

### 4. Start backend

```bash
uvicorn main:app --reload --port 8000
```

You should see:

```
✓ PostgreSQL connected
✓ Server ready on http://localhost:8000
```

---

### 5. Setup and start frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

---

## Usage

### SQL Mode

1. Type a SQL query in the editor
2. Select mode: Query / Debug / Optimize / Explain
3. Click the action button
4. See results in the bottom panel and AI report on the right

### Natural Language Mode

1. Toggle to **Natural Language** (top right)
2. Type a question in plain English
3. Click **Convert** or **Run Query**
4. Agent reads your schema, writes the SQL, and executes it

---

## Agent Tools

The agent autonomously calls these tools:

| Tool                  | Purpose                           |
| --------------------- | --------------------------------- |
| `get_schema`          | Read table/column structure       |
| `check_query_safety`  | Block dangerous queries           |
| `run_query`           | Execute SQL and get results       |
| `run_explain_analyze` | Get EXPLAIN ANALYZE output        |
| `get_indexes`         | Check existing indexes on a table |

---

## API Endpoints

| Method | Path                 | Description          |
| ------ | -------------------- | -------------------- |
| POST   | `/api/agent/run`     | Run agentic analysis |
| POST   | `/api/query/run`     | Execute SQL directly |
| POST   | `/api/query/explain` | Get execution plan   |
| GET    | `/api/query/schema`  | Get database schema  |
| GET    | `/health`            | Health check         |

---

## Notes

- Groq free tier: 100,000 tokens/day — enough for ~50 agent runs
- To use Anthropic Claude instead: install `langchain-anthropic`, change `ChatGroq` to `ChatAnthropic` in `agent/nodes.py`
- Destructive queries (DROP, DELETE) are blocked by default — set `ALLOW_DESTRUCTIVE_QUERIES=true` in `.env` to allow
