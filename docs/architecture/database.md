# :lucide-database: Database

Orion uses **PostgreSQL 17** as its primary relational store, managed through **SQLAlchemy 2.0** async sessions and **Alembic** migrations. All services share a single database instance.

!!! info "Single shared database"
    All microservices connect to the same PostgreSQL instance. Table ownership is defined by convention -- each service reads/writes only its own domain tables. See the [schema design doc](db-schema-design.md) for the rationale behind this decision.

---

## :lucide-layout-grid: Schema Overview

The database contains **11 tables** organized into three domains: **User & Auth**, **Content Pipeline**, and **Publishing**.

```mermaid
erDiagram
    users ||--o{ oauth_accounts : "has"
    users ||--o{ refresh_tokens : "has"
    users ||--o| user_settings : "has"
    users ||--o{ contents : "creates"
    users ||--o{ social_accounts : "connects"

    trends ||--o{ contents : "generates"
    contents ||--o{ media_assets : "has"
    contents ||--o{ pipeline_runs : "tracks"
    contents ||--o{ publish_records : "published_to"
    social_accounts ||--o{ publish_records : "uses"

    users {
        uuid id PK
        varchar email UK
        text password_hash "nullable — OAuth-only users"
        varchar name
        text avatar_url
        text bio
        varchar timezone "default: UTC"
        varchar role "admin / editor / viewer"
        boolean email_verified
        boolean is_active
        timestamptz last_login_at
        timestamptz created_at
        timestamptz updated_at
    }

    oauth_accounts {
        uuid id PK
        uuid user_id FK "CASCADE"
        varchar provider "github / google"
        varchar provider_user_id
        varchar provider_email
        text access_token "encrypted"
        text refresh_token "encrypted"
        timestamptz token_expires_at
        timestamptz created_at
        timestamptz updated_at
    }

    refresh_tokens {
        uuid id PK
        uuid user_id FK "CASCADE"
        varchar token_hash UK "SHA-256, never raw"
        timestamptz expires_at
        boolean revoked "soft delete"
        timestamptz revoked_at
        timestamptz created_at
    }

    user_settings {
        uuid id PK
        uuid user_id FK_UK "CASCADE, one per user"
        json settings "JSONB preferences"
        timestamptz created_at
        timestamptz updated_at
    }

    trends {
        uuid id PK
        varchar topic
        varchar source
        float score
        json raw_data
        timestamptz detected_at
        timestamptz expired_at
        enum status "active / expired / archived"
    }

    contents {
        uuid id PK
        uuid trend_id FK
        uuid created_by FK "users.id"
        varchar title
        text script_body
        varchar hook
        json visual_prompts
        enum status "draft / generating / review / approved / published / rejected"
        timestamptz created_at
        timestamptz updated_at
    }

    media_assets {
        uuid id PK
        uuid content_id FK
        enum asset_type "image / video / audio"
        varchar provider
        varchar file_path
        json metadata
        timestamptz created_at
    }

    providers {
        uuid id PK
        varchar name UK
        varchar provider_type
        json config
        boolean is_active
        integer priority
    }

    pipeline_runs {
        uuid id PK
        uuid content_id FK
        varchar stage
        enum status "pending / running / completed / failed"
        timestamptz started_at
        timestamptz completed_at
        text error_message
    }

    social_accounts {
        uuid id PK
        uuid user_id FK "users.id"
        varchar platform
        varchar display_name
        text credentials "encrypted"
        boolean is_active
        timestamptz created_at
    }

    publish_records {
        uuid id PK
        uuid content_id FK
        uuid social_account_id FK "nullable"
        varchar platform
        varchar platform_post_id
        enum status "published / failed"
        text error_message
        timestamptz published_at
        timestamptz created_at
    }
```

---

## :lucide-table: Table Reference

### User & Auth Domain

#### `users`

