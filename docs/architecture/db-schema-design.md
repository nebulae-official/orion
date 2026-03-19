# Database Schema Design: User Management & Multi-Tenancy

**Status:** Proposed
**Date:** 2026-03-19
**Author:** Software Architect

---

## 1. Context & Motivation

Orion currently operates as a single-tenant system. Authentication is handled entirely
in the Go gateway via a single hardcoded admin user (configured through environment
variables `ORION_ADMIN_USER`, `ORION_ADMIN_PASS`, `ORION_ADMIN_EMAIL`). JWT tokens
are issued with claims for `username`, `email`, and `role`, but there is no `users`
table -- the admin identity exists only in gateway memory.

All data tables (`trends`, `contents`, `media_assets`, `pipeline_runs`,
`publish_records`, `social_accounts`) lack any user ownership column. This means:

- No support for multiple users with distinct roles
- No audit trail of who created or approved content
- No OAuth login (GitHub, Google)
- No ability to scope data by user for future multi-tenancy

This design introduces a `users` table and supporting auth tables, then retrofits
`user_id` ownership onto every existing data table.

### Design Constraints

- All models live in `libs/orion-common/orion_common/db/models.py` (shared across services)
- Single PostgreSQL 17 database shared by all services
- Migrations managed via Alembic at `migrations/versions/`
- Gateway (Go) issues JWTs; Python services trust the JWT claims forwarded by the gateway
- SQLAlchemy 2.0 async with `Mapped` type annotations

---

## 2. Current Schema (Baseline)

```
trends
  id              UUID PK
  topic           VARCHAR(512)
  source          VARCHAR(256)
  score           FLOAT
  raw_data        JSON
  detected_at     TIMESTAMPTZ
  expired_at      TIMESTAMPTZ
  status          ENUM(active, expired, archived)

contents
  id              UUID PK
  trend_id        UUID FK -> trends.id
  title           VARCHAR(512)
  script_body     TEXT
  hook            VARCHAR(1024)
  visual_prompts  JSON
  status          ENUM(draft, generating, review, approved, published, rejected)
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ

media_assets
  id              UUID PK
  content_id      UUID FK -> contents.id
  asset_type      ENUM(image, video, audio)
  provider        VARCHAR(256)
  file_path       VARCHAR(1024)
  metadata        JSON
  created_at      TIMESTAMPTZ

providers
  id              UUID PK
  name            VARCHAR(256) UNIQUE
  provider_type   VARCHAR(128)
  config          JSON
  is_active       BOOLEAN
  priority        INTEGER

pipeline_runs
  id              UUID PK
  content_id      UUID FK -> contents.id
  stage           VARCHAR(128)
  status          ENUM(pending, running, completed, failed)
  started_at      TIMESTAMPTZ
  completed_at    TIMESTAMPTZ
  error_message   TEXT

social_accounts
  id              UUID PK
  platform        VARCHAR(128)
  display_name    VARCHAR(256)
  credentials     TEXT (encrypted)
  is_active       BOOLEAN
  created_at      TIMESTAMPTZ

publish_records
  id              UUID PK
  content_id      UUID FK -> contents.id
  social_account_id UUID FK -> social_accounts.id (nullable)
  platform        VARCHAR(128)
  platform_post_id VARCHAR(512)
  status          ENUM(published, failed)
  error_message   TEXT
  published_at    TIMESTAMPTZ
  created_at      TIMESTAMPTZ
```

Existing migrations: `001` through `004` (initial schema, publisher tables, indexes).

---

## 3. New Tables

### 3.1 `users`

The central identity table. Supports both password-based and OAuth-only accounts.

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255),           -- NULL for OAuth-only users
    name            VARCHAR(255) NOT NULL,
    avatar_url      TEXT,
    bio             TEXT,
    timezone        VARCHAR(50) NOT NULL DEFAULT 'UTC',
    role            VARCHAR(20) NOT NULL DEFAULT 'editor',  -- admin, editor, viewer
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Design decisions:**

- `role` is a plain VARCHAR rather than a PostgreSQL ENUM so new roles can be added
  without a migration (trade-off: no DB-level validation, but application-layer
  Pydantic validation covers this).
