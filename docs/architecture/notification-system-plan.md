# Notification System Architecture Plan

> **Status:** Draft
> **Author:** planner agent
> **Date:** 2026-03-20

## Overview

Add a real-time notification system to Orion. Domain events (trend detected, content published, media failed, etc.) produce persisted notifications per user. Notifications are delivered in real-time via WebSocket and available via REST API for the dashboard and CLI.

**Design principles:**
- Notifications live inside the Identity service (it already owns user data)
- No new service — add a notification module to Identity
- Gateway WebSocket Hub upgraded from broadcast-only to per-user targeting
- Dashboard gets a NotificationBell + NotificationCenter
- CLI gets `orion notifications` subcommands

---

## 1. Database Schema

### 1.1 Notification Model

Table: `notifications`

| Column       | Type                          | Constraints                        |
|-------------|-------------------------------|-------------------------------------|
| `id`        | `UUID`                        | PK, default `uuid4`                |
| `user_id`   | `UUID`                        | FK → `users.id`, NOT NULL, indexed |
| `type`      | `VARCHAR(64)`                 | NOT NULL (e.g. `trend.detected`)   |
| `title`     | `VARCHAR(512)`                | NOT NULL                           |
| `body`      | `TEXT`                        | nullable                           |
| `metadata`  | `JSON`                        | nullable (event-specific payload)  |
| `is_read`   | `BOOLEAN`                     | NOT NULL, default `false`          |
| `read_at`   | `TIMESTAMP WITH TIME ZONE`    | nullable                           |
| `created_at`| `TIMESTAMP WITH TIME ZONE`    | NOT NULL, default `now()`          |

Indexes:
- `ix_notifications_user_id` on `user_id`
- `ix_notifications_user_unread` on `(user_id, is_read)` WHERE `is_read = false` (partial index for fast unread count)
- `ix_notifications_user_created` on `(user_id, created_at DESC)` for paginated listing

### 1.2 Notification Preferences

Embed in existing `UserSettings.settings` JSON column rather than a new table. This avoids a migration for preferences and leverages the existing settings infrastructure.

Schema within `user_settings.settings`:

```json
{
  "notification_preferences": {
    "trend_detected": { "enabled": true, "push": true },
    "content_published": { "enabled": true, "push": true },
    "content_rejected": { "enabled": true, "push": true },
    "media_failed": { "enabled": true, "push": true },
    "pipeline_stage_changed": { "enabled": false, "push": false }
  }
}
```

- `enabled`: whether to create a notification record at all
- `push`: whether to send real-time WebSocket push (if false, notification is only visible via API/polling)

Defaults (when no preferences exist): all types enabled, all push enabled except `pipeline_stage_changed`.

### 1.3 Alembic Migration

**File:** `migrations/versions/011_add_notifications_table.py`

```python
"""Add notifications table.

Revision ID: 011
Revises: 010
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

revision = "011"
down_revision = "010"

def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(64), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("metadata", JSON, nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index(
        "ix_notifications_user_unread",
        "notifications",
        ["user_id"],
        postgresql_where=sa.text("is_read = false"),
    )
    op.create_index("ix_notifications_user_created", "notifications", ["user_id", sa.text("created_at DESC")])

def downgrade() -> None:
    op.drop_table("notifications")
```

---

## 2. Event-to-Notification Mapping

### 2.1 Mapping Table

| Redis Channel                    | Notification Type          | Title Template                              | Target Users              | Default Push |
|----------------------------------|---------------------------|---------------------------------------------|---------------------------|--------------|
| `orion.trend.detected`           | `trend.detected`          | `New trend detected: {topic}`               | All users with role admin/editor | yes |
| `orion.content.published`        | `content.published`       | `Content published: {title}`                | Content creator (`created_by`)   | yes |
| `orion.content.rejected`         | `content.rejected`        | `Content rejected: {title}`                 | Content creator (`created_by`)   | yes |
| `orion.media.failed`             | `media.failed`            | `Media generation failed for: {title}`      | Content creator (`created_by`)   | yes |
| `orion.pipeline.stage_changed`   | `pipeline.stage_changed`  | `Pipeline stage: {stage} for {title}`       | Content creator (`created_by`)   | no  |
| `orion.content.created`          | `content.created`         | `New content created: {title}`              | Content creator (`created_by`)   | no  |

### 2.2 Expected Event Payloads

All events are JSON published to Redis. The notification consumer expects at minimum:

