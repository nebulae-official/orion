# Deployment

Orion is designed for containerized deployment using Docker Compose, with support for development, staging, and production environments.

## :material-view-grid: Deployment Options

| Environment | Command                                                                           | Description                |
| ----------- | --------------------------------------------------------------------------------- | -------------------------- |
| **Default** | `docker compose -f deploy/docker-compose.yml up`                                  | Core services only         |
| **Full**    | `docker compose -f deploy/docker-compose.yml --profile full up`                   | Includes Ollama & ComfyUI  |
| **GPU**     | `docker compose -f deploy/docker-compose.yml --profile gpu up`                    | GPU-accelerated inference  |
| **Dev**     | `docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.dev.yml up` | Hot reload for development |

## :material-layers: Service Architecture

```mermaid
graph TB
    subgraph External["External Access"]
        LB["Load Balancer / Reverse Proxy"]
    end

    subgraph Docker["Docker Compose (orion-net)"]
        GW["Gateway :8000"]
        SC["Scout :8001"]
        DR["Director :8002"]
        MD["Media :8003"]
        ED["Editor :8004"]
        PL["Pulse :8005"]
        PB["Publisher :8006"]
        DB["Dashboard :3000"]

        PG[("PostgreSQL :5432")]
        RD[("Redis :6379")]
        MV[("Milvus :19530")]
        OL["Ollama :11434"]
        CU["ComfyUI :8188"]
    end

    LB --> GW & DB
    GW --> SC & DR & MD & ED & PL & PB
    SC & DR & MD & ED & PL & PB --> PG & RD
    DR --> MV & OL
    MD --> CU
```

## :material-book-open-variant: Sections

- [Docker](docker.md) -- Docker Compose configuration and service details
- [Production](production.md) -- Production deployment checklist
- [Monitoring](monitoring.md) -- Prometheus, Grafana, and alerting setup
- [CI/CD](ci-cd.md) -- GitHub Actions workflows
