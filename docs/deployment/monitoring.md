# Monitoring

Orion includes built-in Prometheus metrics collection and Grafana dashboards.

## :material-play: Starting the Monitoring Stack

The monitoring stack runs via a separate compose file:

```bash
make up-monitoring
# or
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.monitoring.yml up -d
```

## :material-chart-line: Stack

```mermaid
graph LR
    S["Services\n/metrics"] --> P["Prometheus\n:9090"]
    P --> G["Grafana\n:3001"]
    G --> U["Dashboard\nAlerts"]
```

| Component    | Port | Purpose                        |
| ------------ | ---- | ------------------------------ |
| Prometheus   | 9090 | Metrics collection and storage |
| Alertmanager | 9093 | Alert routing and deduplication|
| Grafana      | 3001 | Visualization and alerting     |

!!! warning "Port conflict with dashboard dev server"
    Grafana binds to port 3001, which is also used by the Next.js dashboard dev server. Run only one at a time, or change the Grafana port in `docker-compose.monitoring.yml`.

## :material-cog: Prometheus Configuration

The Prometheus config is at `deploy/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    project: orion

scrape_configs:
  - job_name: gateway
    static_configs:
      - targets: ["gateway:8000"]
    metrics_path: /metrics

  - job_name: scout
    static_configs:
      - targets: ["scout:8001"]

  - job_name: director
    static_configs:
      - targets: ["director:8002"]

  - job_name: media
    static_configs:
      - targets: ["media:8003"]

  - job_name: editor
    static_configs:
      - targets: ["editor:8004"]

  - job_name: pulse
    static_configs:
      - targets: ["pulse:8005"]

  - job_name: milvus
    static_configs:
      - targets: ["milvus:9091"]
```

## :material-monitor-dashboard: Grafana Dashboards

Pre-provisioned dashboards are in `deploy/grafana/provisioning/dashboards/json/`:

| Dashboard       | File                   | Description                                |
| --------------- | ---------------------- | ------------------------------------------ |
| Orion Overview  | `orion-overview.json`  | Service health, request rates, latencies   |
| Provider Health | `provider-health.json` | AI provider status and costs               |
| GPU Resources   | `gpu-resources.json`   | GPU utilization (when using --profile gpu) |

### Datasource

Grafana is auto-provisioned with a Prometheus datasource:

```yaml
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

For detailed configuration, see the [Monitoring section](../monitoring/index.md).
