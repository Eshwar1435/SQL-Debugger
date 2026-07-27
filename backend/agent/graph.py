"""
LangGraph agent graph — defines the agentic loop.

Flow:
    START → agent → tools → agent → tools → ... → END

The agent loops autonomously until it solves the problem
or hits the max iteration limit.
"""
from langgraph.graph import StateGraph, END
from agent.state import AgentState
from agent.nodes import agent_node, tool_node, should_continue


def build_agent_graph():
    graph = StateGraph(AgentState)

    # ── Nodes ─────────────────────────────────────────────────
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)

    # ── Entry point ───────────────────────────────────────────
    graph.set_entry_point("agent")

    # ── Edges ─────────────────────────────────────────────────
    # After agent thinks → call tools or end
    graph.add_conditional_edges(
        "agent",
        should_continue,
        {
            "tools": "tools",
            "end": END,
        },
    )

    # After tools run → always back to agent
    graph.add_edge("tools", "agent")

    return graph.compile()


# Compiled once at import time
agent_graph = build_agent_graph()