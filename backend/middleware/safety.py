"""
Safety middleware — HTTP layer that blocks dangerous SQL
before requests even reach the routes or agent.
This is the first line of defence.
"""
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
import json

DANGEROUS_KEYWORDS = ["DROP", "DELETE", "TRUNCATE", "ALTER", "UPDATE", "INSERT"]

PROTECTED_PATHS = ["/api/query/run", "/api/query/explain"]


class QuerySafetyMiddleware(BaseHTTPMiddleware):
    """
    Inspects POST request bodies on query endpoints.
    Blocks any SQL containing dangerous keywords
    unless ALLOW_DESTRUCTIVE_QUERIES=true in settings.
    """

    def __init__(self, app, allow_destructive: bool = False):
        super().__init__(app)
        self.allow_destructive = allow_destructive

    async def dispatch(self, request: Request, call_next):
        # Only inspect relevant endpoints
        if request.method == "POST" and request.url.path in PROTECTED_PATHS:
            if not self.allow_destructive:
                try:
                    data = await request.json()
                    sql = data.get("sql", "")

                    violation = self._check(sql)
                    if violation:
                        raise HTTPException(
                            status_code=403,
                            detail={
                                "error": "Unsafe query blocked",
                                "code": "UNSAFE_QUERY",
                                "reason": f"Query contains '{violation}' which is not allowed.",
                            }
                        )

                except json.JSONDecodeError:
                    pass  # Not JSON — let FastAPI handle it

        return await call_next(request)
    def _check(self, sql: str) -> str | None:
          upper = sql.upper().strip()

          for keyword in DANGEROUS_KEYWORDS:
              if upper.startswith(keyword) or f" {keyword} " in upper:
                  return keyword

          return None