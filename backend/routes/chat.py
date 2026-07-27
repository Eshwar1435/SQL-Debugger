import json
import re
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from config import get_settings

router = APIRouter()
settings = get_settings()

from langchain_groq import ChatGroq
chat_llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=settings.groq_api_key,
    temperature=0.3,
    max_tokens=2048,
)

SYSTEM_PROMPT = """You are a helpful SQL and database expert assistant embedded in a SQL IDE.
Help developers with SQL queries, execution plans, indexes, performance, and database concepts.
Be conversational, concise, and helpful. Use markdown for code.
Always use ```sql blocks for SQL. Remember conversation history and refer back naturally."""


class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    context_sql: Optional[str] = None


@router.post("/send")
async def send_message(request: ChatRequest):
    messages = [SystemMessage(content=SYSTEM_PROMPT)]
    if request.context_sql and request.context_sql.strip():
        messages.append(SystemMessage(
            content=f"Current SQL in editor:\n```sql\n{request.context_sql}\n```"
        ))
    for msg in request.history[-12:]:
        messages.append(HumanMessage(content=msg.content) if msg.role == 'user'
                        else AIMessage(content=msg.content))
    messages.append(HumanMessage(content=request.message))

    try:
        response = await chat_llm.ainvoke(messages)
        return {"reply": response.content}
    except Exception as e:
        raw = str(e)
        if "429" in raw or "rate_limit" in raw.lower():
            m = re.search(r'try again in ([0-9]+m[0-9.]+s|[0-9]+\.[0-9]+s)', raw, re.I)
            raise HTTPException(429, detail=f"Rate limit. Try again in {m.group(1) if m else 'a few minutes'}.")
        raise HTTPException(500, detail=raw)


@router.post("/stream")
async def stream_message(request: ChatRequest):
    messages = [SystemMessage(content=SYSTEM_PROMPT)]
    if request.context_sql and request.context_sql.strip():
        messages.append(SystemMessage(
            content=f"Current SQL in editor:\n```sql\n{request.context_sql}\n```"
        ))
    for msg in request.history[-12:]:
        messages.append(HumanMessage(content=msg.content) if msg.role == 'user'
                        else AIMessage(content=msg.content))
    messages.append(HumanMessage(content=request.message))

    async def event_stream():
        try:
            async for chunk in chat_llm.astream(messages):
                token = getattr(chunk, "content", "") or ""
                if token:
                    yield f"data: {json.dumps({'token': token})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            raw = str(e)
            if "429" in raw or "rate_limit" in raw.lower():
                m = re.search(r'try again in ([0-9]+m[0-9.]+s|[0-9]+\.[0-9]+s)', raw, re.I)
                message = f"Rate limit. Try again in {m.group(1) if m else 'a few minutes'}."
                yield f"data: {json.dumps({'error': message})}\n\n"
                return
            yield f"data: {json.dumps({'error': raw})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")