Central identity table. Supports both password-based and OAuth-only accounts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK, default `gen_random_uuid()` | Primary key |
| `email` | `VARCHAR(512)` | UNIQUE, NOT NULL | Login identifier |
| `password_hash` | `TEXT` | nullable | bcrypt hash; NULL for OAuth-only users |
| `name` | `VARCHAR(256)` | NOT NULL | Display name |
| `avatar_url` | `TEXT` | nullable | Profile image URL |
| `bio` | `TEXT` | nullable | User biography |
| `timezone` | `VARCHAR(64)` | NOT NULL, default `'UTC'` | IANA timezone |
| `role` | `VARCHAR(32)` | NOT NULL, default `'viewer'` | `admin`, `editor`, or `viewer` |
| `email_verified` | `BOOLEAN` | NOT NULL, default `false` | Email verification status |
| `is_active` | `BOOLEAN` | NOT NULL, default `true` | Account active flag |
| `last_login_at` | `TIMESTAMPTZ` | nullable | Last successful login |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` | Row creation time |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` | Last modification time |

#### `oauth_accounts`

Links external identity providers (GitHub, Google) to local users. One user can have multiple providers.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK | Primary key |
| `user_id` | `UUID` | FK `users.id` CASCADE, NOT NULL | Owning user |
| `provider` | `VARCHAR(32)` | NOT NULL | Provider name (`github`, `google`) |
| `provider_user_id` | `VARCHAR(256)` | NOT NULL | External user ID |
| `provider_email` | `VARCHAR(512)` | nullable | Email from provider |
| `access_token` | `TEXT` | nullable | Encrypted OAuth access token |
| `refresh_token` | `TEXT` | nullable | Encrypted OAuth refresh token |
| `token_expires_at` | `TIMESTAMPTZ` | nullable | Token expiration |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` | Row creation time |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` | Last modification time |

**Constraints:** `UNIQUE(provider, provider_user_id)` as `uq_oauth_provider_user`

#### `user_settings`

Per-user preferences stored as a JSONB column. One row per user (enforced by unique constraint on `user_id`).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK | Primary key |
| `user_id` | `UUID` | FK `users.id` CASCADE, UNIQUE, NOT NULL | Owning user |
| `settings` | `JSON` | NOT NULL, default `'{}'` | JSONB preferences blob |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` | Row creation time |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` | Last modification time |

#### `refresh_tokens`

Server-side refresh tokens. Only the SHA-256 hash is stored; the raw token stays with the client.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK | Primary key |
| `user_id` | `UUID` | FK `users.id` CASCADE, NOT NULL | Owning user |
| `token_hash` | `VARCHAR(512)` | UNIQUE, NOT NULL | SHA-256 hash of token |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | Token expiration |
| `revoked` | `BOOLEAN` | NOT NULL, default `false` | Soft-delete flag |
| `revoked_at` | `TIMESTAMPTZ` | nullable | When the token was revoked |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` | Row creation time |

### Content Pipeline Domain

#### `trends`

Detected content trends from external sources (Google Trends, RSS feeds, etc.).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK | Primary key |
| `topic` | `VARCHAR(512)` | NOT NULL | Trend topic text |
| `source` | `VARCHAR(256)` | NOT NULL | Source identifier (`google`, `rss`) |
| `score` | `FLOAT` | NOT NULL, default `0` | Relevance score (0.0 to 1.0) |
| `raw_data` | `JSON` | nullable | Raw response from source API |
| `detected_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` | When the trend was detected |
| `expired_at` | `TIMESTAMPTZ` | nullable | When the trend expired |
| `status` | `ENUM trend_status` | NOT NULL, default `'active'` | `active`, `expired`, `archived` |

#### `contents`

Content pieces generated from trends through the LangGraph pipeline.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK | Primary key |
| `trend_id` | `UUID` | FK `trends.id`, NOT NULL | Source trend |
| `created_by` | `UUID` | FK `users.id`, NOT NULL, indexed | User who initiated generation |
| `title` | `VARCHAR(512)` | NOT NULL | Content title |
| `script_body` | `TEXT` | nullable | Generated script text |
| `hook` | `VARCHAR(1024)` | nullable | Opening hook line |
| `visual_prompts` | `JSON` | nullable | Image generation prompts |
| `status` | `ENUM content_status` | NOT NULL, default `'draft'` | Lifecycle status |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` | Row creation time |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` | Last modification time |

#### `media_assets`

Generated media files (images, videos, audio) linked to content pieces.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK | Primary key |
| `content_id` | `UUID` | FK `contents.id`, NOT NULL | Parent content |
| `asset_type` | `ENUM asset_type` | NOT NULL | `image`, `video`, `audio` |
| `provider` | `VARCHAR(256)` | NOT NULL | Provider that generated the asset |
| `file_path` | `VARCHAR(1024)` | NOT NULL | Path to the asset file |
| `metadata` | `JSON` | nullable | Asset metadata (dimensions, duration, etc.) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` | Row creation time |

