import os
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
    env_file=os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        ".env",
    ),
    env_file_encoding="utf-8",
    case_sensitive=False,
    extra="ignore",
    )

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    env: str = Field(default="development", alias="ENV")

    # PostgreSQL
    db_host: str = Field(default="localhost", alias="DB_HOST")
    db_port: int = Field(default=5432, alias="DB_PORT")
    db_name: str = Field(default="sql_ai_agent", alias="DB_NAME")
    db_user: str = Field(default="postgres", alias="DB_USER")
    db_password: str = Field(default="", alias="DB_PASSWORD")

    # GROQ
    groq_api_key:  str = Field(
        default="",
        alias="GROQ_API_KEY"
    )

    # Query safety
    max_result_rows: int = Field(
        default=500,
        alias="MAX_RESULT_ROWS"
    )
    frontend_url: str = Field(
    default="http://localhost:5173",
    alias="FRONTEND_URL"
    )
    allow_destructive_queries: bool = Field(
    default=False,
    alias="ALLOW_DESTRUCTIVE_QUERIES"
    )
    query_timeout_seconds: int = Field(
    default=15,
    alias="QUERY_TIMEOUT_SECONDS"
    )

    agent_max_iterations: int = Field(
        default=10,
        alias="AGENT_MAX_ITERATIONS"
    )

    agent_timeout_seconds: int = Field(
        default=60,
        alias="AGENT_TIMEOUT_SECONDS"
    )


    @property
    def db_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


@lru_cache()
def get_settings() -> Settings:
    return Settings()