- `password_hash` is nullable to support users who sign up exclusively through OAuth.
- `email` is the unique login identifier, not a username. Usernames introduce
  uniqueness headaches and are unnecessary for a team tool.

### 3.2 `oauth_accounts`

Links external identity providers to local users. One user can have multiple providers.

```sql
CREATE TABLE oauth_accounts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider          VARCHAR(20) NOT NULL,       -- 'github', 'google'
    provider_user_id  VARCHAR(255) NOT NULL,
    provider_email    VARCHAR(255),
    access_token      TEXT,                        -- encrypted at rest
    refresh_token     TEXT,                        -- encrypted at rest
    token_expires_at  TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider, provider_user_id)
);
```

**Design decisions:**

- Tokens stored encrypted using the same Fernet scheme already used for
  `social_accounts.credentials` in the Publisher service.
- `ON DELETE CASCADE` ensures orphaned OAuth records are cleaned up when a user
  is deleted.
- The composite unique constraint `(provider, provider_user_id)` prevents duplicate
  provider linkages.

### 3.3 `refresh_tokens`

Persistent refresh tokens stored server-side. The gateway currently uses only
short-lived JWTs with a Redis-based blacklist for revocation. Adding a `refresh_tokens`
table enables long-lived sessions without storing long-lived secrets in Redis.

```sql
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) UNIQUE NOT NULL,     -- SHA-256 hash, never store raw
    device_info VARCHAR(255),                      -- optional: user-agent or device name
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Design decisions:**

- Only the hash is stored, never the raw token. The client holds the raw token;
  lookup is by hash.
- `device_info` enables "active sessions" UI in the dashboard.
- Revocation is a soft-delete (`revoked = TRUE`) so audit history is preserved.

### 3.4 `user_settings`

Per-user preferences stored as JSONB. Using JSONB instead of many columns allows
the settings schema to evolve without migrations.

```sql
CREATE TABLE user_settings (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                   UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_preferences      JSONB NOT NULL DEFAULT '{}',
    pipeline_config           JSONB NOT NULL DEFAULT '{}',
    notification_preferences  JSONB NOT NULL DEFAULT '{}',
    dashboard_preferences     JSONB NOT NULL DEFAULT '{}',
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Design decisions:**

- One row per user (enforced by `UNIQUE` on `user_id`), not a key-value store.
  This keeps queries simple and avoids N+1 reads.
- JSONB columns are domain-bucketed so they can be independently validated by
  different Pydantic models without interfering with each other.
- `provider_preferences` stores per-user LLM/image provider overrides.
- `pipeline_config` stores default niche, tone, platform, visual style.
- `notification_preferences` stores email/webhook notification toggles.
- `dashboard_preferences` stores layout, theme, default filters.

### 3.5 `email_verification_tokens`

```sql
CREATE TABLE email_verification_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) UNIQUE NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.6 `password_reset_tokens`

```sql
CREATE TABLE password_reset_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) UNIQUE NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Shared design decisions for 3.5 and 3.6:**

- Token hash only (SHA-256), same pattern as `refresh_tokens`.
- `used` flag prevents replay; tokens are single-use.
- Short TTL enforced at application layer (verification: 24h, reset: 1h).
- No cleanup job needed immediately -- expired/used rows can be pruned by a
  periodic task later.

---

## 4. Existing Table Modifications

Every table that stores user-generated or user-scoped data needs a `user_id` column
to enable ownership, filtering, and future multi-tenancy.

### 4.1 `trends`

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | `UUID REFERENCES users(id)` | Which user triggered or owns the scan |

Trends can be system-generated (scheduled scans) or user-triggered (manual scans).
For system-generated trends, `user_id` will be set to a system user.

```sql
ALTER TABLE trends ADD COLUMN user_id UUID REFERENCES users(id);
CREATE INDEX ix_trends_user_id ON trends(user_id);
```

### 4.2 `contents`

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | `UUID REFERENCES users(id)` | Who initiated content generation |

