# :lucide-bell: Notification System Guide

This guide covers how to use Orion's notification system from both the dashboard and CLI. Notifications keep you informed about important events in the content pipeline -- new trends, published content, failures, and pipeline stage changes.

---

## :lucide-monitor: Dashboard Notifications

### Notification Bell

The notification bell icon appears in the top navigation bar. A red badge shows your unread notification count.

Click the bell to open the **Notification Center**, a dropdown panel listing your recent notifications.

### Notification Center

The Notification Center shows your notifications in reverse chronological order. Each notification displays:

- **Title** -- What happened (e.g., "New trend detected: AI Coding")
- **Body** -- Additional context (if available)
- **Timestamp** -- When the event occurred
- **Read status** -- Unread notifications are highlighted

**Actions:**

- Click the **check icon** on an individual notification to mark it as read
- Click the **double-check icon** in the header to mark all notifications as read
- Click the **X** to close the panel

### Real-Time Updates

Notifications are delivered in real-time via WebSocket. When a new event occurs (e.g., a trend is detected or content fails to generate), the bell badge updates immediately without requiring a page refresh. Multiple browser tabs all receive updates simultaneously.

### Notification Preferences

Navigate to **Settings > Notifications** to configure which notification types you receive.

For each notification type, you can toggle:

- **Enabled** -- Whether to create a notification at all
- **Push** -- Whether to deliver it in real-time via WebSocket (if disabled, the notification is still created but only visible when you check the notification list)

Default preferences:

| Type                     | Enabled | Push |
| ------------------------ | ------- | ---- |
| Trend Detected           | yes     | yes  |
| Content Published        | yes     | yes  |
| Content Rejected         | yes     | yes  |
| Media Failed             | yes     | yes  |
| Pipeline Stage Changed   | no      | no   |
| Content Created          | no      | no   |

---

## :lucide-terminal: CLI Notifications

### List Notifications

```bash
# List all notifications (paginated)
orion notifications list

# List unread notifications only
orion notifications list --unread

# Specify page number
orion notifications list --page 2

# Output as JSON
orion notifications list --format json
```

### Check Unread Count

```bash
orion notifications count
# Output: Unread: 5
```

### Mark as Read

```bash
# Mark a single notification as read
orion notifications read <notification-id>

# Mark all notifications as read
orion notifications read-all
# Output: Marked 5 notifications as read.
```

---

## :material-transit-connection: How It Works

### Event Flow

1. A domain event occurs (e.g., Scout detects a new trend)
2. The originating service publishes to the appropriate Redis channel (e.g., `orion.trend.detected`)
3. The Identity service's **notification consumer** (a background task) receives the event
4. The consumer checks user preferences to determine if the notification should be created
5. If enabled, a notification record is created in PostgreSQL
6. If push is enabled, the notification is published to `orion.notification.created` on Redis
7. The Gateway's **notification relay** picks up the message and pushes it to the user's WebSocket connection(s)

### Notification Types

| Type                    | Trigger                                | Who Gets Notified      |
| ----------------------- | -------------------------------------- | ---------------------- |
| `trend.detected`        | Scout finds a new trend                | All admin/editor users |
| `content.published`     | Content is published to social media   | Content creator        |
| `content.rejected`      | Content is rejected during review      | Content creator        |
| `media.failed`          | Image/media generation fails           | Content creator        |
| `pipeline.stage_changed`| Content moves to a new pipeline stage  | Content creator        |
| `content.created`       | Director creates new content           | Content creator        |

### User Targeting

- **Broadcast events** (like `trend.detected`) notify all active users with `admin` or `editor` roles
- **Creator events** (like `content.published`) notify only the user who created the content, identified by the `created_by` field in the event payload

---

!!! tip "Quick Start"
    1. Log in to the dashboard or CLI
    2. Click the bell icon (dashboard) or run `orion notifications count` (CLI)
    3. Customize your preferences in **Settings > Notifications** or via the API at `PUT /api/v1/identity/notifications/preferences`
