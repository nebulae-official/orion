"""Repository for provider_costs table."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import structlog
from sqlalchemy import DateTime, Float, String, func, select
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from orion_common.db import Base

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# ORM Model
# ---------------------------------------------------------------------------


class ProviderCost(Base):
    """Stores cost records for provider usage."""

    __tablename__ = "provider_costs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    provider: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    units: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    metadata_: Mapped[dict[str, Any] | None] = mapped_column(
        "metadata", JSON, nullable=True
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )


# ---------------------------------------------------------------------------
# Repository
# ---------------------------------------------------------------------------


class CostRepository:
    """Data access layer for provider costs."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        provider: str,
        category: str,
        amount: float,
        units: float,
        metadata: dict[str, Any] | None = None,
    ) -> ProviderCost:
        """Record a new cost entry."""
        record = ProviderCost(
            provider=provider,
            category=category,
            amount=amount,
            units=units,
            metadata_=metadata or {},
            recorded_at=datetime.now(timezone.utc),
        )
        self._session.add(record)
        await self._session.commit()
        await self._session.refresh(record)
        await logger.ainfo(
            "cost_recorded",
            provider=provider,
            category=category,
            amount=amount,
        )
        return record

    async def get_total_costs(
        self,
        *,
        since: datetime | None = None,
    ) -> dict[str, Any]:
        """Return total costs aggregated by category."""
        query = select(
            ProviderCost.category,
            func.sum(ProviderCost.amount).label("total"),
            func.count().label("record_count"),
        ).group_by(ProviderCost.category)

        if since:
            query = query.where(ProviderCost.recorded_at >= since)

        result = await self._session.execute(query)
        rows = result.all()

        by_category: dict[str, float] = {}
        total_cost = 0.0
        record_count = 0
        for row in rows:
            by_category[row.category] = float(row.total or 0)
            total_cost += float(row.total or 0)
            record_count += row.record_count

        return {
            "total_cost": round(total_cost, 4),
            "by_category": by_category,
            "record_count": record_count,
        }

    async def get_daily_costs(
        self,
        *,
        days: int = 30,
    ) -> list[dict[str, Any]]:
        """Return daily cost aggregation for the last N days."""
        since = datetime.now(timezone.utc) - timedelta(days=days)

        query = (
            select(
                func.date(ProviderCost.recorded_at).label("date"),
                ProviderCost.category,
                func.sum(ProviderCost.amount).label("total"),
            )
            .where(ProviderCost.recorded_at >= since)
            .group_by("date", ProviderCost.category)
            .order_by("date")
        )

        result = await self._session.execute(query)
        rows = result.all()

        # Group by date
        daily: dict[str, dict[str, float]] = {}
        for row in rows:
            date_str = str(row.date)
            if date_str not in daily:
                daily[date_str] = {}
            daily[date_str][row.category] = float(row.total or 0)

        return [
            {
                "date": date_str,
                "total_cost": round(sum(cats.values()), 4),
                "by_category": cats,
            }
            for date_str, cats in daily.items()
        ]

    async def get_costs_by_provider(
        self,
        *,
        since: datetime | None = None,
    ) -> list[dict[str, Any]]:
        """Return costs grouped by provider."""
        query = select(
            ProviderCost.provider,
            ProviderCost.category,
            func.sum(ProviderCost.amount).label("total"),
            func.count().label("error_count"),
        ).group_by(ProviderCost.provider, ProviderCost.category)

        if since:
            query = query.where(ProviderCost.recorded_at >= since)

        result = await self._session.execute(query)
        rows = result.all()

        providers: dict[str, dict[str, Any]] = {}
        for row in rows:
            if row.provider not in providers:
                providers[row.provider] = {
                    "provider": row.provider,
                    "total_cost": 0.0,
                    "by_category": {},
                    "request_count": 0,
                }
            cost = float(row.total or 0)
            providers[row.provider]["by_category"][row.category] = cost
            providers[row.provider]["total_cost"] += cost
            providers[row.provider]["request_count"] += row.error_count

        return [
            {**v, "total_cost": round(v["total_cost"], 4)}
            for v in providers.values()
        ]

    async def get_cost_projection(
        self,
        *,
        days_history: int = 7,
    ) -> list[dict[str, Any]]:
        """Project costs for daily, weekly, and monthly periods."""
        since = datetime.now(timezone.utc) - timedelta(days=days_history)

        query = select(func.sum(ProviderCost.amount).label("total")).where(
            ProviderCost.recorded_at >= since
        )
        result = await self._session.execute(query)
        total = float(result.scalar_one() or 0)

        daily_avg = total / days_history if days_history > 0 else 0.0

        # Determine trend based on first vs second half
        mid = since + timedelta(days=days_history / 2)
        first_half_q = select(func.sum(ProviderCost.amount)).where(
            ProviderCost.recorded_at >= since,
            ProviderCost.recorded_at < mid,
        )
        second_half_q = select(func.sum(ProviderCost.amount)).where(
            ProviderCost.recorded_at >= mid,
        )

        first_total = float((await self._session.execute(first_half_q)).scalar_one() or 0)
        second_total = float((await self._session.execute(second_half_q)).scalar_one() or 0)

        if second_total > first_total * 1.1:
            trend = "increasing"
        elif second_total < first_total * 0.9:
            trend = "decreasing"
        else:
            trend = "stable"

        return [
            {
                "period": "daily",
                "current_cost": round(daily_avg, 4),
                "projected_cost": round(daily_avg, 4),
                "trend": trend,
            },
            {
                "period": "weekly",
                "current_cost": round(total, 4),
                "projected_cost": round(daily_avg * 7, 4),
                "trend": trend,
            },
            {
                "period": "monthly",
                "current_cost": round(total, 4),
                "projected_cost": round(daily_avg * 30, 4),
                "trend": trend,
            },
        ]
