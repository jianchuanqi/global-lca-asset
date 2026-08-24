"""Runtime configuration loaded from environment variables."""

from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings shared by the API and importer."""

    model_config = SettingsConfigDict(env_prefix="LCA_", env_file=".env", extra="ignore")

    graph_backend: str = "neo4j"
    neo4j_uri: str = "bolt://127.0.0.1:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "global-lca-local"
    neo4j_database: str = "neo4j"
    neo4j_connection_timeout_seconds: float = Field(default=5.0, gt=0, le=30)
    neo4j_query_timeout_seconds: float = Field(default=10.0, gt=0, le=60)
    neo4j_max_connection_pool_size: int = Field(default=10, ge=1, le=100)
    api_token: str | None = None
    enable_expert_cypher: bool = False
    seed_path: Path = Path("data/seed/inventory-v2.public.json")
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://127.0.0.1:3080", "http://localhost:3080"]
    )
    max_query_rows: int = 500
    mcp_enabled: bool = True
    mcp_trust_proxy: bool = False
    mcp_allowed_hosts: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["127.0.0.1", "127.0.0.1:*", "localhost", "localhost:*"]
    )
    mcp_allowed_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)
    mcp_max_request_body_bytes: int = Field(default=65_536, ge=4_096, le=1_048_576)

    @field_validator("cors_origins", "mcp_allowed_hosts", "mcp_allowed_origins", mode="before")
    @classmethod
    def split_csv(cls, value: object) -> object:
        """Accept comma-separated lists from Docker and Vercel environment variables."""
        if isinstance(value, str):
            return [part.strip() for part in value.split(",") if part.strip()]
        return value
