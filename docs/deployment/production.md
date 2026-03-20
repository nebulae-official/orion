# Production Deployment

Checklist and recommendations for deploying Orion to production.

## :material-check-all: Pre-Deployment Checklist

- [ ] Change `ORION_JWT_SECRET` to a strong random value (32+ characters)
- [ ] Create admin user via registration or database seeding (env-var admin is deprecated)
- [ ] Configure OAuth providers (GitHub/Google) with production callback URLs
- [ ] Set `APP_ENV=production`
- [ ] Restrict CORS origins (default allows all)
- [ ] Enable TLS termination (reverse proxy or load balancer)
- [ ] Configure PostgreSQL with SSL and strong credentials
- [ ] Set Redis authentication password
- [ ] Configure backup schedules for PostgreSQL and Milvus
- [ ] Set up monitoring (Prometheus + Grafana)
- [ ] Configure log aggregation
- [ ] Set resource limits on all containers
- [ ] Enable Docker health checks (already configured)

## :material-shield-lock: Security Hardening

### JWT Secret

```bash
# Generate a secure random secret
openssl rand -base64 48
```

Set it in your production environment:

```env
ORION_JWT_SECRET=your-64-character-random-secret-here
```

### TLS Configuration

Deploy a reverse proxy (e.g., Nginx, Caddy, or Traefik) in front of the gateway:

```
Client --> TLS Termination (443) --> Gateway (8000)
```

### Network Isolation

In production, only expose the gateway and dashboard to external traffic:

```yaml
services:
  gateway:
    ports:
      - "8000:8000" # Only service exposed externally
  dashboard:
    ports:
      - "3000:3000"
  # All other services: no port mapping
  scout:
    expose:
      - "8001" # Internal only
```

## :material-database: Database

### PostgreSQL

- Enable SSL connections
- Use dedicated credentials per service (not shared `orion` user)
- Configure connection pooling (PgBouncer recommended)
- Set up automated backups with point-in-time recovery
- Monitor connection count and query performance

### Redis

- Set `requirepass` in Redis configuration
- Disable `FLUSHALL` and `FLUSHDB` commands
- Configure maxmemory policy (`allkeys-lru` recommended)
- Enable AOF persistence

### Milvus

- Configure authentication
- Set up data backups
- Monitor collection sizes and query latency

## :material-memory: Resource Limits

Set container resource limits in production:

```yaml
services:
  gateway:
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
  director:
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 2G
  media:
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 4G
```

## :material-scale-balance: Scaling

- **Gateway:** Stateless, can be horizontally scaled behind a load balancer
- **Scout:** Single instance sufficient (polling-based)
- **Director:** Scale carefully -- LangGraph checkpoints are per-thread
- **Media:** Scale horizontally for parallel image generation
- **Editor:** CPU/GPU-intensive -- scale based on rendering demand
- **Pulse:** Single instance sufficient (event aggregation)
- **Publisher:** Single instance sufficient (rate-limited by platforms)
