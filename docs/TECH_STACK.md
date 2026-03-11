# Tech Stack

Full version inventory for the Orion platform.

## Languages & Runtimes

| Component  | Language   | Version  |
|------------|-----------|---------|
| Gateway    | Go        | 1.24    |
| CLI        | Go        | 1.24    |
| Services   | Python    | 3.13    |
| Dashboard  | TypeScript| 5.x     |
| Dashboard  | Node.js   | 22 LTS  |

## Web Frameworks

| Component  | Framework   | Version    |
|------------|------------|-----------|
| Gateway    | net/http   | stdlib    |
| Services   | FastAPI    | ≥0.115.0  |
| Services   | Uvicorn    | ≥0.34.0   |
| Dashboard  | Next.js    | 15.2.0    |
| Dashboard  | React      | 19.x      |

## Data & Infrastructure

| System      | Purpose                  | Version  |
|-------------|--------------------------|---------|
| PostgreSQL  | Primary relational store | 16      |
| SQLAlchemy  | Python ORM               | ≥2.0.0  |
| Redis       | Cache & message queue    | ≥7.0    |
| Milvus      | Vector database          | 2.x     |

## AI / ML

| System    | Purpose                    | Notes              |
|-----------|----------------------------|--------------------|
| Ollama    | Local LLM inference        | http://localhost:11434 |
| ComfyUI   | Local image generation     | http://localhost:8188  |

## Validation & Config

| Library          | Purpose                   | Version  |
|------------------|---------------------------|---------|
| Pydantic         | Data validation (Python)  | ≥2.10.0 |
| pydantic-settings| Settings management       | ≥2.7.0  |
| structlog        | Structured logging        | ≥24.0.0 |

## Frontend

| Library      | Purpose           | Version |
|--------------|-------------------|---------|
| Tailwind CSS | Utility CSS       | ≥4.0.0  |
| TypeScript   | Type-safe JS      | ≥5.x    |