```python
# orion.trend.detected
{"trend_id": "uuid", "topic": "string", "source": "string", "score": 0.95}

# orion.content.published / rejected / created
{"content_id": "uuid", "title": "string", "created_by": "uuid"}

# orion.media.failed
{"content_id": "uuid", "title": "string", "created_by": "uuid", "error": "string"}

# orion.pipeline.stage_changed
{"content_id": "uuid", "title": "string", "created_by": "uuid", "stage": "string", "status": "string"}
```

### 2.3 New Redis Channel

Add `orion.notification.created` to both Python and Go channel constants. This channel is used to push real-time notifications from the Identity service to the Gateway WebSocket Hub.

Payload published to `orion.notification.created`:

```json
{
  "user_id": "uuid",
  "notification": {
    "id": "uuid",
    "type": "trend.detected",
    "title": "New trend detected: AI Coding",
    "body": null,
    "metadata": {"trend_id": "uuid", "source": "google_trends"},
    "is_read": false,
    "created_at": "2026-03-20T12:00:00Z"
  }
}
```

---

## 3. Backend Service Layer (Identity Service)

### 3.1 Architecture Decision

Add notifications as a new module inside the Identity service. Rationale:
- Identity already owns user data, settings, and auth
- Notifications are inherently user-scoped
- Avoids operational overhead of a new service
- Shares the same database session and user repositories

### 3.2 ORM Model

**File:** `libs/orion-common/orion_common/db/models.py` (add to existing file)

```python
class Notification(Base):
    """A user notification."""

    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
```

Add relationship to User model:

```python
# In User class
notifications: Mapped[list["Notification"]] = relationship(
    back_populates="user", cascade="all, delete-orphan"
)

# In Notification class
user: Mapped["User"] = relationship(back_populates="notifications")
```

### 3.3 Pydantic Schemas

**File:** `services/identity/src/identity/schemas/notifications.py`

```python
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class NotificationOut(BaseModel):
    """Response schema for a notification."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: str
    title: str
    body: str | None = None
    metadata: dict[str, Any] | None = Field(None, alias="metadata_")
    is_read: bool
    read_at: datetime | None = None
    created_at: datetime


class NotificationListOut(BaseModel):
    """Paginated notification list."""
    items: list[NotificationOut]
    total: int
    page: int
    page_size: int


class UnreadCountOut(BaseModel):
    """Unread notification count."""
    count: int


class NotificationPreference(BaseModel):
    """Preference for a single notification type."""
    enabled: bool = True
    push: bool = True


class NotificationPreferencesOut(BaseModel):
    """All notification preferences."""
    trend_detected: NotificationPreference = NotificationPreference()
    content_published: NotificationPreference = NotificationPreference()
    content_rejected: NotificationPreference = NotificationPreference()
    media_failed: NotificationPreference = NotificationPreference()
    pipeline_stage_changed: NotificationPreference = NotificationPreference(enabled=False, push=False)
    content_created: NotificationPreference = NotificationPreference(enabled=False, push=False)


class NotificationPreferencesIn(BaseModel):
    """Update notification preferences."""
    trend_detected: NotificationPreference | None = None
    content_published: NotificationPreference | None = None
    content_rejected: NotificationPreference | None = None
    media_failed: NotificationPreference | None = None
    pipeline_stage_changed: NotificationPreference | None = None
    content_created: NotificationPreference | None = None
```

### 3.4 Repository

**File:** `services/identity/src/identity/repositories/notification_repo.py`

```python
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from orion_common.db.models import Notification


class NotificationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        user_id: uuid.UUID,
        type: str,
        title: str,
        body: str | None = None,
        metadata: dict | None = None,
    ) -> Notification:
        notification = Notification(
            user_id=user_id,
            type=type,
            title=title,
            body=body,
            metadata_=metadata,
        )
        self._session.add(notification)
        await self._session.flush()
        return notification

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        *,
        unread_only: bool = False,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Notification], int]:
        query = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            query = query.where(Notification.is_read == False)  # noqa: E712
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self._session.execute(count_query)).scalar_one()

        query = query.order_by(Notification.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self._session.execute(query)
        return list(result.scalars().all()), total

    async def get_unread_count(self, user_id: uuid.UUID) -> int:
        query = (
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
        )
        return (await self._session.execute(query)).scalar_one()

    async def mark_read(self, notification_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        result = await self._session.execute(
            update(Notification)
            .where(Notification.id == notification_id, Notification.user_id == user_id)
            .values(is_read=True, read_at=datetime.now(timezone.utc))
        )
        return result.rowcount > 0

    async def mark_all_read(self, user_id: uuid.UUID) -> int:
        result = await self._session.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
            .values(is_read=True, read_at=datetime.now(timezone.utc))
        )
        return result.rowcount
```

