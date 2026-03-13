# Endpoints

Complete API endpoint reference organized by service.

---

## :material-heart-pulse: Health & System

| Method | Path                   | Auth   | Description             |
| ------ | ---------------------- | ------ | ----------------------- |
| `GET`  | `/health`              | No     | Gateway liveness probe  |
| `GET`  | `/ready`               | No     | Gateway readiness probe |
| `GET`  | `/metrics`             | No     | Prometheus metrics      |
| `POST` | `/api/v1/auth/login`   | No     | Authenticate            |
| `POST` | `/api/v1/auth/refresh` | Bearer | Refresh JWT             |

---

## :material-radar: Scout (Trends)

All endpoints require `Authorization: Bearer <token>`.

| Method | Path                                     | Description             |
| ------ | ---------------------------------------- | ----------------------- |
| `GET`  | `/api/v1/scout/api/v1/trends`            | List active trends      |
| `GET`  | `/api/v1/scout/api/v1/trends/{trend_id}` | Get single trend        |
| `POST` | `/api/v1/scout/api/v1/trends/scan`       | Trigger manual scan     |
| `GET`  | `/api/v1/scout/api/v1/trends/config`     | Get niche configuration |

### Scan Request

```json
{
  "region": "US",
  "limit": 10,
  "niche": "technology"
}
```

### Scan Response

```json
{
  "message": "Scan complete",
  "trends_found": 10,
  "trends_saved": 7
}
```

---

## :material-movie-open: Director (Content)

| Method | Path                                                          | Description                 |
| ------ | ------------------------------------------------------------- | --------------------------- |
| `POST` | `/api/v1/director/api/v1/content/generate`                    | Generate content from trend |
| `POST` | `/api/v1/director/api/v1/content/resume`                      | Resume paused HITL pipeline |
| `GET`  | `/api/v1/director/api/v1/content`                             | List content items          |
| `GET`  | `/api/v1/director/api/v1/content/{content_id}`                | Get content details         |
| `GET`  | `/api/v1/director/api/v1/content/{content_id}/visual-prompts` | Get visual prompts          |

### Generate Request

```json
{
  "trend_id": "uuid",
  "trend_topic": "AI agents in production",
  "niche": "technology",
  "target_platform": "youtube_shorts",
  "tone": "informative and engaging",
  "visual_style": "cinematic"
}
```

### Resume Request

```json
{
  "thread_id": "thread-uuid",
  "approved": true,
  "feedback": "Optional feedback text"
}
```

---

## :material-image-multiple: Media (Images)

| Method | Path                                             | Description                |
| ------ | ------------------------------------------------ | -------------------------- |
| `POST` | `/api/v1/media/api/v1/media/generate`            | Generate single image      |
| `POST` | `/api/v1/media/api/v1/media/batch`               | Batch generate images      |
| `GET`  | `/api/v1/media/api/v1/media/assets/{content_id}` | Get assets for content     |
| `GET`  | `/api/v1/media/api/v1/media/providers`           | List provider availability |

### Generate Request

```json
{
  "prompt": "A futuristic cityscape with neon lights",
  "negative_prompt": "blurry, low quality",
  "width": 1024,
  "height": 1024,
  "steps": 30,
  "cfg_scale": 7.5,
  "seed": 42,
  "content_id": "optional-uuid"
}
```

### Batch Request

```json
{
  "content_id": "uuid",
  "prompts": [
    { "prompt": "Scene 1 description" },
    { "prompt": "Scene 2 description" }
  ]
}
```

---

## :material-video-vintage: Editor (Video)

| Method | Path                                                      | Description                  |
| ------ | --------------------------------------------------------- | ---------------------------- |
| `POST` | `/api/v1/editor/api/v1/editor/render`                     | Trigger full render pipeline |
| `POST` | `/api/v1/editor/api/v1/editor/tts`                        | Generate TTS audio           |
| `POST` | `/api/v1/editor/api/v1/editor/captions`                   | Generate captions            |
| `GET`  | `/api/v1/editor/api/v1/editor/render/{content_id}/status` | Render status                |

### Render Request

```json
{
  "content_id": "uuid",
  "voice_id": "default",
  "subtitle_style": "tiktok",
  "video_width": 1080,
  "video_height": 1920
}
```

### TTS Request

```json
{
  "text": "Script text here",
  "voice_id": "default",
  "speed": 1.0,
  "output_format": "mp3"
}
```

---

## :material-chart-line: Pulse (Analytics)

| Method | Path                                                  | Description                |
| ------ | ----------------------------------------------------- | -------------------------- |
| `GET`  | `/api/v1/pulse/api/v1/analytics/content/{content_id}` | Content analytics          |
| `GET`  | `/api/v1/pulse/api/v1/analytics/trends`               | Trend performance          |
| `GET`  | `/api/v1/pulse/api/v1/costs/summary`                  | Cost breakdown             |
| `GET`  | `/api/v1/pulse/api/v1/costs/timeline`                 | Cost trends over time      |
| `GET`  | `/api/v1/pulse/api/v1/pipeline/history`               | Pipeline execution history |

---

## :material-send: Publisher (Publishing)

| Method | Path                                       | Description                  |
| ------ | ------------------------------------------ | ---------------------------- |
| `POST` | `/api/v1/publisher/api/v1/publish/`        | Publish content to platforms |
| `GET`  | `/api/v1/publisher/api/v1/publish/history` | Publishing history           |

### Publish Request

```json
{
  "content_id": "uuid",
  "platforms": ["twitter", "youtube", "tiktok"]
}
```
