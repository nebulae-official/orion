"""Director service HTTP routes."""

from .content import router as content_router

__all__ = ["content_router"]