#### `providers`

Global AI provider configurations. Not user-scoped -- per-user preferences go in `user_settings`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK | Primary key |
| `name` | `VARCHAR(256)` | UNIQUE, NOT NULL | Provider name |
| `provider_type` | `VARCHAR(128)` | NOT NULL | Provider category (`llm`, `image`, `tts`) |
| `config` | `JSON` | nullable | Provider-specific configuration |
| `is_active` | `BOOLEAN` | NOT NULL, default `true` | Whether the provider is enabled |
| `priority` | `INTEGER` | NOT NULL, default `0` | Selection priority (higher = preferred) |

#### `pipeline_runs`

Tracks execution of pipeline stages for each content piece.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK | Primary key |
| `content_id` | `UUID` | FK `contents.id`, NOT NULL | Parent content |
| `stage` | `VARCHAR(128)` | NOT NULL | Pipeline stage name |
| `status` | `ENUM pipeline_status` | NOT NULL, default `'pending'` | `pending`, `running`, `completed`, `failed` |
| `started_at` | `TIMESTAMPTZ` | nullable | Stage start time |
| `completed_at` | `TIMESTAMPTZ` | nullable | Stage completion time |
| `error_message` | `TEXT` | nullable | Error details on failure |

### Publishing Domain

#### `social_accounts`

Connected social media accounts for content publishing.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK | Primary key |
| `user_id` | `UUID` | FK `users.id`, NOT NULL, indexed | Owning user |
| `platform` | `VARCHAR(128)` | NOT NULL | Platform name (`youtube`, `tiktok`, `twitter`) |
| `display_name` | `VARCHAR(256)` | NOT NULL | Account display name |
| `credentials` | `TEXT` | NOT NULL | Encrypted platform credentials |
| `is_active` | `BOOLEAN` | NOT NULL, default `true` | Whether the account is active |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` | Row creation time |

#### `publish_records`

Audit trail of content publish attempts to social platforms.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK | Primary key |
| `content_id` | `UUID` | FK `contents.id`, NOT NULL | Published content |
| `social_account_id` | `UUID` | FK `social_accounts.id`, nullable | Account used for publishing |
| `platform` | `VARCHAR(128)` | NOT NULL | Target platform |
| `platform_post_id` | `VARCHAR(512)` | nullable | External post ID on the platform |
| `status` | `ENUM publish_status` | NOT NULL, default `'failed'` | `published`, `failed` |
| `error_message` | `TEXT` | nullable | Error details on failure |
| `published_at` | `TIMESTAMPTZ` | nullable | When the content was published |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` | Row creation time |

---

## :lucide-git-branch: Status Enums

### `trend_status`

| Value | Description |
|-------|-------------|
| `active` | Currently trending, eligible for content generation |
| `expired` | No longer trending |
| `archived` | Manually archived by a user |

### `content_status`

| Value | Description |
|-------|-------------|
| `draft` | Initial state after creation |
| `generating` | Pipeline is actively running |
| `review` | Awaiting human approval |
| `approved` | Approved for publishing |
| `published` | Successfully published to platforms |
| `rejected` | Rejected by reviewer |

### `asset_type`

`image`, `video`, `audio`

### `pipeline_status`

`pending`, `running`, `completed`, `failed`

### `publish_status`

`published`, `failed`

---

## :lucide-list-ordered: Index Reference

### Primary & Unique Indexes