### 3.5 Service Layer

**File:** `services/identity/src/identity/services/notification_service.py`

```python
from __future__ import annotations

import json
import uuid

import redis.asyncio as aioredis
import structlog

from ..repositories.notification_repo import NotificationRepository
from ..schemas.notifications import NotificationOut

logger = structlog.get_logger()

NOTIFICATION_CREATED_CHANNEL = "orion.notification.created"


class NotificationService:
    def __init__(self, repo: NotificationRepository, redis: aioredis.Redis) -> None:
        self._repo = repo
        self._redis = redis

    async def create_notification(
        self,
        user_id: uuid.UUID,
        type: str,
        title: str,
        body: str | None = None,
        metadata: dict | None = None,
        push: bool = True,
    ) -> NotificationOut:
        notification = await self._repo.create(
            user_id=user_id, type=type, title=title, body=body, metadata=metadata
        )
        out = NotificationOut.model_validate(notification)

        if push:
            await self._publish_ws(user_id, out)

        return out

    async def _publish_ws(self, user_id: uuid.UUID, notification: NotificationOut) -> None:
        """Publish to Redis so the Gateway WebSocket Hub can push to the user."""
        payload = {
            "user_id": str(user_id),
            "notification": notification.model_dump(mode="json"),
        }
        await self._redis.publish(NOTIFICATION_CREATED_CHANNEL, json.dumps(payload))

    async def list_notifications(
        self, user_id: uuid.UUID, *, unread_only: bool = False, page: int = 1, page_size: int = 20
    ) -> tuple[list[NotificationOut], int]:
        notifications, total = await self._repo.list_for_user(
            user_id, unread_only=unread_only, page=page, page_size=page_size
        )
        return [NotificationOut.model_validate(n) for n in notifications], total

    async def get_unread_count(self, user_id: uuid.UUID) -> int:
        return await self._repo.get_unread_count(user_id)

    async def mark_read(self, notification_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        return await self._repo.mark_read(notification_id, user_id)

    async def mark_all_read(self, user_id: uuid.UUID) -> int:
        return await self._repo.mark_all_read(user_id)
```

### 3.6 FastAPI Routes

**File:** `services/identity/src/identity/routes/notifications.py`

All routes are proxied through the gateway at `/api/v1/identity/notifications/*`. The gateway forwards `X-User-ID` after JWT validation.

```python
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from orion_common.db.session import get_session
from orion_common.middleware import get_current_user

from ..repositories.notification_repo import NotificationRepository
from ..schemas.notifications import (
    NotificationListOut,
    NotificationPreferencesIn,
    NotificationPreferencesOut,
    UnreadCountOut,
)
from ..services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _get_service(session: AsyncSession = Depends(get_session)) -> NotificationService:
    repo = NotificationRepository(session)
    # Redis injected from app state — see identity main.py
    from ..main import redis_client
    return NotificationService(repo, redis_client)


@router.get("", response_model=NotificationListOut)
async def list_notifications(
    user: Annotated[dict, Depends(get_current_user)],
    service: Annotated[NotificationService, Depends(_get_service)],
    unread: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> NotificationListOut:
    """List notifications for the authenticated user."""
    user_id = uuid.UUID(user["user_id"])
    items, total = await service.list_notifications(
        user_id, unread_only=unread, page=page, page_size=page_size
    )
    return NotificationListOut(items=items, total=total, page=page, page_size=page_size)


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: uuid.UUID,
    user: Annotated[dict, Depends(get_current_user)],
    service: Annotated[NotificationService, Depends(_get_service)],
) -> dict:
    """Mark a single notification as read."""
    user_id = uuid.UUID(user["user_id"])
    success = await service.mark_read(notification_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "ok"}


@router.post("/read-all")
async def mark_all_read(
    user: Annotated[dict, Depends(get_current_user)],
    service: Annotated[NotificationService, Depends(_get_service)],
) -> dict:
    """Mark all notifications as read for the authenticated user."""
    user_id = uuid.UUID(user["user_id"])
    count = await service.mark_all_read(user_id)
    return {"status": "ok", "marked": count}


@router.get("/unread-count", response_model=UnreadCountOut)
async def unread_count(
    user: Annotated[dict, Depends(get_current_user)],
    service: Annotated[NotificationService, Depends(_get_service)],
) -> UnreadCountOut:
    """Get unread notification count."""
    user_id = uuid.UUID(user["user_id"])
    count = await service.get_unread_count(user_id)
    return UnreadCountOut(count=count)


@router.get("/preferences", response_model=NotificationPreferencesOut)
async def get_preferences(
    user: Annotated[dict, Depends(get_current_user)],
    session: AsyncSession = Depends(get_session),
) -> NotificationPreferencesOut:
    """Get notification preferences from user settings."""
    user_id = uuid.UUID(user["user_id"])
    from ..repositories.user_repo import UserRepository
    repo = UserRepository(session)
    settings = await repo.get_settings(user_id)
    prefs = (settings or {}).get("notification_preferences", {})
    return NotificationPreferencesOut(**prefs)


@router.put("/preferences", response_model=NotificationPreferencesOut)
async def update_preferences(
    body: NotificationPreferencesIn,
    user: Annotated[dict, Depends(get_current_user)],
    session: AsyncSession = Depends(get_session),
) -> NotificationPreferencesOut:
    """Update notification preferences in user settings."""
    user_id = uuid.UUID(user["user_id"])
    from ..repositories.user_repo import UserRepository
    repo = UserRepository(session)
    settings = await repo.get_settings(user_id) or {}
    prefs = settings.get("notification_preferences", {})
    updates = body.model_dump(exclude_none=True)
    for key, value in updates.items():
        prefs[key] = value if isinstance(value, dict) else value.model_dump()
    settings["notification_preferences"] = prefs
    await repo.update_settings(user_id, settings)
    return NotificationPreferencesOut(**prefs)
```

