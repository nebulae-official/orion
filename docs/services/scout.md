# Scout

Trend detection service that polls external sources, scores emerging topics, and emits events to trigger content generation.

| Property         | Value             |
| ---------------- | ----------------- |
| **Port**         | 8001              |
| **Language**     | Python 3.13       |
| **Framework**    | FastAPI           |
| **Source**       | `services/scout/` |
| **Route prefix** | `/api/v1/trends`  |

## :material-api: Endpoints

### `GET /api/v1/trends`

List active trends with pagination.

**Query Parameters:**

| Param    | Type   | Default | Description       |
| -------- | ------ | ------- | ----------------- |
| `limit`  | int    | 20      | Maximum results   |
| `offset` | int    | 0       | Pagination offset |
| `status` | string | --      | Filter by status  |

=== "curl"

    ```bash
    curl http://localhost:8000/api/v1/scout/api/v1/trends \
      -H "Authorization: Bearer $TOKEN"
    ```

=== "Python"

    ```python
    resp = httpx.get(
        "http://localhost:8000/api/v1/scout/api/v1/trends",
        headers={"Authorization": f"Bearer {token}"},
    )
    trends = resp.json()
    ```

---

### `GET /api/v1/trends/{trend_id}`

Get a single trend by ID.

---

### `POST /api/v1/trends/scan`

Trigger a manual trend scan.

**Request body:**

```json
{
  "region": "US",
  "limit": 10,
  "niche": "technology"
}
```

**Response:**

```json
{
  "message": "Scan complete",
  "trends_found": 10,
  "trends_saved": 7
}
```

---

### `GET /api/v1/trends/config`

Get the active niche configuration (keywords, excluded topics, minimum score).

## :material-cog: Providers

| Provider               | Source            | Description                  |
| ---------------------- | ----------------- | ---------------------------- |
| `GoogleTrendsProvider` | Google Trends API | Real-time trending topics    |
| `RSSProvider`          | RSS feeds         | Configured feed URLs         |
| `TwitterProvider`      | Twitter/X API     | Trending hashtags and topics |

## :material-tune: Niche Configuration

Scout supports niche-specific filtering with customizable keywords:

| Niche     | Example Keywords                 | Min Score |
| --------- | -------------------------------- | --------- |
| `tech`    | AI, machine learning, cloud      | 0.6       |
| `gaming`  | esports, game release, streaming | 0.5       |
| `finance` | crypto, stocks, market           | 0.7       |
| `health`  | wellness, fitness, nutrition     | 0.5       |

## :material-message-arrow-right: Events

| Event     | Channel                | Description                  |
| --------- | ---------------------- | ---------------------------- |
| Published | `orion.trend.detected` | New trend detected and saved |
| Published | `orion.trend.expired`  | Trend is no longer active    |

**Event payload (`orion.trend.detected`):**

```json
{
  "trend_id": "550e8400-e29b-41d4-a716-446655440000",
  "topic": "AI agents in production",
  "source": "google_trends",
  "score": 0.87,
  "niche": "technology"
}
```

---

!!! tip ":lucide-book-open: Visual Guide Available"
    See the **[Trend Monitoring Guide](../guides/trend-monitoring.md)** for a visual walkthrough of how trends are displayed and managed in the dashboard.
