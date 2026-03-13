# API Reference

The Orion API is accessed through the Go gateway on port `8000`. All service endpoints are proxied through the gateway with JWT authentication.

## :material-api: Base URL

```
http://localhost:8000
```

In production, replace with your domain and ensure TLS is configured.

## :material-sitemap: API Structure

All service endpoints follow the pattern:

```
/api/v1/{service}/{service-specific-path}
```

| Service   | Gateway Prefix       | Service Route Prefix                                     |
| --------- | -------------------- | -------------------------------------------------------- |
| Scout     | `/api/v1/scout/`     | `/api/v1/trends`                                         |
| Director  | `/api/v1/director/`  | `/api/v1/content`                                        |
| Media     | `/api/v1/media/`     | `/api/v1/media`                                          |
| Editor    | `/api/v1/editor/`    | `/api/v1/editor`                                         |
| Pulse     | `/api/v1/pulse/`     | `/api/v1/analytics`, `/api/v1/costs`, `/api/v1/pipeline` |
| Publisher | `/api/v1/publisher/` | `/api/v1/publish`, `/api/v1/accounts`                    |

## :material-format-list-checks: Quick Reference

| Method | Endpoint                                      | Description           |
| ------ | --------------------------------------------- | --------------------- |
| `POST` | `/api/v1/auth/login`                          | Authenticate          |
| `POST` | `/api/v1/auth/refresh`                        | Refresh token         |
| `GET`  | `/api/v1/scout/api/v1/trends`                 | List trends           |
| `POST` | `/api/v1/scout/api/v1/trends/scan`            | Trigger scan          |
| `POST` | `/api/v1/director/api/v1/content/generate`    | Generate content      |
| `POST` | `/api/v1/director/api/v1/content/resume`      | Resume HITL pipeline  |
| `GET`  | `/api/v1/director/api/v1/content`             | List content          |
| `POST` | `/api/v1/media/api/v1/media/generate`         | Generate image        |
| `POST` | `/api/v1/media/api/v1/media/batch`            | Batch generate images |
| `POST` | `/api/v1/editor/api/v1/editor/render`         | Render video          |
| `POST` | `/api/v1/editor/api/v1/editor/tts`            | Generate TTS audio    |
| `GET`  | `/api/v1/pulse/api/v1/analytics/content/{id}` | Content analytics     |
| `GET`  | `/api/v1/pulse/api/v1/costs/summary`          | Cost summary          |
| `POST` | `/api/v1/publisher/api/v1/publish/`           | Publish content       |
| `GET`  | `/ws`                                         | WebSocket connection  |

## :material-book-open-variant: Sections

- [Authentication](authentication.md) -- JWT login, refresh, and token usage
- [Endpoints](endpoints.md) -- Full endpoint reference by service
- [WebSocket](websocket.md) -- Real-time event streaming
- [Errors](errors.md) -- Error codes and response formats
