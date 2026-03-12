# Sprint 8: Observability Dashboards, Pulse Completion & Dashboard Integration

**Goal:** Complete the observability stack with Grafana dashboards and alerting, finish Pulse analytics gaps, wire the Next.js Dashboard to real API data, and add a data cleanup scheduler.

**Architecture:** Sprint 7 added Prometheus metrics emission across all services (Go gateway + Python services). Sprint 8 closes the loop by adding Grafana visualization, alerting rules, and connecting the Dashboard UI to the Pulse analytics endpoints. A scheduled cleanup job prevents unbounded Postgres growth.

**Tech Stack:** Grafana 11.x (provisioning-as-code), APScheduler 3.x (Python), Next.js 15.2 (App Router + Server Components), Recharts 2.x (charts), Tailwind CSS 4.0

**References:**
- Monitoring & Observability: Confluence "07. Monitoring & Observability" — Dashboard panels, alert rules, Prometheus config
- Architecture: Confluence "02. Architecture" — Service definitions, DB schema, API contracts
- FRD: Confluence "00c. Functional Requirements (FRD)" — Analytics requirements

---

## JIRA Tickets

| Ticket | Summary | Epic | Size |
|--------|---------|------|------|
| ORION-81 | Grafana datasource provisioning + Prometheus alerting rules | ORION-71 (Observability) | S |
| ORION-82 | Grafana dashboard: Orion Overview | ORION-71 (Observability) | M |
| ORION-83 | Grafana dashboard: Provider Health | ORION-71 (Observability) | S |
| ORION-84 | Grafana dashboard: GPU & Resources | ORION-71 (Observability) | S |
| ORION-85 | Data cleanup scheduler in Pulse | ORION-33 (Asset Cleanup) | M |
| ORION-86 | Dashboard: Analytics page | ORION-7 (Dashboard UI) | L |
| ORION-87 | Dashboard: Trends page | ORION-7 (Dashboard UI) | M |
| ORION-88 | Pulse: Provider metrics + trend aggregation endpoints | ORION-6 (Analytics & Pulse) | S |

---

## 1. ORION-81: Grafana Datasource Provisioning + Alerting Rules

### Problem

Prometheus scrapes all 6 services but there is no Grafana datasource config or alerting rules. The `deploy/grafana/provisioning/` directory doesn't exist despite being mounted in `docker-compose.monitoring.yml`.

### Design

Create the Grafana provisioning directory structure with:
- Datasource config pointing to Prometheus at `http://prometheus:9090`
- Alert rules matching the Confluence "07. Monitoring & Observability" spec (critical + warning)
- Dashboard provider config so Grafana auto-loads dashboard JSON files

### Changes

**Create `deploy/grafana/provisioning/datasources/datasource.yml`:**
```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
```

**Create `deploy/grafana/provisioning/dashboards/dashboard.yml`:**
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

**Create `deploy/prometheus/alert_rules.yml`:**
Critical alerts: ServiceDown (up == 0 for 1m), HighErrorRate (>10% 5m), GPUOutOfMemory (>95% VRAM 2m).
Warning alerts: QueueBacklog (>20 items 30m), HighProviderLatency (p95 >30s 10m), DailyCostExceeded (>$5/day), FrequentFallbacks (>5/hr).

**Modify `deploy/prometheus.yml`:**
- Uncomment `rule_files` to include `alert_rules.yml`

**Modify `deploy/docker-compose.monitoring.yml`:**
- Mount alert rules volume into Prometheus container

### Testing

- `docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.monitoring.yml up prometheus grafana`
- Verify Prometheus datasource appears in Grafana UI
- Verify alert rules load in Prometheus `/rules` endpoint

---

## 2. ORION-82: Grafana Dashboard — Orion Overview

### Problem

No visualization of the content pipeline funnel, error rates, or cost tracking despite metrics being emitted.

### Design

Create a Grafana dashboard JSON file with 6 panels matching the Confluence spec:

1. **Content Pipeline Funnel** — Bar chart: `orion_content_total` by status (generating, approved, failed)
2. **Active Queue Size** — Stat panel: `orion_content_queue_size` by status
3. **Generation Time Distribution** — Histogram: `orion_content_generation_duration_seconds`
4. **Provider Usage Breakdown** — Pie chart: `orion_provider_requests_total` by provider
5. **Error Rate by Service** — Time series: `rate(orion_requests_total{status_code=~"5.."}[5m])` per service
6. **Daily Cost Tracker** — Time series: `increase(orion_provider_cost_usd[24h])` by provider

### Changes

**Create `deploy/grafana/provisioning/dashboards/json/orion-overview.json`:**
Standard Grafana dashboard JSON with 6 panels in a 2x3 grid layout. Time range default: last 6 hours. Auto-refresh: 30s.

### Testing

- Dashboard loads without errors in Grafana
- Panels show "No data" (expected without running services) or sample data if services are running

---

## 3. ORION-83: Grafana Dashboard — Provider Health

### Problem

No visibility into provider latency, error rates, fallback events, or per-provider costs.

### Design

5-panel dashboard:

1. **Provider Latency** — Time series with p50/p95/p99 lines: `histogram_quantile(0.5|0.95|0.99, orion_provider_latency_seconds)`
2. **Provider Error Rate** — Time series: `rate(orion_provider_errors_total[5m])` by provider
3. **Fallback Events Timeline** — Annotations + time series: `orion_provider_fallback_total`
4. **Cost per Provider (daily)** — Bar chart: `increase(orion_provider_cost_usd[24h])` by provider
5. **Request Volume** — Stacked time series: `rate(orion_provider_requests_total[5m])` by provider

### Changes

**Create `deploy/grafana/provisioning/dashboards/json/provider-health.json`**

---

## 4. ORION-84: Grafana Dashboard — GPU & Resources

### Problem

GPU metrics (VRAM, temperature, utilization) are defined in the Confluence spec but not visualized.

### Design

6-panel dashboard:

1. **GPU VRAM Usage** — Gauge: `orion_gpu_memory_used_bytes / orion_gpu_memory_total_bytes * 100` with 90% threshold
2. **GPU Temperature** — Time series: `orion_gpu_temperature_celsius` with 80°C warning line
3. **GPU Utilization** — Time series: `orion_gpu_utilization_percent`
4. **Memory by Container** — Time series: `container_memory_usage_bytes` (requires cAdvisor, mark as future)
5. **CPU by Container** — Time series: `container_cpu_usage_seconds_total` (requires cAdvisor, mark as future)
6. **Disk I/O** — Placeholder panel (requires node-exporter, mark as future)

Note: Panels 4-6 require cAdvisor/node-exporter which are not yet deployed. These panels will show "No data" but are provisioned for when those exporters are added.

### Changes

**Create `deploy/grafana/provisioning/dashboards/json/gpu-resources.json`**

---

## 5. ORION-85: Data Cleanup Scheduler in Pulse

### Problem

The `analytics_events` and `provider_costs` tables grow unbounded. No scheduled task infrastructure exists in any Python service.

### Design

Add APScheduler to the Pulse service lifespan. Run a daily cleanup job at 02:00 UTC that deletes records older than 90 days from both tables.

### Changes

**Add `apscheduler>=3.10.0` to `services/pulse/pyproject.toml`**

**Create `services/pulse/src/services/cleanup.py`:**
```python
async def cleanup_old_records(session_factory, retention_days: int = 90) -> dict[str, int]:
    """Delete analytics_events and provider_costs older than retention_days."""
    cutoff = datetime.utcnow() - timedelta(days=retention_days)
    async with session_factory() as session:
        events_deleted = await session.execute(
            delete(AnalyticsEvent).where(AnalyticsEvent.recorded_at < cutoff)
        )
        costs_deleted = await session.execute(
            delete(ProviderCost).where(ProviderCost.recorded_at < cutoff)
        )
        await session.commit()
    return {"events": events_deleted.rowcount, "costs": costs_deleted.rowcount}
```

