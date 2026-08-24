"""Vercel-compatible ASGI entry point."""

from global_lca_asset.api import create_app

app = create_app()
