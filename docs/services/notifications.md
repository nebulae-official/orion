# :lucide-bell: Notifications

Real-time notification system for Orion. Domain events (trend detected, content published, media failed, etc.) are automatically converted into per-user notifications, delivered in real-time via WebSocket and available via REST API.

| Property         | Value                                |
| ---------------- | ------------------------------------ |
| **Host Service** | Identity (port 8007)                 |
| **Language**     | Python 3.13                          |
| **Framework**    | FastAPI                              |
| **Source**       | `services/identity/src/identity/`    |
| **Route prefix** | `/api/v1/identity/notifications`     |

## :material-layers: Architecture

Notifications are a module within the Identity service rather than a standalone service. This keeps them co-located with user data and settings, avoiding the operational overhead of an additional service.

```
Domain Event (Redis pub/sub)
    ↓
Identity Service: notification_consumer (background task)
    ↓ checks user preferences
    ↓ creates Notification row in PostgreSQL
    ↓ publishes to orion.notification.created (Redis)
    ↓
Gateway: notification_relay.go
    ↓ subscribes to orion.notification.created
    ↓ looks up user_id → WebSocket connections
    ↓ sends WSMessage{type: "notification", ...}
    ↓
Dashboard: useWebSocket hook → NotificationBell updates badge
CLI: polls via REST API → orion notifications list/count
```

The system follows the same repository pattern as the rest of the Identity service:

```
routes → service → repository → database
```

## :material-api: Endpoints

All endpoints require JWT authentication via the Gateway.

| Method  | Path                                          | Description                              |
| ------- | --------------------------------------------- | ---------------------------------------- |
| `GET`   | `/api/v1/identity/notifications`              | List notifications (paginated)           |
| `PATCH` | `/api/v1/identity/notifications/{id}/read`    | Mark a single notification as read       |
| `POST`  | `/api/v1/identity/notifications/read-all`     | Mark all notifications as read           |
| `GET`   | `/api/v1/identity/notifications/unread-count` | Get unread notification count            |
| `GET`   | `/api/v1/identity/notifications/preferences`  | Get notification preferences             |
| `PUT`   | `/api/v1/identity/notifications/preferences`  | Update notification preferences          |

### List Notifications

```
GET /api/v1/identity/notifications?unread=false&page=1&page_size=20
```

Query parameters:

