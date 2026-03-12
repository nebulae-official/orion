# Sprint 8: Observability Dashboards, Pulse Completion & Dashboard Integration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the observability stack with Grafana dashboards/alerting, finish Pulse analytics, wire the Dashboard to real data, and add a data cleanup scheduler.

**Architecture:** Grafana provisioning-as-code for dashboards and alerting, APScheduler in Pulse for cleanup, Recharts in the Next.js dashboard for data visualization, all consuming existing Prometheus metrics and Pulse API endpoints.

**Tech Stack:** Grafana 10.4 (provisioning YAML/JSON), Prometheus alerting rules, APScheduler 3.x, Next.js 15.2, Recharts 2.x, Tailwind CSS 4.0

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `deploy/grafana/provisioning/datasources/datasource.yml` | Grafana datasource pointing to Prometheus |
| `deploy/grafana/provisioning/dashboards/dashboard.yml` | Dashboard provider config for auto-loading JSON |
| `deploy/grafana/provisioning/dashboards/json/orion-overview.json` | Overview dashboard (6 panels) |
| `deploy/grafana/provisioning/dashboards/json/provider-health.json` | Provider health dashboard (5 panels) |
| `deploy/grafana/provisioning/dashboards/json/gpu-resources.json` | GPU & resources dashboard (6 panels) |
| `deploy/prometheus/alert_rules.yml` | Critical + warning alerting rules |
| `services/pulse/src/services/cleanup.py` | Data retention cleanup logic |
| `services/pulse/src/metrics.py` | Pulse Prometheus counters for trends |
| `services/pulse/tests/test_cleanup.py` | Cleanup service tests |
| `dashboard/src/app/(dashboard)/analytics/page.tsx` | Analytics dashboard page |
| `dashboard/src/app/(dashboard)/trends/page.tsx` | Trends page |
| `dashboard/src/components/charts/funnel-chart.tsx` | Content pipeline funnel chart |
| `dashboard/src/components/charts/cost-chart.tsx` | Daily cost stacked bar chart |
| `dashboard/src/components/charts/provider-pie.tsx` | Provider usage pie chart |
| `dashboard/src/components/charts/error-trend.tsx` | Error trend line chart |
| `dashboard/src/components/charts/stat-card.tsx` | Reusable stat display card |
| `dashboard/src/components/trend-table.tsx` | Sortable trend list table |

### Modified Files
| File | Changes |
|------|---------|
| `deploy/prometheus.yml` | Uncomment `rule_files` to include alert rules |
| `deploy/docker-compose.monitoring.yml` | Mount alert rules into Prometheus |
| `services/pulse/pyproject.toml` | Add `apscheduler` dependency |
| `services/pulse/src/main.py` | Add scheduler startup/shutdown, instrument_app, cleanup route |
| `services/pulse/src/services/event_aggregator.py` | Increment trend Prometheus counters |
| `services/pulse/src/routes/analytics.py` | Add trend analytics endpoint |
| `services/pulse/src/schemas.py` | Add TrendAnalytics schema |
| `dashboard/package.json` | Add `recharts` dependency |
| `dashboard/src/components/sidebar.tsx` | Add Analytics nav item |

---

## Chunk 1: ORION-81 — Grafana Provisioning + Alerting Rules

### Task 1: Create Grafana Datasource Config

**Files:**
- Create: `deploy/grafana/provisioning/datasources/datasource.yml`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p deploy/grafana/provisioning/datasources
mkdir -p deploy/grafana/provisioning/dashboards/json
```

- [ ] **Step 2: Write datasource config**

Create `deploy/grafana/provisioning/datasources/datasource.yml`:
```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
    jsonData:
      timeInterval: "15s"
```

- [ ] **Step 3: Write dashboard provider config**

Create `deploy/grafana/provisioning/dashboards/dashboard.yml`:
```yaml
apiVersion: 1

providers:
  - name: Orion
    orgId: 1
    folder: Orion
    type: file
    disableDeletion: false
    editable: true
    options:
      path: /etc/grafana/provisioning/dashboards/json
      foldersFromFilesStructure: false
