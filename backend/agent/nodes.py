from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage
from langgraph.prebuilt import ToolNode
from config import get_settings
from agent.state import AgentState
from agent.tools import AGENT_TOOLS

settings = get_settings()

llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=settings.groq_api_key,
    temperature=0,
    max_tokens=4096,
)
llm_with_tools = llm.bind_tools(AGENT_TOOLS)

SYSTEM_PROMPT = """You are an expert PostgreSQL database engineer and performance tuning specialist.
You have access to a live PostgreSQL database and tools you can call autonomously.

## Tool calling strategy
1. ALWAYS call get_schema first when writing new SQL — you need column names and types
2. ALWAYS call check_query_safety before executing any user-provided SQL
3. For slow queries → run_explain_analyze first, then get_indexes if you see seq scans
4. For broken queries → check_query_safety, then run_query to see the actual error
5. Always call run_query to verify your final SQL actually works before reporting

## CRITICAL WORDING RULES
- Optimize mode: NEVER say you "created" or "added" an index. Always say
  "Recommended:" or "Suggested:" — indexes are recommendations ONLY, not executed actions.
- Debug mode: ALWAYS execute the corrected SQL with run_query and confirm it runs successfully.
- ALWAYS wrap your Final SQL in a ```sql code block — this is mandatory.

## Final report format — use EXACTLY these headers:

## 🔍 What I Found
[What the problem is or what the query does]

## 🔧 What I Changed
[Debug: exact changes. Optimize: use "Recommended:" for every index suggestion]

## ⚡ Why This Is Better
[Performance reasoning or "N/A"]

## ✅ Final SQL
```sql
[working SQL here — mandatory code block]
```

## 📊 Performance Notes
[Execution plan findings, recommendations as suggestions not actions]
"""


async def agent_node(state: AgentState) -> AgentState:
    messages = [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
    response = await llm_with_tools.ainvoke(messages)
    return {
        **state,
        "messages": [response],
        "iteration_count": state.get("iteration_count", 0) + 1,
    }


tool_node = ToolNode(AGENT_TOOLS)


def should_continue(state: AgentState) -> str:
    if state.get("iteration_count", 0) >= settings.agent_max_iterations:
        return "end"
    last = state["messages"][-1]
    if hasattr(last, "tool_calls") and last.tool_calls:
        return "tools"
    return "end"