# Alerts

Prometheus alerting rules for Orion, evaluated every 15 seconds.

## :material-cog: Configuration

Alert rules are referenced in `deploy/prometheus.yml`:

```yaml
rule_files:
  - "/etc/prometheus/alert_rules.yml"
```

## :material-alert: Recommended Alert Rules

### Service Health

```yaml
groups:
  - name: orion-health
    rules:
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "{{ $labels.job }} is down"
          description: "{{ $labels.job }} has been unreachable for more than 1 minute."

      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) by (job)
          / sum(rate(http_requests_total[5m])) by (job)
          > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate on {{ $labels.job }}"
          description: "Error rate is {{ $value | humanizePercentage }} over the last 5 minutes."

      - alert: HighLatency
        expr: |
          histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, job))
          > 2.0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High P95 latency on {{ $labels.job }}"
          description: "P95 latency is {{ $value }}s."
```

### Pipeline Health

```yaml
- alert: PipelineFailureRate
  expr: |
    sum(rate(pipeline_runs_total{status="failed"}[1h]))
    / sum(rate(pipeline_runs_total[1h]))
    > 0.2
  for: 15m
  labels:
    severity: warning
  annotations:
    summary: "High pipeline failure rate"
    description: "{{ $value | humanizePercentage }} of pipelines are failing."

- alert: NoPipelineRuns
  expr: sum(increase(pipeline_runs_total[1h])) == 0
  for: 2h
  labels:
    severity: info
  annotations:
    summary: "No pipeline runs in the last 2 hours"
```

### Infrastructure

```yaml
- alert: PostgreSQLDown
  expr: pg_up == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "PostgreSQL is down"

- alert: RedisDown
  expr: redis_up == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Redis is down"

- alert: MilvusDown
  expr: up{job="milvus"} == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Milvus is down"
```

## :material-bell: Notification Channels

Configure Grafana alert notifications for:

- **Slack** -- Real-time alerts to an ops channel
- **Email** -- Critical alerts to on-call
- **PagerDuty** -- Severity-based escalation

!!! tip "Grafana alerting"
While Prometheus handles alert evaluation, Grafana provides a richer notification system. Configure alert contact points in Grafana's alerting UI at `http://localhost:3003/alerting`.