**Register in Identity main.py:**

```python
from .routes.notifications import router as notifications_router
app.include_router(notifications_router)
```

### 3.7 API Endpoint Summary

All endpoints are behind JWT auth via Gateway at `/api/v1/identity/notifications/...`:

| Method | Path                                          | Description                 |
|--------|-----------------------------------------------|-----------------------------|
| GET    | `/api/v1/identity/notifications`              | List notifications (paginated, ?unread=true) |
| PATCH  | `/api/v1/identity/notifications/{id}/read`    | Mark one as read            |
| POST   | `/api/v1/identity/notifications/read-all`     | Mark all as read            |
| GET    | `/api/v1/identity/notifications/unread-count` | Get unread count            |
| GET    | `/api/v1/identity/notifications/preferences`  | Get preferences             |
| PUT    | `/api/v1/identity/notifications/preferences`  | Update preferences          |

---

## 4. Notification Consumer (Event Listener)

### 4.1 Location

The consumer runs inside the Identity service as a background `asyncio.Task` started during the FastAPI lifespan. This keeps it co-located with the notification service and database session.

### 4.2 Implementation

**File:** `services/identity/src/identity/services/notification_consumer.py`

```python
from __future__ import annotations

import json
import uuid

import redis.asyncio as aioredis
import structlog
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from orion_common.db.models import User, UserSettings
from orion_common.events import Channels

from ..repositories.notification_repo import NotificationRepository
from .notification_service import NotificationService

logger = structlog.get_logger()

# Maps Redis channel → (notification_type, title_template, target_mode)
# target_mode: "creator" = notify content.created_by, "broadcast" = notify all admin/editor users
EVENT_MAP: dict[str, tuple[str, str, str]] = {
    Channels.TREND_DETECTED: (
        "trend.detected",
        "New trend detected: {topic}",
        "broadcast",
    ),
    Channels.CONTENT_PUBLISHED: (
        "content.published",
        "Content published: {title}",
        "creator",
    ),
    Channels.CONTENT_REJECTED: (
        "content.rejected",
        "Content rejected: {title}",
        "creator",
    ),
    Channels.MEDIA_FAILED: (
        "media.failed",
        "Media generation failed for: {title}",
        "creator",
    ),
    Channels.PIPELINE_STAGE_CHANGED: (
        "pipeline.stage_changed",
        "Pipeline stage: {stage} for {title}",
        "creator",
    ),
    Channels.CONTENT_CREATED: (
        "content.created",
        "New content created: {title}",
        "creator",
    ),
}


async def notification_consumer(
    redis: aioredis.Redis,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """Subscribe to domain events and create notifications.

    Runs as an infinite loop inside an asyncio task.
    """
    pubsub = redis.pubsub()
    await pubsub.subscribe(*EVENT_MAP.keys())
    logger.info("notification_consumer_started", channels=list(EVENT_MAP.keys()))

    async for message in pubsub.listen():
        if message["type"] != "message":
            continue

        channel = message["channel"]
        if isinstance(channel, bytes):
            channel = channel.decode()

        try:
            data = json.loads(message["data"])
        except (json.JSONDecodeError, TypeError):
            logger.warning("notification_consumer_bad_payload", channel=channel)
            continue

        mapping = EVENT_MAP.get(channel)
        if not mapping:
            continue

        notif_type, title_template, target_mode = mapping

        try:
            title = title_template.format(**data)
        except KeyError:
            title = title_template  # fallback if template fields missing

        async with session_factory() as session:
            repo = NotificationRepository(session)
            service = NotificationService(repo, redis)

            if target_mode == "creator":
                created_by = data.get("created_by")
                if not created_by:
                    logger.warning("notification_consumer_no_creator", channel=channel)
                    continue
                user_id = uuid.UUID(created_by)
                # Check user preferences
                prefs = await _get_user_prefs(session, user_id)
                type_prefs = prefs.get(notif_type.replace(".", "_"), {})
                if type_prefs.get("enabled", True) is False:
                    continue
                push = type_prefs.get("push", True)
                await service.create_notification(
                    user_id=user_id,
                    type=notif_type,
                    title=title,
                    metadata=data,
                    push=push,
                )
                await session.commit()

            elif target_mode == "broadcast":
                # Notify all admin and editor users
                from sqlalchemy import select
                result = await session.execute(
                    select(User.id).where(User.role.in_(["admin", "editor"]), User.is_active == True)  # noqa: E712
                )
                user_ids = [row[0] for row in result.all()]
                for uid in user_ids:
                    prefs = await _get_user_prefs(session, uid)
                    type_prefs = prefs.get(notif_type.replace(".", "_"), {})
                    if type_prefs.get("enabled", True) is False:
                        continue
                    push = type_prefs.get("push", True)
                    await service.create_notification(
                        user_id=uid,
                        type=notif_type,
                        title=title,
                        metadata=data,
                        push=push,
                    )
                await session.commit()

        logger.debug("notification_created", channel=channel, type=notif_type)


async def _get_user_prefs(session: AsyncSession, user_id: uuid.UUID) -> dict:
    """Load notification preferences from user settings."""
    from sqlalchemy import select
    result = await session.execute(
        select(UserSettings.settings).where(UserSettings.user_id == user_id)
    )
    row = result.scalar_one_or_none()
    if row and isinstance(row, dict):
        return row.get("notification_preferences", {})
    return {}
```