**Modify `services/pulse/src/main.py` (lifespan):**
- Import `AsyncIOScheduler` from `apscheduler.schedulers.asyncio`
- Initialize scheduler in lifespan startup
- Add `cleanup_old_records` as a cron job (hour=2, minute=0)
- Shut down scheduler in lifespan shutdown

**Add `GET /api/v1/admin/cleanup` endpoint:**
- Manual trigger for cleanup (returns count of deleted records)
- Protected behind admin check (future)

### Testing

- Unit test: `cleanup_old_records` deletes records older than N days, keeps newer ones
- Unit test: Records exactly at the boundary are kept
- Integration test: Scheduler starts and job is registered

---

## 6. ORION-86: Dashboard Analytics Page

### Problem

The Dashboard has no analytics page despite Pulse having 13 working endpoints for pipeline metrics, costs, and funnel data.

### Design

Build `/analytics` page in the Next.js dashboard consuming Pulse endpoints via the Gateway proxy. Use Recharts for data visualization (lightweight, React-native charting library).

### Page Layout

```
┌─────────────────────────────────────────────────┐
│  Analytics Dashboard                             │
├──────────────┬──────────────┬───────────────────┤
│ Total Content│ Approval Rate│ Avg Generation    │
│   Generated  │              │   Time            │
├──────────────┴──────────────┴───────────────────┤
│  Content Pipeline Funnel (horizontal bar)        │
│  [Generated] → [In Review] → [Approved] → [Published] │
├─────────────────────┬───────────────────────────┤
│  Cost Breakdown     │  Provider Usage           │
│  (stacked bar)      │  (pie chart)              │
├─────────────────────┴───────────────────────────┤
│  Error Trends (line chart, last 7 days)          │
└─────────────────────────────────────────────────┘
```

### Changes

**Add `recharts` to `dashboard/package.json`**

**Create `dashboard/src/app/analytics/page.tsx`:**
Server Component fetching from:
- `GET /api/v1/pulse/pipeline/funnel` — funnel metrics
- `GET /api/v1/pulse/costs/` — cost summary
- `GET /api/v1/pulse/costs/by-provider` — provider breakdown
- `GET /api/v1/pulse/pipeline/errors` — error trends
- `GET /api/v1/pulse/analytics/metrics` — pipeline throughput

**Create `dashboard/src/components/charts/`:**
- `funnel-chart.tsx` — Horizontal bar chart for content pipeline stages
- `cost-chart.tsx` — Stacked bar chart for daily costs
- `provider-pie.tsx` — Pie chart for provider usage distribution
- `error-trend.tsx` — Line chart for error trends over time
- `stat-card.tsx` — Simple stat display card (reusable)

All chart components are client components (`"use client"`) since Recharts requires browser APIs. The page itself is a Server Component that fetches data and passes it as props.

### Testing

- Components render without crashing with empty data
- Components render correctly with sample data
- Page fetches from correct endpoints

---

## 7. ORION-87: Dashboard Trends Page

### Problem

The Dashboard home page links to `/trends` but the page doesn't exist. Scout service collects trends but they're not visible in the UI.

### Design

Build `/trends` page showing discovered trends with virality scores, sources, and status. Data comes from the Gateway's existing `GET /api/v1/scout/trends` endpoint (proxied to Scout service).

### Page Layout

```
┌─────────────────────────────────────────────────┐
│  Trends                          [Refresh]       │
├──────────────┬──────────────┬───────────────────┤
│ Total Found  │ Used for     │ Discarded         │
│              │ Content      │                   │
├──────────────┴──────────────┴───────────────────┤
│  Trend List (table)                              │
│  | Topic | Source | Virality | Status | Created  │
│  | AI...  | google | 87.3   | USED   | 2h ago   │
│  | ...    | x      | 65.1   | NEW    | 4h ago   │
├─────────────────────────────────────────────────┤
│  Source Breakdown (small pie chart)               │
└─────────────────────────────────────────────────┘
```

### Changes

**Create `dashboard/src/app/trends/page.tsx`:**
Server Component fetching trends from `GET /api/v1/scout/trends`

**Create `dashboard/src/components/trend-table.tsx`:**
Client component with sortable columns, status badges (NEW=blue, PROCESSING=yellow, USED=green, DISCARDED=gray)

