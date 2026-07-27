import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.db import execute_sql, execute_explain

router = APIRouter()


class QueryRequest(BaseModel):
    sql: str


@router.post("/run")
async def run_query(request: QueryRequest):
    try:
        return await execute_sql(request.sql)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/explain")
async def explain_query(request: QueryRequest):
    try:
        plan = await execute_explain(request.sql)
        return {"plan": plan}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/schema")
async def get_schema(table: Optional[str] = None):
    from services.schema import get_full_schema
    try:
        return await get_full_schema(table)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze")
async def analyze_query(request: QueryRequest):
    """AI insights for Query mode — called after results are returned."""
    from langchain_groq import ChatGroq
    from langchain_core.messages import HumanMessage, SystemMessage
    from config import get_settings
    from services.schema import get_full_schema

    settings = get_settings()
    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        api_key=settings.groq_api_key,
        temperature=0,
        max_tokens=800,
    )

    try:
        schema = await get_full_schema()
        tables = list(schema.get("tables", {}).keys())
        schema_ctx = f"Available tables: {', '.join(tables)}"
    except Exception:
        schema_ctx = ""

    prompt = f"""Analyse this SQL query briefly. {schema_ctx}

```sql
{request.sql}
```

Use EXACTLY this format (be concise, no repetition):

## 🔍 Query Summary
One sentence: what this query does.

## 📋 Details
- **Tables:** list tables used
- **Operation:** SELECT / JOIN / aggregate / subquery
- **Complexity:** Low / Medium / High — one reason why

## ⚡ Performance Notes
Any seq scan risks, missing index suggestions, or "Looks good" if no issues.

## 💡 Tip
One actionable improvement or best practice. Skip if nothing useful to add."""

    try:
        r = await llm.ainvoke([
            SystemMessage(content="You are a SQL expert. Be concise and avoid repeating yourself."),
            HumanMessage(content=prompt),
        ])
        return {"analysis": r.content}
    except Exception as e:
        raw = str(e)
        if "429" in raw or "rate_limit" in raw.lower():
            m = re.search(r'try again in ([0-9]+m[0-9.]+s|[0-9]+\.[0-9]+s)', raw, re.I)
            raise HTTPException(429, detail=f"Rate limit. Try again in {m.group(1) if m else 'a few minutes'}.")
        raise HTTPException(500, detail=raw)