```

- [ ] **Step 4: Commit**

```bash
git add deploy/grafana/
git commit -m "feat(ORION-81): add Grafana datasource and dashboard provisioning config"
```

### Task 2: Create Prometheus Alert Rules

**Files:**
- Create: `deploy/prometheus/alert_rules.yml`
- Modify: `deploy/prometheus.yml`
- Modify: `deploy/docker-compose.monitoring.yml`

- [ ] **Step 1: Create alert rules file**

Create `deploy/prometheus/alert_rules.yml` with the rules from the Confluence "07. Monitoring & Observability" spec:

```yaml
groups:
  - name: orion-critical
    rules:
      - alert: ServiceDown
        expr: up{job=~"gateway|scout|director|media|editor|pulse"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.job }} is down"
          description: "{{ $labels.job }} has been unreachable for more than 1 minute."

      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status_code=~"5.."}[5m])) by (job)
          / sum(rate(http_requests_total[5m])) by (job) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate in {{ $labels.job }}"
          description: "{{ $labels.job }} error rate is above 10% for 5 minutes."

      - alert: GPUOutOfMemory
        expr: orion_gpu_memory_used_bytes / orion_gpu_memory_total_bytes > 0.95
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "GPU VRAM critically low (>95%)"

  - name: orion-warning
    rules:
      - alert: QueueBacklog
        expr: orion_content_queue_size{status="REVIEW"} > 20
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Content review queue backlog: {{ $value }} items"

      - alert: HighProviderLatency
        expr: histogram_quantile(0.95, rate(orion_provider_latency_seconds_bucket[5m])) > 30
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Provider {{ $labels.provider }} p95 latency >30s"

      - alert: DailyCostExceeded
        expr: sum(increase(orion_provider_cost_usd[24h])) > 5
        labels:
          severity: warning
        annotations:
          summary: "Daily cloud cost exceeded $5 budget"

      - alert: FrequentFallbacks
        expr: sum(rate(orion_provider_fallback_total[1h])) > 5
        labels:
          severity: warning
        annotations:
          summary: "Frequent provider fallbacks in {{ $labels.service }}"
```

- [ ] **Step 2: Update prometheus.yml to load alert rules**

In `deploy/prometheus.yml`, uncomment the rule_files line:
```yaml
rule_files:
  - "/etc/prometheus/alert_rules.yml"
```

- [ ] **Step 3: Update docker-compose.monitoring.yml to mount alert rules**

Add volume mount to the prometheus service:
```yaml
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./prometheus/alert_rules.yml:/etc/prometheus/alert_rules.yml:ro
      - prometheusdata:/prometheus
