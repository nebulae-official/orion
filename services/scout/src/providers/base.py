"""Abstract base class for trend data providers."""

from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, Field


class TrendResult(BaseModel):
    """A single trend result from any provider."""

    topic: str = Field(description="The trending topic or keyword")
    score: float = Field(ge=0.0, le=100.0, description="Relevance score (0-100)")
    source: str = Field(description="Provider source identifier")
    raw_data: dict[str, Any] | None = None


class TrendProvider(ABC):
    """Base class for all trend data providers.

    Subclasses must implement ``fetch_trends`` to return a list of
    :class:`TrendResult` objects from their respective data source.
    """

    @abstractmethod
    async def fetch_trends(self, region: str = "US", limit: int = 20) -> list[TrendResult]:
        """Fetch current trends from the provider.

        Args:
            region: Geographic region code (e.g. "US", "GB").
            limit: Maximum number of trends to return.

        Returns:
            List of trend results ordered by relevance score descending.
        """
        ...
