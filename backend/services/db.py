"""
Database service — PostgreSQL connection pool + query execution.
"""
import json
import asyncpg
from config import get_settings

settings = get_settings()
pool: asyncpg.Pool | None = None


async def init_db():
    global pool
    pool = await asyncpg.create_pool(
        host=settings.db_host,
        port=settings.db_port,
        database=settings.db_name,
        user=settings.db_user,
        password=settings.db_password,
        min_size=2,
        max_size=10,
        command_timeout=settings.query_timeout_seconds,
    )


async def close_db():
    global pool
    if pool:
        await pool.close()
        pool = None


async def execute_sql(sql: str) -> dict:
    if pool is None:
        raise RuntimeError("Database pool not initialised.")

    _check_safety(sql)
    clean = _strip_semicolon(sql)

    async with pool.acquire() as conn:
        try:
            await conn.execute(
                f"SET statement_timeout = '{settings.query_timeout_seconds * 1000}'"
            )
            records = await conn.fetch(clean)
            rows = [dict(r) for r in records[:settings.max_result_rows]]
            return {
                "rows":        rows,
                "row_count":   len(rows),
                "truncated":   len(records) > settings.max_result_rows,
                "total_count": len(records),
                "columns":     list(rows[0].keys()) if rows else [],
            }
        except asyncpg.PostgresError as e:
            raise ValueError(f"PostgreSQL error: {e.args[0]}") from e


async def execute_explain(sql: str) -> list:
    """
    Run EXPLAIN (ANALYZE, FORMAT JSON) and return parsed plan.
    Handles both asyncpg returning a parsed list and a raw JSON string.
    """
    if pool is None:
        raise RuntimeError("Database pool not initialised.")

    _check_safety(sql)
    clean = _strip_semicolon(sql)

    async with pool.acquire() as conn:
        try:
            result = await conn.fetchval(
                f"EXPLAIN (ANALYZE, FORMAT JSON) {clean}"
            )
            # asyncpg may return str or already-parsed list depending on version
            if isinstance(result, str):
                return json.loads(result)
            if result is None:
                return []
            return result
        except asyncpg.PostgresError as e:
            raise ValueError(f"PostgreSQL error during EXPLAIN: {e.args[0]}") from e


async def test_connection() -> bool:
    if pool is None:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return True
    except Exception:
        return False


DANGEROUS_KEYWORDS = ["DROP", "DELETE", "TRUNCATE", "ALTER", "UPDATE", "INSERT"]


def _check_safety(sql: str):
    if settings.allow_destructive_queries:
        return
    upper = sql.upper().strip()
    for kw in DANGEROUS_KEYWORDS:
        if upper.startswith(kw) or f" {kw} " in upper:
            raise ValueError(
                f"Query contains '{kw}' which is not permitted. "
                "Only SELECT queries are allowed."
            )


def _strip_semicolon(sql: str) -> str:
    """Remove trailing semicolons — they break EXPLAIN and parameterised calls."""
    return sql.strip().rstrip(';').strip()