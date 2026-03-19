# :lucide-activity: Monitoring Guide

How to use the Orion monitoring stack: Prometheus metrics, Grafana dashboards, the System Health dashboard page, and the CLI.

## :lucide-play: Starting the Monitoring Stack

The monitoring stack (Prometheus + Grafana) runs as a separate Docker Compose profile:

```bash
make up-monitoring
```

Or manually:

```bash
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.monitoring.yml up -d
```

This starts all Orion services plus:

- **Prometheus** at `http://localhost:9090`
- **Grafana** at `http://localhost:3001` (default login: `admin` / `admin`)

---

## :lucide-layout-dashboard: Grafana Dashboards

!!! info "Default Dashboards"
    Orion ships with **three pre-built Grafana dashboards** that are auto-provisioned on startup from `deploy/grafana/provisioning/dashboards/json/`. No manual configuration is required -- just start the monitoring stack and the dashboards are ready to use at `http://localhost:3001`.

Three pre-built dashboards are auto-provisioned from `deploy/grafana/provisioning/dashboards/json/`:

### :lucide-bar-chart-3: Orion Overview

The main operational dashboard. Key panels:

| Panel             | What It Shows                                    |
| ----------------- | ------------------------------------------------ |
| Request Rate      | Requests per second by service                   |
| Error Rate        | 5xx errors per second                            |
| P95 Latency       | 95th percentile response time                    |
| Active WebSockets | Current WebSocket connections                    |
| Pipeline Status   | Pipeline runs by status (completed, failed, etc) |

### :lucide-heart-pulse: Provider Health

AI provider availability and performance:

| Panel            | What It Shows                             |
| ---------------- | ----------------------------------------- |
| Provider Status  | Connection status for each AI provider    |
| Response Times   | Latency for LLM, image, video, TTS calls |
| Cost Tracking    | Estimated cost per provider per hour      |
| Error Rates      | Provider-specific failure rates           |

### :lucide-cpu: GPU & Resources

Requires the `--profile gpu` flag when starting Docker Compose:

| Panel           | What It Shows                            |
| --------------- | ---------------------------------------- |
| GPU Utilization | Real-time GPU usage percentage           |
| GPU Memory      | VRAM usage and available memory          |
| GPU Temperature | Current temperature reading              |
| CPU / RAM       | Host CPU and memory utilization          |

---

## :lucide-database: Prometheus Metrics

Every Orion service exposes a `/metrics` endpoint scraped by Prometheus at 15-second intervals.

### :lucide-target: Scrape Targets

| Service    | Endpoint           |
| ---------- | ------------------ |
| Gateway    | `gateway:8000`     |
| Scout      | `scout:8001`       |
| Director   | `director:8002`    |
| Media      | `media:8003`       |
| Editor     | `editor:8004`      |
| Pulse      | `pulse:8005`       |
| Milvus     | `milvus:9091`      |
| Ollama     | `ollama:11434`     |

### :lucide-code: Useful PromQL Queries

```promql
# Request rate by service
rate(http_requests_total[5m])

# 95th percentile latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate percentage
sum(rate(http_requests_total{status=~"5.."}[5m]))
  / sum(rate(http_requests_total[5m]))

# Pipeline success rate (last hour)
sum(rate(pipeline_runs_total{status="completed"}[1h]))
  / sum(rate(pipeline_runs_total[1h]))

# Trends detected in the last 24 hours
increase(trends_detected_total[24h])
```

!!! tip "Alerting"
    Use Prometheus alerting rules to get notified when error rates spike or services go down. Pre-built alert rules are available in `deploy/prometheus/alert_rules.yml`. Configure notification channels (Slack, email, PagerDuty) in Grafana under **Alerting > Contact points**.

---

## :lucide-monitor: Dashboard System Health Page

The Orion Dashboard includes a built-in **System** page at `http://localhost:3000/system`:

- **Service status cards** -- health status of each microservice (gateway, scout, director, media, editor, pulse)
- **GPU utilization gauge** -- real-time GPU usage when running with the GPU profile
- **Queue depth** -- number of content items in each pipeline stage

The System page polls the gateway `/api/v1/system/health` endpoint and updates in real time.

---

## :lucide-terminal: CLI Monitoring Commands

### :lucide-gauge: System Status

```bash
orion system status
```

```
Orion System Status
───────────────────
Mode:       LOCAL
GPU:        Available (NVIDIA RTX 4090, 24GB)
Services:   6/6 healthy
Queue:      3 items pending
Uptime:     2h 15m
```

### :lucide-heart-pulse: Health Check

```bash
orion system health
```

```
┌───────────┬─────────┬──────────────┬──────────┐
│ Service   │ Status  │ Latency      │ Version  │
├───────────┼─────────┼──────────────┼──────────┤
│ gateway   │ healthy │ 2ms          │ 0.1.0    │
│ scout     │ healthy │ 15ms         │ 0.1.0    │
│ director  │ healthy │ 12ms         │ 0.1.0    │
│ media     │ healthy │ 18ms         │ 0.1.0    │
│ editor    │ healthy │ 14ms         │ 0.1.0    │
│ pulse     │ healthy │ 11ms         │ 0.1.0    │
└───────────┴─────────┴──────────────┴──────────┘
```

### :lucide-braces: JSON Output for Automation

```bash
orion system health --format json | jq '.services | to_entries[] | select(.value.status != "healthy")'
```

This returns only unhealthy services -- useful for CI checks or alerting scripts.

---

## :lucide-arrow-right: Next Steps

- **[System Administration](system-admin.md)** -- Service health and provider configuration
- **[Full Pipeline Demo](demo-full-pipeline.md)** -- End-to-end walkthrough
- **[Analytics Guide](analytics-guide.md)** -- Pipeline performance and cost tracking
- **[Provider Setup](demo-provider-setup.md)** -- Configure AI providers