| Index | Table | Column(s) | Type |
|-------|-------|-----------|------|
| PK | `users` | `id` | Primary Key |
| `users_email_key` | `users` | `email` | Unique |
| PK | `oauth_accounts` | `id` | Primary Key |
| `uq_oauth_provider_user` | `oauth_accounts` | `(provider, provider_user_id)` | Unique |
| PK | `user_settings` | `id` | Primary Key |
| `user_settings_user_id_key` | `user_settings` | `user_id` | Unique |
| PK | `refresh_tokens` | `id` | Primary Key |
| `refresh_tokens_token_hash_key` | `refresh_tokens` | `token_hash` | Unique |
| PK | `providers` | `id` | Primary Key |
| `providers_name_key` | `providers` | `name` | Unique |

### Secondary Indexes

| Index | Table | Column(s) | Rationale |
|-------|-------|-----------|-----------|
| `ix_users_role` | `users` | `role` | Admin panel user filtering |
| `ix_users_is_active` | `users` | `is_active` | Filter inactive users |
| `ix_oauth_accounts_user_id` | `oauth_accounts` | `user_id` | List linked OAuth accounts |
| `ix_refresh_tokens_user_id` | `refresh_tokens` | `user_id` | List active sessions |
| `ix_refresh_tokens_expires_at` | `refresh_tokens` | `expires_at` | Cleanup expired tokens |
| `ix_trends_status` | `trends` | `status` | Filter trends by lifecycle |
| `ix_trends_detected_at` | `trends` | `detected_at` | Time-range queries |
| `ix_trends_topic` | `trends` | `topic` | Topic search |
| `ix_contents_status` | `contents` | `status` | Filter by content lifecycle |
| `ix_contents_trend_id` | `contents` | `trend_id` | Find content for a trend |
| `ix_contents_created_at` | `contents` | `created_at` | Time-range queries |
| `ix_contents_created_by` | `contents` | `created_by` | Filter content by user |
| `ix_media_assets_content_id` | `media_assets` | `content_id` | Find assets for content |
| `ix_pipeline_runs_content_id` | `pipeline_runs` | `content_id` | Find runs for content |
| `ix_pipeline_runs_status` | `pipeline_runs` | `status` | Filter by run status |
| `ix_social_accounts_platform` | `social_accounts` | `platform` | Filter by platform |
| `ix_social_accounts_user_id` | `social_accounts` | `user_id` | Filter accounts by user |
| `ix_publish_records_content_id` | `publish_records` | `content_id` | Find records for content |
| `ix_publish_records_social_account_id` | `publish_records` | `social_account_id` | Find records for account |
| `ix_publish_records_platform` | `publish_records` | `platform` | Filter by platform |

---

## :lucide-history: Migration History

Migrations are managed by Alembic and live in `migrations/versions/`. Each migration has an `upgrade()` and `downgrade()` function for safe rollbacks.

| Revision | Date | Description |
|----------|------|-------------|
| `001` | 2026-03-11 | Initial schema: `trends`, `contents`, `media_assets`, `providers`, `pipeline_runs` with base indexes |
| `002` | 2026-03-13 | Add publisher tables: `social_accounts`, `publish_records` with platform indexes |
| `003` | 2026-03-13 | Add performance indexes: `ix_contents_created_at`, `ix_trends_topic` |
| `004` | 2026-03-13 | Ensure indexes exist (idempotent `if_not_exists`): `ix_contents_status`, `ix_contents_trend_id`, `ix_pipeline_runs_content_id`, `ix_pipeline_runs_status` |
| `005` | 2026-03-19 | Add user management tables: `users`, `oauth_accounts`, `user_settings`, `refresh_tokens`. Seeds system user and admin user |
| `006` | 2026-03-19 | Add `created_by` FK to `contents` and `user_id` FK to `social_accounts`. Backfill existing rows with system user |
| `007` | 2026-03-19 | Enforce `NOT NULL` on `contents.created_by` and `social_accounts.user_id` after backfill |
| `008` | 2026-03-19 | Add `first_name` and `last_name` columns to `users` table |
| `009` | 2026-03-20 | Update `trend_status` enum values |
| `010` | 2026-03-20 | Add `username` column to `users` table |

