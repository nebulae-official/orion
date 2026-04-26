# Orion Database Documentation

PostgreSQL 17 with SQLAlchemy 2.0 async ORM. Migrations managed by Alembic.

---

## Table of Contents

- [Schema Reference](#schema-reference)
  - [User and Auth Tables](#user-and-auth-tables)
  - [Content Pipeline Tables](#content-pipeline-tables)
  - [Analytics Tables](#analytics-tables)
- [Enum Types](#enum-types)
- [Entity Relationship Diagram](#entity-relationship-diagram)
- [Migration Guide](#migration-guide)
  - [Migration History](#migration-history)
  - [Common Commands](#common-commands)
  - [Writing Migrations](#writing-migrations)
- [Port Map](#port-map)
- [Connection Details](#connection-details)

---

## Schema Reference

### User and Auth Tables

#### `users`

Core user table for the Orion platform.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `UUID` | NO | `uuid4()` | **PK** |
| `email` | `VARCHAR(512)` | NO | | UNIQUE |
| `username` | `VARCHAR(30)` | YES | | UNIQUE |
| `password_hash` | `TEXT` | YES | | |
| `name` | `VARCHAR(256)` | NO | | |
| `first_name` | `VARCHAR(128)` | YES | | |
| `last_name` | `VARCHAR(128)` | YES | | |
| `avatar_url` | `TEXT` | YES | | |
| `bio` | `TEXT` | YES | | |
| `timezone` | `VARCHAR(64)` | NO | `'UTC'` | |
| `role` | `VARCHAR(32)` | NO | `'viewer'` | |
| `email_verified` | `BOOLEAN` | NO | `false` | |
| `is_active` | `BOOLEAN` | NO | `true` | |
| `last_login_at` | `TIMESTAMPTZ` | YES | | |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | Auto-updated on change |

**Indexes:** `ix_users_username` (unique)

**Relationships:** Has many `oauth_accounts`, `refresh_tokens`, `contents`, `social_accounts`, `notifications`. Has one `user_settings`.

**Seeded users:**
- System user: `00000000-0000-0000-0000-000000000001`
- Admin user: `00000000-0000-0000-0000-000000000002` (from `ADMIN_EMAIL` / `ADMIN_NAME` env vars)

---

#### `oauth_accounts`

OAuth provider accounts linked to a user (GitHub, Google).

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `UUID` | NO | `uuid4()` | **PK** |
| `user_id` | `UUID` | NO | | **FK** `users.id` ON DELETE CASCADE |
| `provider` | `VARCHAR(32)` | NO | | |
| `provider_user_id` | `VARCHAR(256)` | NO | | |
| `provider_email` | `VARCHAR(512)` | YES | | |
| `access_token` | `TEXT` | YES | | |
| `refresh_token` | `TEXT` | YES | | |
| `token_expires_at` | `TIMESTAMPTZ` | YES | | |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | Auto-updated on change |

**Constraints:** `uq_oauth_provider_user` UNIQUE(`provider`, `provider_user_id`)

---

#### `user_settings`

Per-user preferences stored as JSON. Also holds notification preferences.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `UUID` | NO | `uuid4()` | **PK** |
| `user_id` | `UUID` | NO | | **FK** `users.id` ON DELETE CASCADE, UNIQUE |
| `settings` | `JSON` | NO | `'{}'` | |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | Auto-updated on change |

---

#### `refresh_tokens`

Server-side opaque refresh tokens (30-day lifetime).

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `UUID` | NO | `uuid4()` | **PK** |
| `user_id` | `UUID` | NO | | **FK** `users.id` ON DELETE CASCADE |
| `token_hash` | `VARCHAR(512)` | NO | | UNIQUE |
| `expires_at` | `TIMESTAMPTZ` | NO | | |
| `revoked` | `BOOLEAN` | NO | `false` | |
| `revoked_at` | `TIMESTAMPTZ` | YES | | |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | |

---

#### `notifications`

Per-user notifications pushed via WebSocket and polled via REST.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | **PK** |
| `user_id` | `UUID` | NO | | **FK** `users.id` ON DELETE CASCADE |
| `type` | `VARCHAR(64)` | NO | | |
| `title` | `VARCHAR(512)` | NO | | |
| `body` | `TEXT` | YES | | |
| `metadata` | `JSON` | YES | | |
| `is_read` | `BOOLEAN` | NO | `false` | |
| `read_at` | `TIMESTAMPTZ` | YES | | |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | |

**Indexes:**
- `ix_notifications_user_id` on `user_id`
- `ix_notifications_user_unread` partial index on `user_id` WHERE `is_read = false`
- `ix_notifications_user_created` on `(user_id, created_at DESC)`

**Notification types:** `trend.detected`, `content.published`, `content.rejected`, `media.failed`, `pipeline.stage_changed`, `content.created`

---

### Content Pipeline Tables

#### `trends`

Detected content trends from social platforms and news sources.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `UUID` | NO | `uuid4()` | **PK** |
| `topic` | `VARCHAR(512)` | NO | | |
| `source` | `VARCHAR(256)` | NO | | |
| `score` | `FLOAT` | NO | `0` | |
| `raw_data` | `JSON` | YES | | |
| `detected_at` | `TIMESTAMPTZ` | NO | `now()` | |
| `expired_at` | `TIMESTAMPTZ` | YES | | |
| `status` | `trend_status` | NO | `'active'` | |

**Indexes:** `ix_trends_topic` on `topic`

**Relationships:** Has many `contents`

---

#### `contents`

Content pieces generated from trends (scripts, visual prompts, hooks).

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `UUID` | NO | `uuid4()` | **PK** |
| `trend_id` | `UUID` | NO | | **FK** `trends.id` |
| `title` | `VARCHAR(512)` | NO | | |
| `script_body` | `TEXT` | YES | | |
| `hook` | `VARCHAR(1024)` | YES | | |
| `visual_prompts` | `JSON` | YES | | |
| `status` | `content_status` | NO | `'draft'` | |
| `created_by` | `UUID` | NO | | **FK** `users.id` |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | Auto-updated on change |

**Indexes:**
- `ix_contents_created_at` on `created_at`
- `ix_contents_status` on `status`
- `ix_contents_trend_id` on `trend_id`
- Index on `created_by`

**Relationships:** Belongs to `trends`, `users`. Has many `media_assets`, `pipeline_runs`, `publish_records`.

---

#### `media_assets`

Media files (images, videos, audio) linked to content.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `UUID` | NO | `uuid4()` | **PK** |
| `content_id` | `UUID` | NO | | **FK** `contents.id` |
| `asset_type` | `asset_type` | NO | | |
| `provider` | `VARCHAR(256)` | NO | | |
| `file_path` | `VARCHAR(1024)` | NO | | |
| `metadata` | `JSON` | YES | | |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | |

---

#### `providers`

External AI/content provider configurations.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `UUID` | NO | `uuid4()` | **PK** |
| `name` | `VARCHAR(256)` | NO | | UNIQUE |
| `provider_type` | `VARCHAR(128)` | NO | | |
| `config` | `JSON` | YES | | |
| `is_active` | `BOOLEAN` | NO | `true` | |
| `priority` | `INTEGER` | NO | `0` | |

---

#### `pipeline_runs`

Tracks execution of each pipeline stage for a content piece.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `UUID` | NO | `uuid4()` | **PK** |
| `content_id` | `UUID` | NO | | **FK** `contents.id` |
| `stage` | `VARCHAR(128)` | NO | | |
| `status` | `pipeline_status` | NO | `'pending'` | |
| `started_at` | `TIMESTAMPTZ` | YES | | |
| `completed_at` | `TIMESTAMPTZ` | YES | | |
| `error_message` | `TEXT` | YES | | |

**Indexes:**
- `ix_pipeline_runs_content_id` on `content_id`
- `ix_pipeline_runs_status` on `status`

---

#### `social_accounts`

Connected social media accounts for publishing.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `UUID` | NO | `uuid4()` | **PK** |
| `platform` | `VARCHAR(128)` | NO | | |
| `display_name` | `VARCHAR(256)` | NO | | |
| `credentials` | `TEXT` | NO | | Encrypted at rest |
| `is_active` | `BOOLEAN` | NO | `true` | |
| `user_id` | `UUID` | NO | | **FK** `users.id` |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | |

**Indexes:** Index on `user_id`

**Relationships:** Belongs to `users`. Has many `publish_records`.

---

#### `publish_records`

Records of content publish attempts to social platforms.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `UUID` | NO | `uuid4()` | **PK** |
| `content_id` | `UUID` | NO | | **FK** `contents.id` |
| `social_account_id` | `UUID` | YES | | **FK** `social_accounts.id` |
| `platform` | `VARCHAR(128)` | NO | | |
| `platform_post_id` | `VARCHAR(512)` | YES | | |
| `status` | `publish_status` | NO | `'failed'` | |
| `error_message` | `TEXT` | YES | | |
| `published_at` | `TIMESTAMPTZ` | YES | | |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | |

---

### Analytics Tables

These tables are defined in the Pulse service (`services/pulse/src/repositories/`), not in the shared `orion-common` models. They are auto-created by the Pulse service on startup.

#### `analytics_events`

Raw analytics events ingested from Redis pub/sub channels.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `UUID` | NO | `uuid4()` | **PK** |
| `channel` | `VARCHAR(256)` | NO | | |
| `payload` | `JSON` | NO | `'{}'` | |
| `service` | `VARCHAR(128)` | NO | | |
| `timestamp` | `TIMESTAMPTZ` | NO | `now()` | |

**Indexes:** Index on `channel`, index on `service`

---

#### `provider_costs`

Cost records for AI provider usage (LLM, image generation, TTS).

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `UUID` | NO | `uuid4()` | **PK** |
| `provider` | `VARCHAR(256)` | NO | | |
| `category` | `VARCHAR(128)` | NO | | |
| `amount` | `FLOAT` | NO | `0.0` | |
| `units` | `FLOAT` | NO | `0.0` | |
| `metadata` | `JSON` | YES | | |
| `recorded_at` | `TIMESTAMPTZ` | NO | `now()` | |

**Indexes:** Index on `provider`, index on `category`

---

## Enum Types

| Enum Name | Values |
|-----------|--------|
| `trend_status` | `active`, `used`, `discarded`, `expired` |
| `content_status` | `draft`, `generating`, `review`, `approved`, `published`, `rejected` |
| `asset_type` | `image`, `video`, `audio` |
| `pipeline_status` | `pending`, `running`, `completed`, `failed` |
| `publish_status` | `published`, `failed` |
| `userrole` | `admin`, `editor`, `viewer` |

---

## Entity Relationship Diagram

```
users
 ├──< oauth_accounts        (user_id FK, CASCADE)
 ├──< refresh_tokens         (user_id FK, CASCADE)
 ├──1 user_settings           (user_id FK, CASCADE, UNIQUE)
 ├──< notifications          (user_id FK, CASCADE)
 ├──< contents               (created_by FK)
 └──< social_accounts        (user_id FK)
         └──< publish_records (social_account_id FK)

trends
 └──< contents               (trend_id FK)
         ├──< media_assets    (content_id FK)
         ├──< pipeline_runs   (content_id FK)
         └──< publish_records (content_id FK)

providers                     (standalone, no FKs)
analytics_events              (standalone, no FKs)
provider_costs                (standalone, no FKs)
```

---

## Migration Guide

### Migration History

| # | Revision | Description | Date |
|---|----------|-------------|------|
| 1 | `001` | Initial schema: `trends`, `contents`, `media_assets`, `providers`, `pipeline_runs` | 2026-03-11 |
| 2 | `002` | Add publisher tables: `social_accounts`, `publish_records` | 2026-03-13 |
| 3 | `003` | Add indexes on `contents.created_at`, `trends.topic` | 2026-03-13 |
| 4 | `004` | Add performance indexes on `contents.status`, `contents.trend_id`, `pipeline_runs.content_id`, `pipeline_runs.status` | 2026-03-13 |
| 5 | `005` | Add user tables: `users`, `oauth_accounts`, `user_settings`, `refresh_tokens`. Seed system and admin users | 2026-03-19 |
| 6 | `006` | Add `created_by` to `contents`, `user_id` to `social_accounts`. Backfill with system user | 2026-03-19 |
| 7 | `007` | Enforce NOT NULL on `contents.created_by` and `social_accounts.user_id` | 2026-03-19 |
| 8 | `008` | Add `first_name` and `last_name` columns to `users` | 2026-03-19 |
| 9 | `009` | Update `trend_status` enum: add `used` and `discarded`, deprecate `archived` | 2026-03-19 |
| 10 | `010` | Add `username` column to `users` with unique index. Backfill from existing names | 2026-03-19 |
| 11 | `011` | Add `notifications` table with partial and composite indexes | 2026-03-20 |

### Common Commands

All commands should be run from the repository root.

```bash
# Apply all pending migrations
uv run alembic upgrade head

# Check current migration state
uv run alembic current

# Show migration history
uv run alembic history

# Roll back one migration
uv run alembic downgrade -1

# Roll back to a specific revision
uv run alembic downgrade 005

# Roll back all migrations
uv run alembic downgrade base
```

### Writing Migrations

```bash
# Auto-generate a migration from model changes
uv run alembic revision --autogenerate -m "add_foo_column_to_bar"

# Create an empty migration for manual SQL
uv run alembic revision -m "backfill_foo_data"
```

**Conventions:**
- File naming: `{NNN}_{description}.py` (zero-padded three-digit sequence)
- Always implement both `upgrade()` and `downgrade()`
- For enum changes, use `ALTER TYPE ... ADD VALUE` (PostgreSQL does not support dropping enum values)
- For data backfills, use `op.get_bind()` to execute raw SQL
- Test migrations against a fresh database: `uv run alembic downgrade base && uv run alembic upgrade head`

---

## Port Map

| Service | Port | Notes |
|---------|------|-------|
| PostgreSQL | `5432` | Bound to `127.0.0.1` in Docker Compose |
| pgAdmin | `5050` | Requires `--profile tools`. Default login: `admin@orion.dev` / `orion_dev` |
| Databasus backup | `4005` | Requires `--profile tools`. Web UI for database backups |

---

## Connection Details

### From Services (Docker network)

Services connect via the `DATABASE_URL` environment variable over the Docker `orion-net` network:

```
DATABASE_URL=postgresql+asyncpg://orion:orion@postgres:5432/orion
```

The hostname `postgres` resolves to the PostgreSQL container on the internal network.

### From Host Machine

When PostgreSQL port is exposed to localhost (development):

```
postgresql://orion:orion@localhost:5432/orion
```

### From pgAdmin

pgAdmin is pre-configured via `deploy/pgadmin-servers.json`. Access it at `http://localhost:5050` after starting with the tools profile:

```bash
make up                          # or docker compose up
docker compose --profile tools up  # starts pgAdmin + Databasus
```

Default pgAdmin credentials (configurable via env vars):
- Email: `PGADMIN_EMAIL` (default: `admin@orion.dev`)
- Password: `PGADMIN_PASSWORD` (default: `orion_dev`)

### From CLI Tools

```bash
# psql (requires PostgreSQL client)
psql postgresql://orion:orion@localhost:5432/orion

# Using the Orion CLI (connects through the gateway)
orion system db-status
```

### Environment Variables

Set these in your `.env` file (see `.env.example`):

```bash
DATABASE_URL=postgresql+asyncpg://orion:YOUR_PASSWORD@postgres:5432/orion
PGADMIN_EMAIL=admin@orion.dev
PGADMIN_PASSWORD=orion_dev
```