### 4.3 Start in Identity Lifespan

Modify `services/identity/src/identity/main.py`:

```python
from .services.notification_consumer import notification_consumer

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("service_starting", service="identity")
    cleanup_task = asyncio.create_task(token_cleanup_loop(engine))
    consumer_task = asyncio.create_task(
        notification_consumer(redis_client, session_factory)
    )
    yield
    consumer_task.cancel()
    cleanup_task.cancel()
    logger.info("service_stopping", service="identity")
```

---

## 5. Gateway WebSocket Enhancement

### 5.1 Per-User Connection Tracking

The current Hub maps `*websocket.Conn → struct{}`. Upgrade to track user IDs.

**File:** `internal/gateway/handlers/websocket.go`

#### Changes to Hub struct:

```go
type Hub struct {
    // Per-user connection tracking
    userConns  map[string]map[*websocket.Conn]struct{} // user_id → set of connections
    connUser   map[*websocket.Conn]string               // conn → user_id (reverse lookup)
    mu         sync.RWMutex
    broadcast  chan WSMessage
    targeted   chan TargetedMessage
    register   chan *ClientConn
    unregister chan *websocket.Conn
    done       chan struct{}
}

type ClientConn struct {
    Conn   *websocket.Conn
    UserID string
}

type TargetedMessage struct {
    UserID string
    Msg    WSMessage
}
```

#### NewHub:

```go
func NewHub() *Hub {
    return &Hub{
        userConns:  make(map[string]map[*websocket.Conn]struct{}),
        connUser:   make(map[*websocket.Conn]string),
        broadcast:  make(chan WSMessage, 256),
        targeted:   make(chan TargetedMessage, 256),
        register:   make(chan *ClientConn),
        unregister: make(chan *websocket.Conn),
        done:       make(chan struct{}),
    }
}
```

#### Run loop additions:

```go
case cc := <-h.register:
    h.mu.Lock()
    if h.userConns[cc.UserID] == nil {
        h.userConns[cc.UserID] = make(map[*websocket.Conn]struct{})
    }
    h.userConns[cc.UserID][cc.Conn] = struct{}{}
    h.connUser[cc.Conn] = cc.UserID
    h.mu.Unlock()
    slog.Info("ws_client_connected", "user_id", cc.UserID, "total", len(h.connUser))

case conn := <-h.unregister:
    h.mu.Lock()
    if uid, ok := h.connUser[conn]; ok {
        delete(h.userConns[uid], conn)
        if len(h.userConns[uid]) == 0 {
            delete(h.userConns, uid)
        }
        delete(h.connUser, conn)
        conn.Close()
    }
    h.mu.Unlock()

case tm := <-h.targeted:
    data, err := json.Marshal(tm.Msg)
    if err != nil {
        slog.Error("ws_marshal_error", "error", err)
        continue
    }
    h.mu.RLock()
    conns := h.userConns[tm.UserID]
    var failed []*websocket.Conn
    for conn := range conns {
        if err := conn.SetWriteDeadline(time.Now().Add(5 * time.Second)); err != nil {
            failed = append(failed, conn)
            continue
        }
        if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
            failed = append(failed, conn)
        }
    }
    h.mu.RUnlock()
    for _, conn := range failed {
        h.unregister <- conn
    }
```

#### New method:

```go
// SendToUser sends a message to all connections for a specific user.
func (h *Hub) SendToUser(userID string, msg WSMessage) {
    select {
    case h.targeted <- TargetedMessage{UserID: userID, Msg: msg}:
    default:
        slog.Warn("ws_targeted_buffer_full", "user_id", userID)
    }
}
```

### 5.2 HandleWebSocket Update

Extract `user_id` from the ticket identity and pass it to register:

```go
var userID string
if ticket := r.URL.Query().Get("ticket"); ticket != "" {
    // ... existing ticket validation ...
    if json.Unmarshal([]byte(val), &identity) == nil {
        userID = identity["user_id"]
    }
    authenticated = true
}

// After upgrade:
hub.register <- &ClientConn{Conn: conn, UserID: userID}
```

### 5.3 Redis Subscription for Notification Push

**File:** `internal/gateway/handlers/notification_relay.go`

```go
package handlers

import (
    "context"
    "encoding/json"
    "log/slog"

    "github.com/redis/go-redis/v9"
)

type notificationPayload struct {
    UserID       string          `json:"user_id"`
    Notification json.RawMessage `json:"notification"`
}

// StartNotificationRelay subscribes to the notification.created Redis channel
// and relays messages to the appropriate WebSocket user.
func StartNotificationRelay(ctx context.Context, rdb *redis.Client, hub *Hub) {
    pubsub := rdb.Subscribe(ctx, "orion.notification.created")
    ch := pubsub.Channel()

    go func() {
        defer pubsub.Close()
        for {
            select {
            case msg, ok := <-ch:
                if !ok {
                    return
                }
                var payload notificationPayload
                if err := json.Unmarshal([]byte(msg.Payload), &payload); err != nil {
                    slog.Error("notification_relay_unmarshal", "error", err)
                    continue
                }
                hub.SendToUser(payload.UserID, WSMessage{
                    Type:      "notification",
                    Payload:   payload.Notification,
                    Timestamp: "", // will be in the notification payload
                })
            case <-ctx.Done():
                return
            }
        }
    }()

    slog.Info("notification_relay_started")
}
```

Start in `cmd/gateway/main.go` after Hub.Run():

```go
go hub.Run()
handlers.StartNotificationRelay(ctx, rdb, hub)
```

### 5.4 New WSMessage Types

| Type                   | Direction   | Description                        |
|------------------------|-------------|------------------------------------|
| `notification`         | server→client | New notification for this user    |
| `notification.read`    | server→client | Notification marked read (sync across tabs) |
| `notification.count`   | server→client | Updated unread count              |

---

## 6. Dashboard UI

### 6.1 NotificationBell Component

**File:** `dashboard/src/components/notification-bell.tsx`

Client component in the top-nav header. Shows unread count badge.

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { NotificationCenter } from "./notification-center";

interface NotificationBellProps {
  wsUrl: string;
}

export function NotificationBell({ wsUrl }: NotificationBellProps): React.ReactElement {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch initial unread count
  useEffect(() => {
    fetch("/api/v1/identity/notifications/unread-count")
      .then((res) => res.json())
      .then((data) => setUnreadCount(data.count))
      .catch(() => {});
  }, []);

  // Listen for real-time notifications
  const handleMessage = useCallback((msg: { type: string }) => {
    if (msg.type === "notification") {
      setUnreadCount((prev) => prev + 1);
    }
    if (msg.type === "notification.count") {
      // sync count from server
    }
  }, []);

  useWebSocket({ url: wsUrl, onMessage: handleMessage });

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="hover:text-violet-300 transition-colors relative"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-bold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {isOpen && (
        <NotificationCenter
          onClose={() => setIsOpen(false)}
          onCountChange={setUnreadCount}
        />
      )}
    </div>
  );
}
```

### 6.2 NotificationCenter Component

**File:** `dashboard/src/components/notification-center.tsx`

Dropdown panel showing notification list with mark-as-read actions.

```tsx
"use client";