```sql
ALTER TABLE contents ADD COLUMN user_id UUID REFERENCES users(id);
CREATE INDEX ix_contents_user_id ON contents(user_id);
```

### 4.3 `media_assets`

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | `UUID REFERENCES users(id)` | Inherited from parent content, denormalized for query performance |

```sql
ALTER TABLE media_assets ADD COLUMN user_id UUID REFERENCES users(id);
CREATE INDEX ix_media_assets_user_id ON media_assets(user_id);
```

**Trade-off:** Denormalizing `user_id` onto `media_assets` duplicates data that
could be derived via `contents.user_id`. The benefit is avoiding a JOIN when listing
a user's assets. The cost is maintaining consistency (handled by the service layer
when creating assets).

### 4.4 `social_accounts`

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | `UUID REFERENCES users(id)` | Which user connected this social account |

```sql
ALTER TABLE social_accounts ADD COLUMN user_id UUID REFERENCES users(id);
CREATE INDEX ix_social_accounts_user_id ON social_accounts(user_id);
```

### 4.5 `publish_records`

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | `UUID REFERENCES users(id)` | Who triggered the publish |

```sql
ALTER TABLE publish_records ADD COLUMN user_id UUID REFERENCES users(id);
CREATE INDEX ix_publish_records_user_id ON publish_records(user_id);
```

### 4.6 `pipeline_runs`

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | `UUID REFERENCES users(id)` | Inherited from parent content |

```sql
ALTER TABLE pipeline_runs ADD COLUMN user_id UUID REFERENCES users(id);
CREATE INDEX ix_pipeline_runs_user_id ON pipeline_runs(user_id);
```

### 4.7 `providers` -- NO CHANGE

The `providers` table stores global AI provider configuration, not user-specific
data. Per-user provider preferences go in `user_settings.provider_preferences`.
No `user_id` column needed.

### Migration Strategy for Existing Tables

All `user_id` columns are added as **nullable** first, then backfilled, then
made `NOT NULL`:

1. `ALTER TABLE {table} ADD COLUMN user_id UUID REFERENCES users(id);`
2. `UPDATE {table} SET user_id = '{system-user-uuid}';` -- backfill with default admin
3. `ALTER TABLE {table} ALTER COLUMN user_id SET NOT NULL;`

This avoids downtime. Step 2 can run in batches for large tables.

---

## 5. Complete Index Catalog

### New table indexes

| Index Name | Table | Column(s) | Type | Rationale |
|------------|-------|-----------|------|-----------|
| `users_pkey` | `users` | `id` | PK (unique, btree) | Primary key |
| `ix_users_email` | `users` | `email` | Unique | Login lookup, OAuth account matching |
| `ix_users_role` | `users` | `role` | btree | Admin panel filtering |
| `ix_users_is_active` | `users` | `is_active` | btree | Filter inactive users |
| `oauth_accounts_pkey` | `oauth_accounts` | `id` | PK | Primary key |
| `uq_oauth_provider_user` | `oauth_accounts` | `(provider, provider_user_id)` | Unique | OAuth login lookup |
| `ix_oauth_accounts_user_id` | `oauth_accounts` | `user_id` | btree | List linked accounts for a user |
| `refresh_tokens_pkey` | `refresh_tokens` | `id` | PK | Primary key |
| `ix_refresh_tokens_token_hash` | `refresh_tokens` | `token_hash` | Unique | Token validation |
| `ix_refresh_tokens_user_revoked` | `refresh_tokens` | `(user_id, revoked)` | btree | List active sessions |
| `ix_refresh_tokens_expires_at` | `refresh_tokens` | `expires_at` | btree | Cleanup of expired tokens |
| `user_settings_pkey` | `user_settings` | `id` | PK | Primary key |
| `ix_user_settings_user_id` | `user_settings` | `user_id` | Unique | One settings row per user |
| `ix_email_verif_token_hash` | `email_verification_tokens` | `token_hash` | Unique | Token lookup |
| `ix_email_verif_user_id` | `email_verification_tokens` | `user_id` | btree | Invalidate old tokens |
| `ix_password_reset_token_hash` | `password_reset_tokens` | `token_hash` | Unique | Token lookup |
| `ix_password_reset_user_id` | `password_reset_tokens` | `user_id` | btree | Invalidate old tokens |

