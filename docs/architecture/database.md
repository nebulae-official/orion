# Database

Orion uses PostgreSQL 16 as its primary relational store, accessed through SQLAlchemy 2.0 with async sessions.

## :material-database: Schema Overview

```mermaid
erDiagram
    trends ||--o{ contents : "generates"
    contents ||--o{ media_assets : "has"
    contents ||--o{ pipeline_runs : "tracks"
    contents ||--o{ publish_records : "published_to"
    social_accounts ||--o{ publish_records : "uses"

    trends {
        uuid id PK
        string topic
        string source
        float score
        enum status "active/expired/archived"
        timestamp created_at
        timestamp updated_at
    }

    contents {
        uuid id PK
        uuid trend_id FK
        string title
        text script_body
        enum status "draft/generating/review/approved/published/rejected"
        jsonb metadata
        timestamp created_at
        timestamp updated_at
    }

    media_assets {
        uuid id PK
        uuid content_id FK
        enum asset_type "image/video/audio"
        string file_path
        string provider
        jsonb metadata
        timestamp created_at
    }

    pipeline_runs {
        uuid id PK
        uuid content_id FK
        string stage
        enum status "pending/running/completed/failed"
        jsonb result
        timestamp started_at
        timestamp completed_at
    }

    providers {
        uuid id PK
        string name
        string provider_type
        boolean is_active
        jsonb config
    }

    social_accounts {
        uuid id PK
        string platform
        string display_name
        jsonb credentials
        timestamp connected_at
    }

    publish_records {
        uuid id PK
        uuid content_id FK
        uuid account_id FK
        string platform
        enum status "published/failed"
        string external_id
        timestamp published_at
    }
```

## :material-table: Table Reference

| Table             | Purpose                               | Key Columns                                         |
| ----------------- | ------------------------------------- | --------------------------------------------------- |
| `trends`          | Detected trends from external sources | `topic`, `source`, `score`, `status`                |
| `contents`        | Generated content pieces              | `trend_id`, `title`, `script_body`, `status`        |
| `media_assets`    | Images, videos, audio files           | `content_id`, `asset_type`, `provider`, `file_path` |
| `pipeline_runs`   | Pipeline execution history            | `content_id`, `stage`, `status`                     |
| `providers`       | AI provider configurations            | `name`, `provider_type`, `is_active`                |
| `social_accounts` | Connected social media accounts       | `platform`, `display_name`                          |
| `publish_records` | Content publishing history            | `content_id`, `platform`, `status`                  |

## :material-state-machine: Status Enums

### TrendStatus

| Value      | Description                                         |
| ---------- | --------------------------------------------------- |
| `active`   | Currently trending, eligible for content generation |
| `expired`  | No longer trending                                  |
| `archived` | Manually archived                                   |

### ContentStatus

| Value        | Description             |
| ------------ | ----------------------- |
| `draft`      | Initial state           |
| `generating` | Pipeline is running     |
| `review`     | Awaiting human approval |
| `approved`   | Approved for publishing |
| `published`  | Published to platforms  |
| `rejected`   | Rejected by reviewer    |

### AssetType

`image`, `video`, `audio`

### PipelineStatus

`pending`, `running`, `completed`, `failed`

### PublishStatus

`published`, `failed`

## :material-connection: Connection Configuration

Python services use async PostgreSQL connections via `asyncpg`:

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

## :material-vector-square: Vector Database (Milvus)

Milvus 2.4 stores embeddings for the Director's vector memory system:

- **Host:** `localhost:19530` (gRPC) / `localhost:9091` (HTTP)
- **Purpose:** Content similarity search, deduplication, context retrieval
- **Integration:** Director service uses Milvus for embedding-based lookups during content generation
