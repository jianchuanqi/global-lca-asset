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
    api_token: str | None = None
    enable_expert_cypher: bool = False
    seed_path: Path = Path("data/seed/inventory-v2.public.json")
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://127.0.0.1:3080", "http://localhost:3080"]
    )
    max_query_rows: int = 500

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        """Accept comma-separated origins from Docker-style environment files."""
        if isinstance(value, str):
            return [part.strip() for part in value.split(",") if part.strip()]
        return value