```

- [ ] **Step 4: Commit**

```bash
git add deploy/prometheus/ deploy/prometheus.yml deploy/docker-compose.monitoring.yml
git commit -m "feat(ORION-81): add Prometheus alerting rules and wire into docker-compose"
```

---

## Chunk 2: ORION-82, ORION-83, ORION-84 — Grafana Dashboards

### Task 3: Create Orion Overview Dashboard

**Files:**
- Create: `deploy/grafana/provisioning/dashboards/json/orion-overview.json`

- [ ] **Step 1: Create the dashboard JSON**

Grafana dashboard JSON with 6 panels in a 2-column grid:

1. **Content Pipeline Status** (stat panel, row 0): `orion_content_total` by status label
2. **Active Queue Size** (stat panel, row 0): `orion_content_queue_size` by status
3. **Generation Time Distribution** (histogram, row 1): `orion_content_generation_duration_seconds`
4. **Provider Usage** (pie chart, row 1): `sum by (provider) (orion_provider_requests_total)`
5. **Error Rate by Service** (timeseries, row 2): `sum(rate(http_requests_total{status_code=~"5.."}[5m])) by (job)`
6. **Daily Cost** (timeseries, row 2): `increase(orion_provider_cost_usd[24h])`

Dashboard settings: `"refresh": "30s"`, `"time": {"from": "now-6h", "to": "now"}`, title: "Orion Overview"

The panel JSON follows standard Grafana 10.x format with `gridPos`, `targets` (Prometheus datasource), and `fieldConfig`.

- [ ] **Step 2: Verify JSON is valid**

```bash
python3 -c "import json; json.load(open('deploy/grafana/provisioning/dashboards/json/orion-overview.json'))"
```

- [ ] **Step 3: Commit**

```bash
git add deploy/grafana/provisioning/dashboards/json/orion-overview.json
git commit -m "feat(ORION-82): add Grafana Orion Overview dashboard"
```

### Task 4: Create Provider Health Dashboard

**Files:**
- Create: `deploy/grafana/provisioning/dashboards/json/provider-health.json`

- [ ] **Step 1: Create the dashboard JSON**

5 panels:
1. **Provider Latency (p50/p95/p99)** (timeseries): `histogram_quantile(0.5|0.95|0.99, rate(orion_provider_latency_seconds_bucket[5m]))`
2. **Provider Error Rate** (timeseries): `rate(orion_provider_errors_total[5m])` by provider
3. **Fallback Events** (timeseries): `rate(orion_provider_fallback_total[5m])` by service
4. **Cost per Provider** (barchart): `increase(orion_provider_cost_usd[24h])` by provider
5. **Request Volume** (stacked timeseries): `rate(orion_provider_requests_total[5m])` by provider

Title: "Provider Health", refresh: 30s, time range: last 6h.

- [ ] **Step 2: Verify JSON is valid**

```bash
python3 -c "import json; json.load(open('deploy/grafana/provisioning/dashboards/json/provider-health.json'))"
```

- [ ] **Step 3: Commit**

```bash
git add deploy/grafana/provisioning/dashboards/json/provider-health.json
git commit -m "feat(ORION-83): add Grafana Provider Health dashboard"
```

### Task 5: Create GPU & Resources Dashboard

**Files:**
- Create: `deploy/grafana/provisioning/dashboards/json/gpu-resources.json`

- [ ] **Step 1: Create the dashboard JSON**

6 panels (panels 4-6 are placeholders that will show "No data" until cAdvisor/node-exporter are deployed):
1. **GPU VRAM Usage %** (gauge): `orion_gpu_memory_used_bytes / orion_gpu_memory_total_bytes * 100`, thresholds at 70 (yellow) and 90 (red)
2. **GPU Temperature** (timeseries): `orion_gpu_temperature_celsius`, threshold line at 80°C
3. **GPU Utilization** (timeseries): `orion_gpu_utilization_percent`
4. **Memory by Container** (timeseries): `container_memory_usage_bytes{name=~"orion.*"}` — placeholder
5. **CPU by Container** (timeseries): `rate(container_cpu_usage_seconds_total{name=~"orion.*"}[5m])` — placeholder
6. **Disk I/O** (timeseries): `rate(node_disk_io_time_seconds_total[5m])` — placeholder

Title: "GPU & Resources", refresh: 30s.

- [ ] **Step 2: Verify JSON is valid**

```bash
python3 -c "import json; json.load(open('deploy/grafana/provisioning/dashboards/json/gpu-resources.json'))"
```

- [ ] **Step 3: Commit**

```bash
git add deploy/grafana/provisioning/dashboards/json/gpu-resources.json
git commit -m "feat(ORION-84): add Grafana GPU & Resources dashboard"
```

---

## Chunk 3: ORION-85, ORION-88 — Pulse Cleanup + Metrics

### Task 6: Add Pulse Prometheus Metrics for Trends

**Files:**
- Create: `services/pulse/src/metrics.py`
- Modify: `services/pulse/src/services/event_aggregator.py`
- Modify: `services/pulse/src/main.py`

- [ ] **Step 1: Create Pulse metrics module**

Create `services/pulse/src/metrics.py`:
```python
"""Prometheus metrics for the Pulse service."""

from prometheus_client import Counter

TRENDS_FOUND = Counter(
    "orion_trends_found_total",
    "Number of trends discovered",
    ["source"],
)

TRENDS_USED = Counter(
    "orion_trends_used_total",
    "Number of trends converted to content",
    ["source"],
)

TRENDS_DISCARDED = Counter(
    "orion_trends_discarded_total",
    "Number of trends filtered out",
    ["source", "reason"],
)
```

- [ ] **Step 2: Wire metrics into EventAggregator**

In `services/pulse/src/services/event_aggregator.py`, import the metrics and increment them in the event handler:

In the `_handle_event` method (or equivalent), add after persisting the event:
```python
from services.pulse.src.metrics import TRENDS_FOUND, TRENDS_USED, TRENDS_DISCARDED

# Inside handler for TREND_DETECTED:
TRENDS_FOUND.labels(source=payload.get("source", "unknown")).inc()

# Inside handler for CONTENT_CREATED (links to a trend):
TRENDS_USED.labels(source=payload.get("source", "unknown")).inc()

# Inside handler for TREND_EXPIRED:
TRENDS_DISCARDED.labels(source=payload.get("source", "unknown"), reason="expired").inc()
```

- [ ] **Step 3: Add instrument_app to Pulse main.py**

In `services/pulse/src/main.py`, update the import and add instrumentation:
```python
from orion_common.health import create_health_router, instrument_app

