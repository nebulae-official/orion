# Publisher

Social media publishing service that manages platform connections and distributes approved content to Twitter/X, YouTube, TikTok, and Instagram.

| Property         | Value                                 |
| ---------------- | ------------------------------------- |
| **Port**         | 8006                                  |
| **Language**     | Python 3.13                           |
| **Framework**    | FastAPI                               |
| **Source**       | `services/publisher/`                 |
| **Route prefix** | `/api/v1/publish`, `/api/v1/accounts` |

## :material-api: Endpoints

### `POST /api/v1/publish/`

Publish content to one or more platforms.

**Request body:**

```json
{
  "content_id": "content-uuid",
  "platforms": ["twitter", "youtube", "tiktok"]
}
```

=== "curl"

    ```bash
    curl -X POST http://localhost:8000/api/v1/publisher/api/v1/publish/ \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "content_id": "content-uuid",
        "platforms": ["twitter", "youtube"]
      }'
    ```

=== "Python"

    ```python
    resp = httpx.post(
        "http://localhost:8000/api/v1/publisher/api/v1/publish/",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "content_id": "content-uuid",
            "platforms": ["twitter", "youtube"],
        },
    )
    result = resp.json()
    ```

---

### `GET /api/v1/publish/history`

Get publishing history.

| Param        | Type | Default | Description       |
| ------------ | ---- | ------- | ----------------- |
| `content_id` | uuid | --      | Filter by content |
| `limit`      | int  | 50      | Maximum results   |

## :material-share-variant: Supported Platforms

| Platform  | Key         | Description                        |
| --------- | ----------- | ---------------------------------- |
| Twitter/X | `twitter`   | Post tweets with media             |
| YouTube   | `youtube`   | Upload Shorts and long-form videos |
| TikTok    | `tiktok`    | Upload short-form videos           |
| Instagram | `instagram` | Upload Reels                       |

## :material-database: Data Models

| Model           | Purpose                                      |
| --------------- | -------------------------------------------- |
| `SocialAccount` | Connected platform accounts with credentials |
| `PublishRecord` | Publication history per content per platform |

## :material-message-arrow-right: Events

| Direction | Channel                   | Description                    |
| --------- | ------------------------- | ------------------------------ |
| Published | `orion.content.published` | Content successfully published |
