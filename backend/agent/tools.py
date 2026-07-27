"""
All tools the LangGraph agent can call autonomously.
Each tool has a clear docstring — Claude reads these to decide when to use them.
"""
from langchain_core.tools import tool
from config import get_settings

settings = get_settings()


@tool
async def run_query(sql: str) -> dict:
    """
    Execute a SQL SELECT query against the PostgreSQL database.
    Use this to:
    - Test if a query works correctly
    - Verify a rewritten query returns the right results
    - Fetch data the user asked for
    Returns rows as list of dicts, row count, and column names.
    Do NOT use this for EXPLAIN — use run_explain_analyze for performance analysis.
    """
    from services.db import execute_sql
    try:
        result = await execute_sql(sql)
        return result
    except ValueError as e:
        return {"error": str(e), "rows": [], "row_count": 0}
    except Exception as e:
        return {"error": f"Unexpected error: {str(e)}", "rows": [], "row_count": 0}


@tool
async def run_explain_analyze(sql: str) -> dict:
    """
    Run EXPLAIN (ANALYZE, FORMAT JSON) on a SQL query.
    Use this to diagnose performance problems.
    Reveals:
    - Sequential scans vs index scans
    - Actual vs estimated row counts
    - Join strategies (hash join, nested loop, merge join)
    - Most expensive nodes in the query plan
    - Total execution time
    Always call this FIRST when user reports a slow or expensive query.
    """
    from services.db import execute_explain
    try:
        plan = await execute_explain(sql)
        # Extract key metrics for easier agent reasoning
        summary = _summarize_plan(plan)
        return {
            "plan": plan,
            "summary": summary
        }
    except ValueError as e:
        return {"error": str(e), "plan": [], "summary": {}}
    except Exception as e:
        return {"error": f"Unexpected error: {str(e)}", "plan": [], "summary": {}}


@tool
async def get_schema(table_name: str = "") -> dict:
    """
    Get the database schema — table names, column names, data types,
    primary keys, and foreign key relationships.
    If table_name is provided, returns schema for that specific table only.
    If table_name is empty string, returns schema for ALL tables.
    ALWAYS call this before writing new SQL so you use correct column names.
    """
    from services.schema import get_full_schema
    try:
        schema = await get_full_schema(table_name if table_name else None)
        return schema
    except Exception as e:
        return {"error": str(e), "tables": {}}


@tool
async def get_indexes(table_name: str) -> dict:
    """
    Get all existing indexes for a specific table.
    Use this after run_explain_analyze reveals a sequential scan —
    check if the needed index already exists before suggesting CREATE INDEX.
    Returns index name, columns covered, and whether it's unique.
    """
    from services.schema import get_table_indexes
    try:
        indexes = await get_table_indexes(table_name)
        return {
            "table": table_name,
            "indexes": indexes,
            "count": len(indexes)
        }
    except Exception as e:
        return {"error": str(e), "table": table_name, "indexes": []}


@tool
async def check_query_safety(sql: str) -> dict:
    """
    Check if a SQL query is safe to execute.
    Detects destructive operations: DROP, DELETE, TRUNCATE, ALTER, UPDATE, INSERT.
    Returns is_safe (bool) and reason if unsafe.
    ALWAYS call this before executing any user-provided SQL query.
    """
    dangerous = ["DROP", "DELETE", "TRUNCATE", "ALTER", "UPDATE", "INSERT"]
    upper_sql = sql.upper().strip()

    for keyword in dangerous:
        if upper_sql.startswith(keyword) or f" {keyword} " in upper_sql:
            if not settings.allow_destructive_queries:
                return {
                    "is_safe": False,
                    "reason": (
                        f"Query contains '{keyword}' which is not allowed. "
                        "Only SELECT queries are permitted."
                    ),
                }

    return {
        "is_safe": True,
        "reason": "Query is safe to execute."
    }


# ── Helper: summarize execution plan ─────────────────────────────────────────

def _summarize_plan(plan: list) -> dict:
    """
    Extract key metrics from EXPLAIN ANALYZE JSON output
    to make it easier for the agent to reason about.
    """
    if not plan or not isinstance(plan, list):
        return {}

    try:
        root = plan[0].get("Plan", {})

        seq_scans = []
        index_scans = []
        _walk_plan(root, seq_scans, index_scans)

        return {
            "total_execution_time_ms": plan[0].get("Execution Time", 0),
            "planning_time_ms": plan[0].get("Planning Time", 0),
            "root_node_type": root.get("Node Type", ""),
            "total_cost": root.get("Total Cost", 0),
            "actual_rows": root.get("Actual Rows", 0),
            "sequential_scans": seq_scans,
            "index_scans": index_scans,
            "has_seq_scans": len(seq_scans) > 0,
        }
    except Exception:
        return {}


def _walk_plan(node: dict, seq_scans: list, index_scans: list):
    """Recursively walk the plan tree collecting scan types."""
    node_type = node.get("Node Type", "")

    if node_type == "Seq Scan":
        seq_scans.append({
            "table": node.get("Relation Name", ""),
            "rows": node.get("Actual Rows", 0),
            "cost": node.get("Total Cost", 0),
        })
    elif "Index" in node_type:
        index_scans.append({
            "table": node.get("Relation Name", ""),
            "index": node.get("Index Name", ""),
            "rows": node.get("Actual Rows", 0),
        })

    for child in node.get("Plans", []):
        _walk_plan(child, seq_scans, index_scans)


# ── Export ────────────────────────────────────────────────────────────────────
AGENT_TOOLS = [
    run_query,
    run_explain_analyze,
    get_schema,
    get_indexes,
    check_query_safety,
]