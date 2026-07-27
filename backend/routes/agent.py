"""
Agent routes — exposes the LangGraph agent via HTTP.
"""
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from langchain_core.messages import HumanMessage

from agent.graph import agent_graph
from agent.state import AgentState

router = APIRouter()


class AgentRequest(BaseModel):
    message: str
    sql:     Optional[str] = None
    mode:    Optional[str] = "auto"


class AgentResponse(BaseModel):
    report:          str
    final_sql:       Optional[str] = None
    steps:           list          = []
    iteration_count: int           = 0


def _build_user_message(request: AgentRequest) -> str:
    mode_prompts = {
        "debug":     "Debug this SQL query. Find all errors, explain them, and provide a working fix.",
        "optimize":  "Optimize this SQL query for maximum performance. Analyze the execution plan and suggest improvements.",
        "explain":   "Explain what this SQL query does in plain English. Break it down step by step.",
        "nl_to_sql": "Convert this natural language question into a correct SQL query for the connected database.",
        "auto":      request.message,
    }
    base = mode_prompts.get(request.mode, request.message)
    msg  = base if request.mode == "auto" else f"{base}\n\nUser context: {request.message}"
    if request.sql:
        msg += f"\n\nSQL Query:\n```sql\n{request.sql}\n```"
    return msg


def _clean_error(raw: str) -> str:
    if "429" in raw or "rate_limit_exceeded" in raw.lower():
        wait_match = re.search(r'try again in ([0-9]+m[0-9.]+s|[0-9]+\.[0-9]+s)', raw, re.IGNORECASE)
        wait_time  = wait_match.group(1) if wait_match else "a few minutes"
        return f"Daily token limit reached. Please try again in {wait_time}."
    if "ECONNREFUSED" in raw or "connection refused" in raw.lower():
        return "Database connection refused. Check your DB_HOST and DB_PORT settings."
    if "password authentication" in raw.lower():
        return "Database authentication failed. Check DB_USER and DB_PASSWORD in .env."
    return raw


def _extract_steps(messages: list) -> list:
    steps = []
    seen  = set()
    for msg in messages:
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            for tc in msg.tool_calls:
                if tc["name"] not in seen:
                    seen.add(tc["name"])
                    steps.append({
                        "tool":   tc["name"],
                        "input":  tc["args"],
                        "status": "completed",
                    })
    return steps


@router.post("/run", response_model=AgentResponse)
async def run_agent(request: AgentRequest):
    user_message = _build_user_message(request)

    initial_state: AgentState = {
        "messages":        [HumanMessage(content=user_message)],
        "original_sql":    request.sql,
        "current_sql":     request.sql,
        "query_result":    None,
        "execution_plan":  None,
        "schema_context":  None,
        "last_error":      None,
        "final_report":    None,
        "iteration_count": 0,
    }

    try:
        final_state = await agent_graph.ainvoke(initial_state)
    except Exception as e:
        clean  = _clean_error(str(e))
        status = 429 if ("token limit" in clean.lower() or "rate" in clean.lower()) else 500
        raise HTTPException(status_code=status, detail=clean)

    last_message = final_state["messages"][-1]
    report = (
        last_message.content
        if hasattr(last_message, "content")
        else str(last_message)
    )

    return AgentResponse(
        report=report,
        final_sql=final_state.get("current_sql"),
        steps=_extract_steps(final_state["messages"]),
        iteration_count=final_state.get("iteration_count", 0),
    )