### Existing table indexes (new)

| Index Name | Table | Column(s) | Rationale |
|------------|-------|-----------|-----------|
| `ix_trends_user_id` | `trends` | `user_id` | Filter trends by owner |
| `ix_contents_user_id` | `contents` | `user_id` | Filter content by owner |
| `ix_media_assets_user_id` | `media_assets` | `user_id` | Filter assets by owner |
| `ix_social_accounts_user_id` | `social_accounts` | `user_id` | Filter accounts by owner |
| `ix_publish_records_user_id` | `publish_records` | `user_id` | Filter records by owner |
| `ix_pipeline_runs_user_id` | `pipeline_runs` | `user_id` | Filter runs by owner |

---

## 6. SQLAlchemy 2.0 Models

These models go in `libs/orion-common/orion_common/db/models.py`, extending the
existing `Base` declarative base.

### 6.1 Role Enum

```python
class UserRole(str, enum.Enum):
    """User role for authorization."""

    admin = "admin"
    editor = "editor"
    viewer = "viewer"
```

### 6.2 User Model

```python
class User(Base):
    """An Orion platform user."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    password_hash: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    timezone: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="UTC"
    )
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="editor"
    )
    email_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    oauth_accounts: Mapped[list["OAuthAccount"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    settings: Mapped["UserSettings | None"] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )
    contents: Mapped[list["Content"]] = relationship(
        back_populates="user"
    )
    trends: Mapped[list["Trend"]] = relationship(
        back_populates="user"
    )
    social_accounts: Mapped[list["SocialAccount"]] = relationship(
        back_populates="user"
    )
```

### 6.3 OAuthAccount Model

```python
class OAuthAccount(Base):
    """An OAuth provider linked to a user."""

    __tablename__ = "oauth_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    provider: Mapped[str] = mapped_column(String(20), nullable=False)
    provider_user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    provider_email: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="oauth_accounts")

    __table_args__ = (
        UniqueConstraint("provider", "provider_user_id", name="uq_oauth_provider_user"),
    )
```

### 6.4 RefreshToken Model

```python
class RefreshToken(Base):
    """A server-side refresh token."""

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    device_info: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    revoked: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="refresh_tokens")
```

### 6.5 UserSettings Model

```python
class UserSettings(Base):
    """Per-user preferences and configuration."""

    __tablename__ = "user_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    provider_preferences: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, server_default="{}"
    )
    pipeline_config: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, server_default="{}"
    )
    notification_preferences: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, server_default="{}"
    )
    dashboard_preferences: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, server_default="{}"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="settings")
```

### 6.6 EmailVerificationToken Model

```python
class EmailVerificationToken(Base):
    """A single-use email verification token."""

    __tablename__ = "email_verification_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    used: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
```

### 6.7 PasswordResetToken Model

```python
class PasswordResetToken(Base):
    """A single-use password reset token."""

    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    used: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
```

### 6.8 Modifications to Existing Models

Add `user_id` and the `user` relationship to each existing data model:

```python
# --- Add to Trend ---
class Trend(Base):
    # ... existing columns ...
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True  # nullable during migration
    )
    user: Mapped["User | None"] = relationship(back_populates="trends")


# --- Add to Content ---
class Content(Base):
    # ... existing columns ...
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    user: Mapped["User | None"] = relationship(back_populates="contents")


# --- Add to MediaAsset ---
class MediaAsset(Base):
    # ... existing columns ...
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )


# --- Add to SocialAccount ---
class SocialAccount(Base):
    # ... existing columns ...
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    user: Mapped["User | None"] = relationship(back_populates="social_accounts")


# --- Add to PublishRecord ---
class PublishRecord(Base):
    # ... existing columns ...
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )


# --- Add to PipelineRun ---
class PipelineRun(Base):
    # ... existing columns ...
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
```

**Note:** After the backfill migration, `nullable=True` should be changed to
`nullable=False` on `contents`, `social_accounts`, and `publish_records`. The
`trends`, `media_assets`, and `pipeline_runs` tables may keep `nullable=True`
since system-generated records (scheduled scans, automated pipelines) may not
have a human user.