### Testing

- Table renders with empty state message
- Table renders with sample trend data
- Status badges display correct colors

---

## 8. ORION-88: Pulse Provider Metrics + Trend Aggregation

### Problem

The Confluence spec defines provider metrics (`orion_provider_requests_total`, `orion_provider_cost_usd`, etc.) and trend metrics (`orion_trends_found_total`, etc.) that Pulse should aggregate, but some are missing from the current implementation.

### Design

Add Prometheus counters to the Pulse service for trend events it receives via Redis, and add a trend aggregation endpoint.

### Changes

**Create `services/pulse/src/metrics.py`:**
```python
from prometheus_client import Counter

TRENDS_FOUND = Counter("orion_trends_found_total", "Trends discovered", ["source"])
TRENDS_USED = Counter("orion_trends_used_total", "Trends converted to content", ["source"])
TRENDS_DISCARDED = Counter("orion_trends_discarded_total", "Trends filtered out", ["source", "reason"])
```

**Modify `services/pulse/src/services/event_aggregator.py`:**
- On `TREND_DETECTED` event: increment `TRENDS_FOUND`
- On `TREND_EXPIRED` event: increment `TRENDS_DISCARDED`
- On `CONTENT_CREATED` event (which links to a trend): increment `TRENDS_USED`

**Add `GET /api/v1/analytics/trends` endpoint:**
```python
@router.get("/trends")
async def trend_analytics(hours: int = 168):
    """Trend discovery analytics: counts by source, conversion rate."""
```

### Testing

- Metrics increment correctly on event receipt
- Trend analytics endpoint returns correct aggregations

---

## Decision Log

| # | Decision | Alternatives Considered | Rationale |
|---|----------|------------------------|-----------|
| 1 | Grafana provisioning-as-code (JSON + YAML) | Manual dashboard creation via UI | Reproducible, version-controlled, survives container restarts |
| 2 | APScheduler for cleanup (not Celery) | Celery, cron in Docker, pg_cron | APScheduler is lightweight, async-native, no extra infrastructure needed for a single daily job |
| 3 | Recharts for dashboard charts | Chart.js, D3, Nivo | Recharts is React-native, lightweight (~45KB), good Server Component compatibility, declarative API |
| 4 | 90-day data retention default | 30 days, 180 days, configurable | Balances storage cost vs. trend analysis needs; configurable via env var |
| 5 | Server Components for data fetching, Client Components for charts | All client-side fetching | Follows Next.js 15 best practices; server fetch avoids client bundle bloat and CORS |
| 6 | GPU dashboard panels provisioned even without exporters | Skip GPU dashboard entirely | Forward-compatible; panels show "No data" gracefully until cAdvisor/nvidia-exporter added |
| 7 | Trends page fetches from Scout via Gateway proxy | Direct Pulse aggregation endpoint | Follows existing architecture: Gateway is single entry point; Scout owns trend data |
| 8 | Alert rules in Prometheus (not Grafana alerting) | Grafana unified alerting | Simpler config, matches Confluence spec, no additional Grafana DB needed |

---

## Assumptions

1. Grafana 11.x supports the provisioning YAML format used above
2. APScheduler 3.x works with FastAPI's async lifespan pattern
3. Recharts 2.x is compatible with React 19 and Next.js 15.2
4. Scout service has a `GET /trends` endpoint returning trend data (needs verification)
5. The Gateway already proxies `/api/v1/scout/*` and `/api/v1/pulse/*` to the respective services
6. GPU metrics exporters (nvidia-dcgm-exporter) will be added in a future sprint
7. No authentication is needed for admin cleanup endpoint in this sprint (single-user system)

---

## Non-Functional Requirements

- **Performance:** Dashboard pages should load in <2s on localhost; Grafana dashboards auto-refresh at 30s intervals
- **Scale:** Single-user system; no concurrent access concerns
- **Reliability:** Cleanup job failing is non-critical (logs warning, retries next day)
- **Storage:** 90-day retention keeps Postgres under ~500MB for analytics data at current throughput