import { useState, useEffect } from "react";
import { Check, CheckCheck, X } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface NotificationCenterProps {
  onClose: () => void;
  onCountChange: (count: number) => void;
}

export function NotificationCenter({ onClose, onCountChange }: NotificationCenterProps): React.ReactElement {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/identity/notifications?page_size=20")
      .then((res) => res.json())
      .then((data) => {
        setNotifications(data.items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const markRead = async (id: string) => { /* PATCH .../notifications/{id}/read */ };
  const markAllRead = async () => { /* POST .../notifications/read-all */ };

  return (
    <div className="absolute right-0 top-full mt-2 w-96 max-h-[32rem] overflow-y-auto rounded-xl border border-white/10 bg-[var(--ds-surface-container)] shadow-xl z-50">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h3 className="text-sm font-semibold">Notifications</h3>
        <div className="flex items-center gap-2">
          <button onClick={markAllRead} title="Mark all read">
            <CheckCheck className="h-4 w-4" />
          </button>
          <button onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {/* Notification items */}
      <div className="divide-y divide-white/5">
        {notifications.map((n) => (
          <div key={n.id} className={`p-4 ${!n.is_read ? "bg-[var(--ds-primary-container)]/5" : ""}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="text-xs text-text-muted mt-1">{n.body}</p>}
                <p className="text-[10px] text-text-muted mt-1">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
              {!n.is_read && (
                <button onClick={() => markRead(n.id)} title="Mark read">
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 6.3 Notification Preferences Page

**File:** `dashboard/src/app/(dashboard)/settings/notifications/page.tsx`

Server component that fetches preferences and renders toggle switches for each notification type.

### 6.4 Integration into TopNav

Replace the static `<Bell>` button in `dashboard/src/components/top-nav.tsx` with the `<NotificationBell>` component.

---

## 7. CLI Commands

### 7.1 New Subcommand Group

**File:** `cli/src/orion_cli/commands/notifications.py`

```python
"""Notification commands."""

from __future__ import annotations

import asyncio
from typing import Annotated

import typer

from orion_cli.commands import get_client
from orion_cli.output import OutputFormat, print_output

app = typer.Typer()


@app.command("list")
def list_notifications(
    unread: Annotated[bool, typer.Option("--unread", help="Show only unread")] = False,
    page: Annotated[int, typer.Option(help="Page number")] = 1,
    token: Annotated[str | None, typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """List notifications."""
    client = get_client(token)
    params = {"page": page, "page_size": 20}
    if unread:
        params["unread"] = "true"
    data = asyncio.run(client.get("/api/v1/identity/notifications", params=params))
    items = data.get("items", [])
    print_output(items, fmt=fmt, title="Notifications")


@app.command("read")
def mark_read(
    notification_id: Annotated[str, typer.Argument(help="Notification ID")],
    token: Annotated[str | None, typer.Option(help="JWT token")] = None,
) -> None:
    """Mark a notification as read."""
    client = get_client(token)
    asyncio.run(client.patch(f"/api/v1/identity/notifications/{notification_id}/read"))
    typer.echo("Marked as read.")


@app.command("read-all")
def mark_all_read(
    token: Annotated[str | None, typer.Option(help="JWT token")] = None,
) -> None:
    """Mark all notifications as read."""
    client = get_client(token)
    result = asyncio.run(client.post("/api/v1/identity/notifications/read-all"))
    typer.echo(f"Marked {result.get('marked', 0)} notifications as read.")


@app.command("count")
def unread_count(
    token: Annotated[str | None, typer.Option(help="JWT token")] = None,
) -> None:
    """Show unread notification count."""
    client = get_client(token)
    data = asyncio.run(client.get("/api/v1/identity/notifications/unread-count"))
    typer.echo(f"Unread: {data['count']}")
```

### 7.2 Register in CLI Main

Add to the CLI app entrypoint (likely `cli/src/orion_cli/main.py`):

```python
from orion_cli.commands.notifications import app as notifications_app
app.add_typer(notifications_app, name="notifications")
```

### 7.3 Add `patch` Method to GatewayClient

The client currently lacks a `patch` method. Add:

```python
async def patch(self, path: str, **kwargs: Any) -> dict[str, Any]:
    return await self._request("PATCH", path, **kwargs)
```

---

## 8. File Manifest

### 8.1 New Files

| File | Description |
|------|-------------|
| `migrations/versions/011_add_notifications_table.py` | Alembic migration for notifications table |
| `services/identity/src/identity/schemas/notifications.py` | Pydantic schemas for notification API |
| `services/identity/src/identity/repositories/notification_repo.py` | Notification database repository |
| `services/identity/src/identity/services/notification_service.py` | Notification business logic + Redis push |
| `services/identity/src/identity/services/notification_consumer.py` | Background event listener that creates notifications |
| `services/identity/src/identity/routes/notifications.py` | FastAPI notification endpoints |
| `services/identity/src/identity/schemas/__init__.py` | Package init for schemas |
| `internal/gateway/handlers/notification_relay.go` | Redis→WebSocket relay for notifications |
| `dashboard/src/components/notification-bell.tsx` | Bell icon with unread badge |
| `dashboard/src/components/notification-center.tsx` | Notification dropdown panel |
| `dashboard/src/app/(dashboard)/settings/notifications/page.tsx` | Notification preferences page |
| `cli/src/orion_cli/commands/notifications.py` | CLI notification commands |

### 8.2 Modified Files

| File | Change |
|------|--------|
| `libs/orion-common/orion_common/db/models.py` | Add `Notification` model, add `notifications` relationship to `User` |
| `libs/orion-common/orion_common/events.py` | Add `NOTIFICATION_CREATED` channel constant |
| `pkg/events/channels.go` | Add `NotificationCreated` channel constant |
| `internal/gateway/handlers/websocket.go` | Per-user connection tracking (Hub struct, Run loop, HandleWebSocket) |
| `internal/gateway/router/router.go` | No changes needed (notifications are proxied via existing `/api/v1/identity/*` route) |
| `cmd/gateway/main.go` | Start `NotificationRelay` goroutine |
| `services/identity/src/identity/main.py` | Add Redis client, start notification consumer task, register notification routes |
| `dashboard/src/components/top-nav.tsx` | Replace static Bell button with `<NotificationBell>` |
| `cli/src/orion_cli/main.py` | Register notifications subcommand |
| `cli/src/orion_cli/client.py` | Add `patch()` method |

### 8.3 Test Files (to be created by test agent)

| File | Description |
|------|-------------|
| `services/identity/tests/test_notification_repo.py` | Repository unit tests |
| `services/identity/tests/test_notification_service.py` | Service layer tests |
| `services/identity/tests/test_notification_routes.py` | API endpoint tests |
| `services/identity/tests/test_notification_consumer.py` | Consumer event mapping tests |
| `internal/gateway/handlers/websocket_test.go` | Updated tests for per-user Hub |
| `internal/gateway/handlers/notification_relay_test.go` | Relay unit tests |
| `cli/tests/unit/test_notifications.py` | CLI command tests |
| `dashboard/__tests__/components/notification-bell.test.tsx` | Bell component test |
| `dashboard/__tests__/components/notification-center.test.tsx` | Center component test |

---

## 9. Data Flow Summary

```
Domain Event (e.g. orion.content.published)
    ↓ Redis pub/sub
Identity Service: notification_consumer
    ↓ checks user preferences
    ↓ creates Notification row in PostgreSQL
    ↓ publishes to orion.notification.created (Redis)
    ↓
Gateway: notification_relay.go
    ↓ subscribes to orion.notification.created
    ↓ looks up user_id → WebSocket connections
    ↓ sends WSMessage{type: "notification", payload: ...}
    ↓
Dashboard: useWebSocket hook receives message
    ↓ NotificationBell increments badge count
    ↓ NotificationCenter shows new item

CLI: polls via REST API
    ↓ orion notifications list --unread
    ↓ orion notifications count
```

---

## 10. Implementation Order

1. **Database:** Migration + ORM model (shared lib)
2. **Event channels:** Add `NOTIFICATION_CREATED` to Python + Go constants
3. **Identity service:** Repository → Service → Routes → Consumer
4. **Gateway WebSocket:** Per-user Hub → Notification relay
5. **Dashboard:** NotificationBell → NotificationCenter → Preferences page
6. **CLI:** Commands + client patch method
7. **Tests:** All layers
8. **Documentation:** API docs, architecture diagram update
