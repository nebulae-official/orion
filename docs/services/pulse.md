# Pulse

Analytics service that aggregates events, tracks content performance, monitors AI costs, and maintains pipeline execution history.

| Property         | Value                                                    |
| ---------------- | -------------------------------------------------------- |
| **Port**         | 8005                                                     |
| **Language**     | Python 3.13                                              |
| **Framework**    | FastAPI                                                  |
| **Source**       | `services/pulse/`                                        |
| **Route prefix** | `/api/v1/analytics`, `/api/v1/costs`, `/api/v1/pipeline` |

## :material-api: Endpoints

### `GET /api/v1/analytics/content/{content_id}`

Get analytics for a specific content item (views, engagement, conversion metrics).

=== "curl"

    ```bash
    curl http://localhost:8000/api/v1/pulse/api/v1/analytics/content/{content_id} \
      -H "Authorization: Bearer $TOKEN"
    ```

=== "Python"

    ```python
    resp = httpx.get(
        f"http://localhost:8000/api/v1/pulse/api/v1/analytics/content/{content_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    analytics = resp.json()
    ```

---

### `GET /api/v1/analytics/trends`

Get trend performance analytics across all detected trends.

---

### `GET /api/v1/costs/summary`

Get AI cost breakdown by provider.

```json
{
  "total_cost_usd": 12.45,
  "by_provider": {
    "ollama": { "tokens": 125000, "cost_usd": 0.0 },
    "fal_ai": { "requests": 45, "cost_usd": 12.45 }
  }
}
```

---

### `GET /api/v1/costs/timeline`

Get cost trends over time (daily/weekly/monthly).

---

### `GET /api/v1/pipeline/history`

Get pipeline execution history.

## :material-cog: Key Components

| Component         | Purpose                                                |
| ----------------- | ------------------------------------------------------ |
| `EventAggregator` | Listens to all `orion.*` Redis channels                |
| `CostTracker`     | Tracks token usage and API costs per provider          |
| Cleanup scheduler | Deletes records older than 90 days (runs at 02:00 UTC) |

## :material-clock: Data Retention

| Type             | Retention Period | Cleanup Schedule   |
| ---------------- | ---------------- | ------------------ |
| Analytics events | 90 days          | Daily at 02:00 UTC |
| Cost records     | 90 days          | Daily at 02:00 UTC |
| Pipeline history | 90 days          | Daily at 02:00 UTC |

## :material-message-arrow-right: Events

Pulse is the primary event consumer -- it subscribes to all channels:

| Channel                        | Purpose                      |
| ------------------------------ | ---------------------------- |
| `orion.trend.detected`         | Track trend discovery        |
| `orion.trend.expired`          | Track trend lifecycle        |
| `orion.content.created`        | Track content generation     |
| `orion.content.updated`        | Track content status changes |
| `orion.content.published`      | Track publication            |
| `orion.media.generated`        | Track media generation       |
| `orion.media.failed`           | Track failures               |
| `orion.pipeline.stage_changed` | Track pipeline progress      |