| Parameter   | Type   | Default | Description                    |
| ----------- | ------ | ------- | ------------------------------ |
| `unread`    | `bool` | `false` | Filter to unread only          |
| `page`      | `int`  | `1`     | Page number (1-indexed)        |
| `page_size` | `int`  | `20`    | Items per page (max 100)       |

Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "type": "trend.detected",
      "title": "New trend detected: AI Coding",
      "body": null,
      "metadata": {"trend_id": "uuid", "source": "google_trends"},
      "is_read": false,
      "read_at": null,
      "created_at": "2026-03-20T12:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "page_size": 20
}
```

### Mark Notification Read

```
PATCH /api/v1/identity/notifications/{notification_id}/read
```

Returns `{"status": "ok"}` on success, `404` if not found or not owned by the user.

### Mark All Read

```
POST /api/v1/identity/notifications/read-all
```

Returns `{"status": "ok", "marked": 5}` with the count of notifications marked.

### Unread Count

```
GET /api/v1/identity/notifications/unread-count
```

Returns `{"count": 12}`.

### Get Preferences

```
GET /api/v1/identity/notifications/preferences
```

Returns the current notification preferences:

```json
{
  "trend_detected": {"enabled": true, "push": true},
  "content_published": {"enabled": true, "push": true},
  "content_rejected": {"enabled": true, "push": true},
  "media_failed": {"enabled": true, "push": true},
  "pipeline_stage_changed": {"enabled": false, "push": false},
  "content_created": {"enabled": false, "push": false}
}
```

### Update Preferences

```
PUT /api/v1/identity/notifications/preferences
```

Send only the fields you want to change:

```json
{
  "trend_detected": {"enabled": true, "push": false},
  "pipeline_stage_changed": {"enabled": true, "push": true}
}
```

## :material-transit-connection: Event-to-Notification Mapping

The notification consumer subscribes to six Redis channels and converts domain events into user notifications:

| Redis Channel                  | Notification Type         | Title Template                          | Target          | Default Push |
| ------------------------------ | ------------------------- | --------------------------------------- | --------------- | ------------ |
| `orion.trend.detected`         | `trend.detected`          | New trend detected: {topic}             | admin/editor    | yes          |
| `orion.content.published`      | `content.published`       | Content published: {title}              | content creator | yes          |
| `orion.content.rejected`       | `content.rejected`        | Content rejected: {title}               | content creator | yes          |
| `orion.media.failed`           | `media.failed`            | Media generation failed for: {title}    | content creator | yes          |
| `orion.pipeline.stage_changed` | `pipeline.stage_changed`  | Pipeline stage: {stage} for {title}     | content creator | no           |
| `orion.content.created`        | `content.created`         | New content created: {title}            | content creator | no           |

**Target modes:**

- **content creator** -- Notifies the user identified by `created_by` in the event payload
- **admin/editor** -- Broadcasts to all active users with `admin` or `editor` role

## :material-bell-ring: Real-Time Delivery

Real-time push uses a two-hop flow through Redis:

1. Identity service creates a notification and publishes to `orion.notification.created`
2. Gateway's `notification_relay.go` subscribes to this channel
3. The relay looks up the user's WebSocket connections in the Hub
4. The notification is delivered as a `WSMessage` with `type: "notification"`

The Gateway Hub supports per-user connection tracking, allowing multiple concurrent sessions (e.g., multiple browser tabs) to all receive notifications.

### WebSocket Message Types

| Type                 | Direction       | Description                              |
| -------------------- | --------------- | ---------------------------------------- |
| `notification`       | server → client | New notification for this user           |
| `notification.read`  | server → client | Notification marked read (cross-tab sync)|
| `notification.count` | server → client | Updated unread count                     |

## :material-cog: Preferences

Notification preferences are stored in the existing `user_settings.settings` JSON column, under the `notification_preferences` key. Each notification type has two toggles:

- **enabled** -- Whether to create a notification record at all
- **push** -- Whether to deliver via WebSocket in real-time (if `false`, notification is only visible via REST API polling)

Defaults when no preferences exist: all types enabled with push, except `pipeline_stage_changed` and `content_created` which default to disabled.

## :material-database: Database

The `notifications` table stores all notification records:

| Column       | Type                       | Description                       |
| ------------ | -------------------------- | --------------------------------- |
| `id`         | `UUID`                     | Primary key                       |
| `user_id`    | `UUID`                     | FK to `users.id` (CASCADE delete) |
| `type`       | `VARCHAR(64)`              | Notification type (e.g. `trend.detected`) |
| `title`      | `VARCHAR(512)`             | Human-readable title              |
| `body`       | `TEXT`                     | Optional body text                |
| `metadata`   | `JSON`                     | Event-specific payload            |
| `is_read`    | `BOOLEAN`                  | Read status (default `false`)     |
| `read_at`    | `TIMESTAMP WITH TIME ZONE` | When marked read                  |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | Creation timestamp                |

Indexes:

- `ix_notifications_user_id` on `user_id`
- `ix_notifications_user_unread` partial index on `(user_id)` where `is_read = false`
- `ix_notifications_user_created` on `(user_id, created_at DESC)`

Migration: `migrations/versions/011_add_notifications_table.py`

## :lucide-terminal: CLI Commands

```bash
# List all notifications
orion notifications list

# List unread only
orion notifications list --unread

# Show unread count
orion notifications count

# Mark a specific notification as read
orion notifications read <notification-id>

# Mark all notifications as read
orion notifications read-all
```

## :lucide-monitor: Dashboard Components

- **NotificationBell** (`dashboard/src/components/notification-bell.tsx`) -- Bell icon in the top navigation bar with unread count badge. Listens for real-time WebSocket updates.
- **NotificationCenter** (`dashboard/src/components/notification-center.tsx`) -- Dropdown panel showing paginated notification list with mark-as-read actions.
- **Notification Preferences** (`dashboard/src/app/(dashboard)/settings/notifications/page.tsx`) -- Settings page with toggle switches for each notification type.

---

!!! tip ":lucide-book-open: Related Documentation"
    - **[Identity Service](identity.md)** -- Parent service that hosts the notification module
    - **[Architecture](../architecture/index.md)** -- System architecture overview
    - **[CLI Quickstart](../guides/cli-quickstart.md)** -- Getting started with the CLI
