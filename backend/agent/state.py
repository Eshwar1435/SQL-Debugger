from typing import TypedDict, Annotated, Optional
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    """
    The agent's working memory — passed between every node in the graph.

    LangGraph merges state between steps using the Annotated reducers.
    add_messages means new messages are APPENDED, not replaced.
    """

    # Conversation history (human + AI + tool messages)
    messages: Annotated[list, add_messages]

    # The original SQL the user provided (if any)
    original_sql: Optional[str]

    # The current SQL being worked on (may be rewritten by agent)
    current_sql: Optional[str]

    # Raw query results from the DB
    query_result: Optional[dict]

    # Raw EXPLAIN ANALYZE output
    execution_plan: Optional[list]

    # Database schema the agent has read
    schema_context: Optional[dict]

    # Any DB error message from the last execution attempt
    last_error: Optional[str]

    # Final output the agent reports back to the user
    final_report: Optional[str]

    # How many tool-calling iterations the agent has done
    iteration_count: int