---

## 7. Alembic Migration Plan

All migrations go in `migrations/versions/`. The next revision is `005`.

### Migration 005: Create users table

```
005_create_users_table.py
  Revises: 004
```

- Create `users` table with all columns and indexes
- Create `user_settings` table
- Insert default system user:
  ```sql
  INSERT INTO users (id, email, name, role, email_verified, is_active)
  VALUES ('00000000-0000-0000-0000-000000000001', 'system@orion.local', 'System', 'admin', true, true);
  ```
- Insert default admin user (migrated from env-var config):
  ```sql
  INSERT INTO users (id, email, name, role, email_verified, is_active)
  VALUES ('00000000-0000-0000-0000-000000000002', 'admin@orion.local', 'Admin', 'admin', true, true);
  ```

### Migration 006: Create auth tables

```
006_create_auth_tables.py
  Revises: 005
```

- Create `oauth_accounts` table with unique constraint and indexes
- Create `refresh_tokens` table with indexes
- Create `email_verification_tokens` table with indexes
- Create `password_reset_tokens` table with indexes

### Migration 007: Add user_id to existing tables

```
007_add_user_id_to_data_tables.py
  Revises: 006
```

- Add `user_id UUID REFERENCES users(id)` (nullable) to:
  - `trends`
  - `contents`
  - `media_assets`
  - `pipeline_runs`
  - `social_accounts`
  - `publish_records`
- Create indexes on all new `user_id` columns

### Migration 008: Backfill user_id

```
008_backfill_user_id.py
  Revises: 007
```

- Update all existing rows to set `user_id = '00000000-0000-0000-0000-000000000002'`
  (the default admin user) where `user_id IS NULL`
- This is a data-only migration, no schema changes

### Migration 009: Enforce user_id NOT NULL (selective)

```
009_enforce_user_id_not_null.py
  Revises: 008
```

- `ALTER TABLE contents ALTER COLUMN user_id SET NOT NULL`
- `ALTER TABLE social_accounts ALTER COLUMN user_id SET NOT NULL`
- `ALTER TABLE publish_records ALTER COLUMN user_id SET NOT NULL`
- Keep `user_id` nullable on `trends`, `media_assets`, `pipeline_runs`
  (these can be system-generated)

### Rollback Safety

Each migration has a matching `downgrade()` that reverses the change. The split
into 5 migrations (005-009) ensures any step can be rolled back independently.

---

## 8. Entity Relationship Diagram