# After app.include_router lines:
instrument_app(app, service_name="pulse")
```

- [ ] **Step 4: Commit**

```bash
git add services/pulse/src/metrics.py services/pulse/src/services/event_aggregator.py services/pulse/src/main.py
git commit -m "feat(ORION-88): add Pulse Prometheus trend metrics and instrument_app"
```

### Task 7: Add Trend Analytics Endpoint to Pulse

**Files:**
- Modify: `services/pulse/src/routes/analytics.py`
- Modify: `services/pulse/src/schemas.py`

- [ ] **Step 1: Add TrendAnalytics schema**

In `services/pulse/src/schemas.py`, add:
```python
class TrendSourceCount(BaseModel):
    """Count of trends by source."""
    source: str
    count: int

class TrendAnalytics(BaseModel):
    """Trend discovery analytics."""
    total_found: int = 0
    total_used: int = 0
    total_discarded: int = 0
    conversion_rate: float = 0.0
    by_source: list[TrendSourceCount] = Field(default_factory=list)
```

- [ ] **Step 2: Add endpoint to analytics router**

In `services/pulse/src/routes/analytics.py`, add:
```python
@router.get("/trends", response_model=TrendAnalytics)
async def get_trend_analytics(
    session: Annotated[AsyncSession, Depends(get_session)],
    hours: int = Query(default=168, ge=1, le=720, description="Hours of history"),
) -> TrendAnalytics:
    """Trend discovery analytics: counts by source, conversion rate."""
    repo = EventRepository(session)
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    # Count events by channel
    counts = await repo.get_event_counts_by_channel(since=since)

    found = counts.get(Channels.TREND_DETECTED, 0)
    used = counts.get(Channels.CONTENT_CREATED, 0)
    expired = counts.get(Channels.TREND_EXPIRED, 0)

    return TrendAnalytics(
        total_found=found,
        total_used=used,
        total_discarded=expired,
        conversion_rate=used / found if found > 0 else 0.0,
        by_source=[],  # Source breakdown requires payload parsing — future enhancement
    )
```

- [ ] **Step 3: Commit**

```bash
git add services/pulse/src/routes/analytics.py services/pulse/src/schemas.py
git commit -m "feat(ORION-88): add trend analytics endpoint to Pulse"
```

### Task 8: Add Data Cleanup Scheduler

**Files:**
- Modify: `services/pulse/pyproject.toml`
- Create: `services/pulse/src/services/cleanup.py`
- Modify: `services/pulse/src/main.py`
- Create: `services/pulse/tests/test_cleanup.py`

- [ ] **Step 1: Add APScheduler dependency**

In `services/pulse/pyproject.toml`, add to dependencies:
```toml
    "apscheduler>=3.10.0",
```

- [ ] **Step 2: Install dependencies**

```bash
cd services/pulse && uv sync && cd ../..
```

- [ ] **Step 3: Write the failing test**

Create `services/pulse/tests/test_cleanup.py`:
```python
"""Tests for the data cleanup service."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from services.pulse.src.repositories.event_repo import AnalyticsEvent
from services.pulse.src.repositories.cost_repo import ProviderCost
from services.pulse.src.services.cleanup import cleanup_old_records


@pytest.fixture
async def seed_old_records(session: AsyncSession) -> None:
    """Seed the database with records at various ages."""
    now = datetime.now(timezone.utc)
    old = now - timedelta(days=100)
    recent = now - timedelta(days=10)

    # Old records (should be deleted)
    for i in range(3):
        session.add(AnalyticsEvent(
            id=uuid.uuid4(),
            channel="test",
            payload={},
            service="test",
            recorded_at=old,
        ))
        session.add(ProviderCost(
            id=uuid.uuid4(),
            provider="test",
            category="test",
            amount=1.0,
            recorded_at=old,
        ))

    # Recent records (should be kept)
    for i in range(2):
        session.add(AnalyticsEvent(
            id=uuid.uuid4(),
            channel="test",
            payload={},
            service="test",
            recorded_at=recent,
        ))
        session.add(ProviderCost(
            id=uuid.uuid4(),
            provider="test",
            category="test",
            amount=1.0,
            recorded_at=recent,
        ))

    await session.commit()


@pytest.mark.asyncio
async def test_cleanup_deletes_old_records(session: AsyncSession, seed_old_records: None) -> None:
    """Records older than retention_days are deleted."""
    result = await cleanup_old_records(session, retention_days=90)
    assert result["events_deleted"] == 3
    assert result["costs_deleted"] == 3

    # Verify recent records remain
    event_count = await session.scalar(select(func.count()).select_from(AnalyticsEvent))
    cost_count = await session.scalar(select(func.count()).select_from(ProviderCost))
    assert event_count == 2
    assert cost_count == 2


@pytest.mark.asyncio
async def test_cleanup_no_old_records(session: AsyncSession) -> None:
    """Cleanup with no old records deletes nothing."""
    result = await cleanup_old_records(session, retention_days=90)
    assert result["events_deleted"] == 0
    assert result["costs_deleted"] == 0
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd services/pulse && .venv/bin/python -m pytest tests/test_cleanup.py -v
```
Expected: FAIL (cleanup module not found)

- [ ] **Step 5: Write cleanup implementation**

Create `services/pulse/src/services/cleanup.py`:
```python
"""Data retention cleanup for Pulse analytics tables."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from services.pulse.src.repositories.cost_repo import ProviderCost
from services.pulse.src.repositories.event_repo import AnalyticsEvent

