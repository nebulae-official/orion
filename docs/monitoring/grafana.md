# Grafana

Grafana provides visualization dashboards and alerting for Orion metrics.

## :material-cog: Access

- **URL:** `http://localhost:3003`
- **Default credentials:** `admin` / `admin`

## :material-database: Datasource

Grafana is auto-provisioned with a Prometheus datasource via `deploy/grafana/provisioning/datasources/datasource.yml`:

```yaml
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

## :material-monitor-dashboard: Pre-built Dashboards

Dashboards are provisioned from `deploy/grafana/provisioning/dashboards/json/`:

| Dashboard           | File                   | Description                                                   |
| ------------------- | ---------------------- | ------------------------------------------------------------- |
| **Orion Overview**  | `orion-overview.json`  | Service health, request rates, error rates, latencies         |
| **Provider Health** | `provider-health.json` | AI provider availability, response times, costs               |
| **GPU Resources**   | `gpu-resources.json`   | GPU utilization, memory, temperature (requires --profile gpu) |

Dashboard provisioning config (`deploy/grafana/provisioning/dashboards/dashboard.yml`):

```yaml
providers:
  - name: Orion
    orgId: 1
    folder: Orion
    type: file
    disableDeletion: false
    editable: true
    options:
      path: /etc/grafana/provisioning/dashboards/json
```

## :material-view-dashboard: Orion Overview Dashboard

Key panels:

| Panel             | Query                                                                      | Description                    |
| ----------------- | -------------------------------------------------------------------------- | ------------------------------ |
| Request Rate      | `rate(http_requests_total[5m])`                                            | Requests per second by service |
| Error Rate        | `rate(http_requests_total{status=~"5.."}[5m])`                             | 5xx errors per second          |
| P95 Latency       | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))` | 95th percentile response time  |
| Active WebSockets | `websocket_connections_active`                                             | Current WebSocket connections  |
| Pipeline Status   | `pipeline_runs_total`                                                      | Pipeline runs by status        |

## :material-plus: Adding Custom Dashboards

1. Create a dashboard JSON file in `deploy/grafana/provisioning/dashboards/json/`
2. The dashboard will be auto-loaded on Grafana startup
3. Alternatively, create dashboards in the Grafana UI (set `editable: true`)