```
                                    +---------------------------+
                                    |          users            |
                                    +---------------------------+
                                    | id          UUID PK       |
                                    | email       VARCHAR UNIQUE|
                                    | password_hash VARCHAR     |
                                    | name        VARCHAR       |
                                    | avatar_url  TEXT          |
                                    | bio         TEXT          |
                                    | timezone    VARCHAR       |
                                    | role        VARCHAR       |
                                    | email_verified BOOLEAN    |
                                    | is_active   BOOLEAN       |
                                    | last_login_at TIMESTAMPTZ |
                                    | created_at  TIMESTAMPTZ   |
                                    | updated_at  TIMESTAMPTZ   |
                                    +---------------------------+
                                       |    |    |    |    |
                    +------------------+    |    |    |    +------------------+
                    |                       |    |    |                       |
                    v                       v    |    v                       v
    +---------------------+  +------------------+  +------------------+  +---------------------+
    |   oauth_accounts    |  |  refresh_tokens  |  |  user_settings   |  | email_verification  |
    +---------------------+  +------------------+  +------------------+  |     _tokens          |
    | id         UUID PK  |  | id       UUID PK |  | id     UUID PK  |  +---------------------+
    | user_id    UUID FK  |  | user_id  UUID FK |  | user_id UUID FK |  | id        UUID PK   |
    | provider   VARCHAR  |  | token_hash  VAR  |  | provider_prefs  |  | user_id   UUID FK   |
    | provider_user_id    |  | device_info VAR  |  |   JSONB         |  | token_hash VARCHAR  |
    | provider_email      |  | expires_at  TS   |  | pipeline_config |  | expires_at TS       |
    | access_token TEXT   |  | revoked  BOOLEAN |  |   JSONB         |  | used     BOOLEAN    |
    | refresh_token TEXT  |  | revoked_at  TS   |  | notification_   |  | created_at TS       |
    | token_expires_at TS |  | created_at  TS   |  |   prefs JSONB   |  +---------------------+
    | created_at TS       |  +------------------+  | dashboard_prefs |
    +---------------------+                         |   JSONB         |  +---------------------+
    UQ(provider,                                    | updated_at TS   |  | password_reset      |
       provider_user_id)                            +------------------+  |     _tokens          |
                                                    UQ(user_id)          +---------------------+
                                                                         | id        UUID PK   |
                                                                         | user_id   UUID FK   |
                    users.id referenced by:                              | token_hash VARCHAR  |
                    +-----------+                                        | expires_at TS       |
                    |           |                                        | used     BOOLEAN    |
       +------------+           +------------+                           | created_at TS       |
       |            |                        |                           +---------------------+
       v            v                        v
+------------+ +------------+  +------------------+
|   trends   | |  contents  |  | social_accounts  |
+------------+ +------------+  +------------------+
| ...        | | ...        |  | ...              |
| user_id FK | | user_id FK |  | user_id FK       |
+------------+ +-----+------+  +------------------+
                      |
        +-------------+-------------+
        |             |             |
        v             v             v
+---------------+ +---------------+ +------------------+
| media_assets  | | pipeline_runs | | publish_records  |
+---------------+ +---------------+ +------------------+
| ...           | | ...           | | ...              |
| user_id FK    | | user_id FK    | | user_id FK       |
+---------------+ +---------------+ +------------------+
```

### Relationship Summary

| Parent | Child | Cardinality | ON DELETE |
|--------|-------|-------------|-----------|
| `users` | `oauth_accounts` | 1:N | CASCADE |
| `users` | `refresh_tokens` | 1:N | CASCADE |
| `users` | `user_settings` | 1:1 | CASCADE |
| `users` | `email_verification_tokens` | 1:N | CASCADE |
| `users` | `password_reset_tokens` | 1:N | CASCADE |
| `users` | `trends` | 1:N | SET NULL (nullable FK) |
| `users` | `contents` | 1:N | RESTRICT (non-nullable FK) |
| `users` | `social_accounts` | 1:N | RESTRICT (non-nullable FK) |
| `users` | `media_assets` | 1:N | SET NULL (nullable FK) |
| `users` | `pipeline_runs` | 1:N | SET NULL (nullable FK) |
| `users` | `publish_records` | 1:N | RESTRICT (non-nullable FK) |
| `trends` | `contents` | 1:N | CASCADE (existing) |
| `contents` | `media_assets` | 1:N | CASCADE (existing) |
| `contents` | `pipeline_runs` | 1:N | CASCADE (existing) |
| `contents` | `publish_records` | 1:N | CASCADE (existing) |
| `social_accounts` | `publish_records` | 1:N | SET NULL (existing) |

---

## 9. Gateway Auth Migration Path

The Go gateway currently authenticates against env-var credentials. After this schema
is in place, the auth flow changes:

### Current Flow
```
POST /api/v1/auth/login {username, password}
  -> compare against ORION_ADMIN_USER / ORION_ADMIN_PASS env vars
  -> issue JWT with hardcoded claims
```

### Target Flow
```
POST /api/v1/auth/login {email, password}
  -> query users table by email
  -> bcrypt compare password_hash
  -> issue JWT with user.id as "sub" claim
  -> store refresh token in refresh_tokens table

POST /api/v1/auth/register {email, password, name}
  -> insert into users table
  -> send verification email
  -> issue JWT

POST /api/v1/auth/oauth/{provider}/callback
  -> exchange code for tokens
  -> upsert oauth_accounts
  -> find-or-create user
  -> issue JWT
```

### JWT Claims (updated)