logger = structlog.get_logger(__name__)


async def cleanup_old_records(
    session: AsyncSession,
    retention_days: int = 90,
) -> dict[str, int]:
    """Delete analytics_events and provider_costs older than retention_days.

    Args:
        session: Async database session.
        retention_days: Number of days to retain. Records older are deleted.

    Returns:
        Dict with counts of deleted events and costs.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)

    events_result = await session.execute(
        delete(AnalyticsEvent).where(AnalyticsEvent.recorded_at < cutoff)
    )
    costs_result = await session.execute(
        delete(ProviderCost).where(ProviderCost.recorded_at < cutoff)
    )
    await session.commit()

    deleted = {
        "events_deleted": events_result.rowcount,
        "costs_deleted": costs_result.rowcount,
    }

    await logger.ainfo(
        "cleanup_completed",
        retention_days=retention_days,
        cutoff=cutoff.isoformat(),
        **deleted,
    )

    return deleted
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd services/pulse && .venv/bin/python -m pytest tests/test_cleanup.py -v
```
Expected: PASS

- [ ] **Step 7: Wire scheduler into Pulse lifespan**

In `services/pulse/src/main.py`, add scheduler setup:

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from services.pulse.src.services.cleanup import cleanup_old_records

# Inside lifespan, after cost_tracker.start():
scheduler = AsyncIOScheduler()

async def _run_cleanup():
    async with session_factory() as session:
        await cleanup_old_records(session, retention_days=90)

scheduler.add_job(_run_cleanup, "cron", hour=2, minute=0, id="data_cleanup")
scheduler.start()

# In shutdown section:
scheduler.shutdown(wait=False)
```

- [ ] **Step 8: Commit**

```bash
git add services/pulse/pyproject.toml services/pulse/src/services/cleanup.py services/pulse/tests/test_cleanup.py services/pulse/src/main.py
git commit -m "feat(ORION-85): add data cleanup scheduler with 90-day retention"
```

---

## Chunk 4: ORION-86 — Dashboard Analytics Page

### Task 9: Add Recharts Dependency

**Files:**
- Modify: `dashboard/package.json`

- [ ] **Step 1: Install recharts**

```bash
cd dashboard && npm install recharts && cd ..
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/package.json dashboard/package-lock.json
git commit -m "chore(ORION-86): add recharts dependency for dashboard charts"
```

### Task 10: Create Stat Card Component

**Files:**
- Create: `dashboard/src/components/charts/stat-card.tsx`

- [ ] **Step 1: Create stat-card component**

```tsx
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
}

export function StatCard({ title, value, subtitle, trend }: StatCardProps): React.ReactElement {
  // Tailwind card with large value display, optional trend arrow
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/components/charts/stat-card.tsx
git commit -m "feat(ORION-86): add reusable StatCard component"
```

### Task 11: Create Chart Components

**Files:**
- Create: `dashboard/src/components/charts/funnel-chart.tsx`
- Create: `dashboard/src/components/charts/cost-chart.tsx`
- Create: `dashboard/src/components/charts/provider-pie.tsx`
- Create: `dashboard/src/components/charts/error-trend.tsx`

- [ ] **Step 1: Create funnel-chart component**

`dashboard/src/components/charts/funnel-chart.tsx` — `"use client"` component using Recharts `BarChart` with horizontal bars:
```tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface FunnelData {
  stage: string;
  count: number;
  color: string;
}

interface FunnelChartProps {
  data: FunnelData[];
}

export function FunnelChart({ data }: FunnelChartProps): React.ReactElement {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Content Pipeline</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} layout="vertical">
          <XAxis type="number" />
          <YAxis type="category" dataKey="stage" width={100} />
          <Tooltip />
          <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Create cost-chart component**

`dashboard/src/components/charts/cost-chart.tsx` — `"use client"` component using Recharts `BarChart` with stacked bars for daily costs by category.

- [ ] **Step 3: Create provider-pie component**

`dashboard/src/components/charts/provider-pie.tsx` — `"use client"` component using Recharts `PieChart` for provider usage distribution.

- [ ] **Step 4: Create error-trend component**

`dashboard/src/components/charts/error-trend.tsx` — `"use client"` component using Recharts `LineChart` for error trends over time.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/charts/
git commit -m "feat(ORION-86): add chart components (funnel, cost, provider pie, error trend)"
```

### Task 12: Create Analytics Page

**Files:**
- Create: `dashboard/src/app/(dashboard)/analytics/page.tsx`
- Modify: `dashboard/src/components/sidebar.tsx`

- [ ] **Step 1: Create analytics page**

`dashboard/src/app/(dashboard)/analytics/page.tsx` — Server Component that fetches data from Pulse endpoints via the Gateway proxy using `serverFetch`:

```tsx
import { BarChart3 } from "lucide-react";
import { serverFetch } from "@/lib/api-client";
import { StatCard } from "@/components/charts/stat-card";
import { FunnelChart } from "@/components/charts/funnel-chart";
import { CostChart } from "@/components/charts/cost-chart";
import { ProviderPie } from "@/components/charts/provider-pie";
import { ErrorTrend } from "@/components/charts/error-trend";

interface FunnelMetrics {
  generated: number;
  review: number;
  approved: number;
  published: number;
  rejected: number;
}

interface CostSummary {
  total_cost: number;
  period_days: number;
}

interface ProviderCostSummary {
  provider: string;
  total_cost: number;
  by_category: Record<string, number>;
}

interface ErrorTrendData {
  hour: string;
  count: number;
}

export default async function AnalyticsPage(): Promise<React.ReactElement> {
  let funnel: FunnelMetrics = { generated: 0, review: 0, approved: 0, published: 0, rejected: 0 };
  let costs: CostSummary = { total_cost: 0, period_days: 30 };
  let providerCosts: ProviderCostSummary[] = [];
  let errors: ErrorTrendData[] = [];

  try {
    [funnel, costs, providerCosts, errors] = await Promise.all([
      serverFetch<FunnelMetrics>("/api/v1/pulse/pipeline/funnel"),
      serverFetch<CostSummary>("/api/v1/pulse/costs"),
      serverFetch<ProviderCostSummary[]>("/api/v1/pulse/costs/by-provider"),
      serverFetch<ErrorTrendData[]>("/api/v1/pulse/pipeline/errors?hours=168"),
    ]);
  } catch {
    // Render with empty data — services may not be running
  }

  const approvalRate = funnel.generated > 0
    ? ((funnel.approved / funnel.generated) * 100).toFixed(1)
    : "0";

  const funnelData = [
    { stage: "Generated", count: funnel.generated, color: "#3b82f6" },
    { stage: "In Review", count: funnel.review, color: "#f59e0b" },
    { stage: "Approved", count: funnel.approved, color: "#10b981" },
    { stage: "Published", count: funnel.published, color: "#8b5cf6" },
    { stage: "Rejected", count: funnel.rejected, color: "#ef4444" },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-gray-700" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
            <p className="mt-1 text-gray-500">
              Pipeline performance, costs, and provider usage.
            </p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard title="Total Generated" value={funnel.generated} />
        <StatCard title="Approval Rate" value={`${approvalRate}%`} />
        <StatCard title="Total Cost" value={`$${costs.total_cost.toFixed(2)}`} subtitle="Last 30 days" />
      </div>

      {/* Charts */}
      <div className="mb-6">
        <FunnelChart data={funnelData} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CostChart data={providerCosts} />
        <ProviderPie data={providerCosts} />
      </div>

      <div className="mt-6">
        <ErrorTrend data={errors} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add Analytics to sidebar navigation**

In `dashboard/src/components/sidebar.tsx`, add to `NAV_ITEMS` array after the "Generation" entry:
```tsx
import { BarChart3 } from "lucide-react";  // add to imports

// Add to NAV_ITEMS:
{ label: "Analytics", href: "/analytics", icon: <BarChart3 className="h-5 w-5" /> },
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/\(dashboard\)/analytics/page.tsx dashboard/src/components/sidebar.tsx
git commit -m "feat(ORION-86): add Analytics dashboard page with pipeline funnel, costs, and error trends"
```

---

## Chunk 5: ORION-87 — Dashboard Trends Page

### Task 13: Create Trend Table Component

**Files:**
- Create: `dashboard/src/components/trend-table.tsx`

- [ ] **Step 1: Create trend-table component**

`dashboard/src/components/trend-table.tsx` — `"use client"` component with sortable columns:

```tsx
"use client";

import { useState } from "react";

interface Trend {
  id: string;
  topic: string;
  source: string;
  virality_score: number;
  status: string;
  created_at: string;
}

interface TrendTableProps {
  trends: Trend[];
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  PROCESSING: "bg-yellow-100 text-yellow-700",
  USED: "bg-green-100 text-green-700",
  DISCARDED: "bg-gray-100 text-gray-500",
};

export function TrendTable({ trends }: TrendTableProps): React.ReactElement {
  const [sortKey, setSortKey] = useState<keyof Trend>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = [...trends].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  function toggleSort(key: keyof Trend): void {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (trends.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
        No trends found. Scout may not be running.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            {(["topic", "source", "virality_score", "status", "created_at"] as const).map((key) => (
              <th
                key={key}
                onClick={() => toggleSort(key)}
                className="cursor-pointer px-4 py-3 font-medium text-gray-600 hover:text-gray-900"
              >
                {key.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                {sortKey === key && (sortDir === "asc" ? " ↑" : " ↓")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map((trend) => (
            <tr key={trend.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{trend.topic}</td>
              <td className="px-4 py-3 text-gray-600">{trend.source}</td>
              <td className="px-4 py-3 text-gray-600">{trend.virality_score.toFixed(1)}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[trend.status] ?? "bg-gray-100 text-gray-500"}`}>
                  {trend.status}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-500">
                {new Date(trend.created_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/components/trend-table.tsx
git commit -m "feat(ORION-87): add TrendTable component with sortable columns and status badges"
```

### Task 14: Create Trends Page

**Files:**
- Create: `dashboard/src/app/(dashboard)/trends/page.tsx`

- [ ] **Step 1: Create trends page**

`dashboard/src/app/(dashboard)/trends/page.tsx` — Server Component fetching from Scout via Gateway:

```tsx
import { TrendingUp } from "lucide-react";
import { serverFetch } from "@/lib/api-client";
import { StatCard } from "@/components/charts/stat-card";
import { TrendTable } from "@/components/trend-table";

interface Trend {
  id: string;
  topic: string;
  source: string;
  virality_score: number;
  status: string;
  created_at: string;
}

interface TrendListResponse {
  items: Trend[];
  total: number;
}

export default async function TrendsPage(): Promise<React.ReactElement> {
  let trends: Trend[] = [];
  let total = 0;

  try {
    const response = await serverFetch<TrendListResponse>("/api/v1/scout/trends");
    trends = response.items;
    total = response.total;
  } catch {
    // Services may not be running
  }

  const used = trends.filter((t) => t.status === "USED").length;
  const discarded = trends.filter((t) => t.status === "DISCARDED").length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-gray-700" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Trends</h1>
            <p className="mt-1 text-gray-500">Discovered trends and their pipeline status.</p>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard title="Total Found" value={total} />
        <StatCard title="Used for Content" value={used} />
        <StatCard title="Discarded" value={discarded} />
      </div>

      <TrendTable trends={trends} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/app/\(dashboard\)/trends/page.tsx
git commit -m "feat(ORION-87): add Trends page with stat cards and sortable trend table"
```

---

## Post-Implementation

After all tasks complete:

1. Run `cd dashboard && npm run build` to verify the Next.js dashboard builds without errors
2. Run `cd services/pulse && .venv/bin/python -m pytest` to verify all Pulse tests pass
3. Verify Grafana dashboards load with `docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.monitoring.yml up prometheus grafana`
4. Create JIRA stories ORION-81 through ORION-88 and transition to Done
