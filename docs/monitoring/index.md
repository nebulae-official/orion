# Monitoring

Orion includes a built-in observability stack with Prometheus for metrics collection, Grafana for visualization, and structured logging via slog (Go) and structlog (Python).

## :material-layers: Observability Stack

```mermaid
graph TB
    subgraph Services["Application Services"]
        GW["Gateway /metrics"]
        SC["Scout /metrics"]
        DR["Director /metrics"]
        MD["Media /metrics"]
        ED["Editor /metrics"]
        PL["Pulse /metrics"]
        MV["Milvus /metrics"]
    end

    subgraph Monitoring["Monitoring Stack"]
        PROM["Prometheus :9090"]
        GRAF["Grafana :3001"]
    end

    subgraph Outputs["Outputs"]
        DASH["Dashboards"]
        ALERT["Alerts"]
    end

    Services --> PROM
    PROM --> GRAF
    GRAF --> DASH & ALERT
```

## :material-check-circle: What's Included

| Component                  | Purpose                                   | Port        |
| -------------------------- | ----------------------------------------- | ----------- |
| Prometheus                 | Metrics scraping and storage              | 9090        |
| Grafana                    | Dashboard visualization and alerting      | 3001        |
| Service /metrics endpoints | Per-service Prometheus metrics            | Per service |
| Structured logging         | Request-level logging with slog/structlog | --          |

## :material-book-open-variant: Sections

- [Prometheus](prometheus.md) -- Scrape configuration and metrics
- [Grafana](grafana.md) -- Dashboards and datasources
- [Alerts](alerts.md) -- Alert rules and notification
- [Logging](logging.md) -- Structured logging setup