```json
{
  "jti": "uuid",
  "sub": "user-uuid",
  "email": "user@example.com",
  "name": "User Name",
  "role": "editor",
  "iat": 1234567890,
  "exp": 1234574890
}
```

The `sub` claim changes from username string to user UUID. This is a **breaking
change** for any code reading `sub` from JWT claims. The gateway middleware
`UserClaims` struct should be updated to include `ID string` (the UUID).

---

## 10. Trade-Off Analysis

### Single Database vs Per-Service Databases

**Chosen: Single database.** All services share one PostgreSQL instance.

| Factor | Single DB | Per-Service DB |
|--------|-----------|----------------|
| Joins across domains | Possible | Requires API calls |
| Schema coupling | Higher | Lower |
| Operational complexity | Lower | Higher (6 databases) |
| Team size fit | Small team (good) | Large team (needed) |
| Foreign key integrity | Enforced by DB | Application-level only |

For a team operating Orion today, a single database with clear table ownership
conventions is the right call. If services need independent scaling later, the
`user_id` column on every table provides a natural sharding key.

### Role Column: VARCHAR vs ENUM vs Separate Table

**Chosen: VARCHAR with application-level validation.**

- ENUM requires a migration to add new roles.
- A separate `roles` table is over-engineering for 3 roles.
- VARCHAR with a Pydantic validator (`Literal["admin", "editor", "viewer"]`) gives
  flexibility without migration overhead.

### Refresh Tokens: Database vs Redis

**Chosen: Database.**

- Redis is already used for short-lived JWT blacklisting (existing pattern).
- Refresh tokens are long-lived (days/weeks) and need audit history. Database
  is the right persistence layer.
- The `refresh_tokens` table enables an "active sessions" dashboard feature.

### user_id on media_assets: Denormalized vs JOIN

**Chosen: Denormalized (nullable).**

- `media_assets.user_id` can be derived via `contents.user_id`, but listing
  "all assets for user X" is a common query that would require a JOIN otherwise.
- The cost is ensuring the service layer copies `user_id` when creating assets.
- If consistency becomes a problem, a database trigger can enforce it.

---

## 11. Future Considerations

### Multi-Tenancy (Organization / Workspace)

This design supports single-user ownership. If Orion evolves to support
organizations (multiple users sharing content), the next step would be:

1. Add an `organizations` table
2. Add `org_id` to `users` and all data tables
3. Replace `user_id`-based filtering with `org_id`-based filtering
4. Implement Row-Level Security (RLS) policies in PostgreSQL

The current `user_id` column provides a foundation -- it can be supplemented
with `org_id` without replacing it.

### API Key Authentication

For programmatic access (CI/CD, external integrations), an `api_keys` table
should be added later:

```sql
CREATE TABLE api_keys (
    id         UUID PRIMARY KEY,
    user_id    UUID REFERENCES users(id),
    key_hash   VARCHAR(255) UNIQUE NOT NULL,
    name       VARCHAR(255) NOT NULL,
    scopes     TEXT[],
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

This is explicitly deferred -- it adds complexity without immediate value.

---

## 12. ADR: Adopt Database-Backed User Management

### Status
Proposed

### Context
Orion authenticates via a single hardcoded admin user configured through environment
variables. This blocks multi-user support, OAuth integration, audit trails, and
per-user data scoping. The system needs database-backed user management to grow
beyond a single-operator deployment.

### Decision
Introduce a `users` table and supporting auth tables (`oauth_accounts`,
`refresh_tokens`, `user_settings`, token tables) in the shared PostgreSQL database.
Add a `user_id` foreign key to all existing data tables. Migrate the Go gateway
from env-var authentication to database-backed authentication.

### Consequences

**What becomes easier:**
- Adding new users without redeploying
- OAuth login (GitHub, Google)
- Auditing who created/approved/published content
- Per-user dashboard preferences and provider settings
- Future multi-tenancy via organization layer on top of users

**What becomes harder:**
- Every data-writing endpoint must now resolve and pass `user_id`
- The Go gateway needs a database connection (currently stateless)
- Testing requires user fixtures in addition to data fixtures
- Deployment of this change requires a coordinated migration + gateway update