!!! tip "Running migrations"
    ```bash
    # Apply all pending migrations
    cd migrations && uv run alembic upgrade head

    # Check current revision
    cd migrations && uv run alembic current

    # Roll back one step
    cd migrations && uv run alembic downgrade -1
    ```

---

## :lucide-braces: JSONB Schema Documentation

### `user_settings.settings`

The `settings` column is a JSONB blob containing all per-user preferences. The schema is validated at the application layer by Pydantic models, not enforced by the database.

```json
{
  "provider_preferences": {
    "llm_provider": "openai",
    "image_provider": "comfyui",
    "tts_provider": "elevenlabs"
  },
  "pipeline_config": {
    "default_niche": "technology",
    "default_tone": "professional",
    "default_platform": "youtube_shorts",
    "visual_style": "modern"
  },
  "notification_preferences": {
    "email_on_publish": true,
    "email_on_failure": true,
    "webhook_url": null
  },
  "dashboard_preferences": {
    "theme": "dark",
    "default_view": "queue",
    "items_per_page": 25
  }
}
```

### `trends.raw_data`

Raw response from the trend source API. Structure varies by source.

### `contents.visual_prompts`

Array of image generation prompts for each scene in the content.

### `media_assets.metadata`

Asset-specific metadata (dimensions, duration, file size, generation parameters).

### `providers.config`

Provider-specific configuration (API keys, endpoints, model names, rate limits).

---

## :lucide-plug: Connection Configuration

Python services connect via async PostgreSQL using `asyncpg`:

```python
from orion_common.config import get_settings

settings = get_settings()

# Async URL (for SQLAlchemy async sessions)
settings.database_url
# postgresql+asyncpg://orion:orion_dev@localhost:5432/orion

# Sync URL (for Alembic migrations)
settings.database_url_sync
# postgresql://orion:orion_dev@localhost:5432/orion
```

!!! warning "Connection pooling"
    Each service maintains its own async connection pool. Default pool size is 5 connections per service, configurable via `DATABASE_POOL_SIZE` environment variable.

---

## :lucide-database-backup: Backup Strategy

### Automated Backups with Databasus

[Databasus](http://localhost:4005) provides a web UI for scheduling and managing PostgreSQL backups.

- **Port:** 4005 (Docker profile: `tools`)
- **Start:** `make up-tools`
- **Features:** Scheduled pg_dump, retention policies, S3/local storage, restore wizard

### Manual Backups

```bash
# Full database dump
pg_dump -h localhost -U orion -d orion -F c -f orion_backup.dump

# Restore from dump
pg_restore -h localhost -U orion -d orion -c orion_backup.dump

# Schema-only dump (for documentation)
pg_dump -h localhost -U orion -d orion --schema-only > schema.sql
```

---

## :lucide-monitor: pgAdmin Access

[pgAdmin 4](http://localhost:5050) provides a full-featured PostgreSQL management UI.

- **Port:** 5050 (Docker profile: `tools`)
- **Start:** `make up-tools`
- **Default credentials:** Configured via `PGADMIN_DEFAULT_EMAIL` and `PGADMIN_DEFAULT_PASSWORD` in `.env`

To connect to the Orion database in pgAdmin:

1. Open http://localhost:5050
2. Add New Server
3. **Connection tab:**
    - Host: `postgres` (Docker service name) or `localhost` (if accessing from host)
    - Port: `5432`
    - Database: `orion`
    - Username: `orion`
    - Password: from `POSTGRES_PASSWORD` in `.env`

---

## :lucide-layers: Vector Database (Milvus)

Milvus 2.4 stores embeddings for the Director's vector memory system:

- **Host:** `localhost:19530` (gRPC) / `localhost:9091` (HTTP)
- **Purpose:** Content similarity search, deduplication, context retrieval
- **Integration:** Director service uses Milvus for embedding-based lookups during content generation

---

## :lucide-file-code: ORM Models

All SQLAlchemy 2.0 models are defined in a single file shared across services:

```
libs/orion-common/orion_common/db/models.py
```

Models use the `Mapped` type annotation style (SQLAlchemy 2.0) with `mapped_column()` for column definitions. See the [schema design doc](db-schema-design.md) for architectural decisions and trade-offs.
