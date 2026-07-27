from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from services.db import init_db, close_db, test_connection
from middleware.safety import QuerySafetyMiddleware
from routes.query import router as query_router
from routes.agent import router as agent_router
from routes.chat  import router as chat_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("⚡ Starting SQL AI Agent backend...")
    await init_db()
    ok = await test_connection()
    if not ok:
        raise RuntimeError("Could not connect to PostgreSQL — check your .env settings.")
    print("✓ PostgreSQL connected")
    print(f"✓ Server ready on http://{settings.host}:{settings.port}")
    yield
    await close_db()
    print("✓ Database pool closed")


app = FastAPI(
    title="SQL AI Agent",
    description="Agentic AI system for SQL debugging, optimization and execution plan analysis",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    QuerySafetyMiddleware,
    allow_destructive=settings.allow_destructive_queries,
)

app.include_router(query_router, prefix="/api/query", tags=["Query"])
app.include_router(agent_router, prefix="/api/agent", tags=["Agent"])
app.include_router(chat_router,  prefix="/api/chat",  tags=["Chat"])


@app.get("/health")
async def health():
    db_ok = await test_connection()
    return {
        "status":   "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
    }