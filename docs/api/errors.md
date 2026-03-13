# Errors

Orion uses standard HTTP status codes with consistent JSON error responses.

## :material-alert: Error Response Format

All error responses follow this structure:

```json
{
  "error": "error_code",
  "message": "Human-readable error description",
  "detail": {}
}
```

## :material-format-list-numbered: HTTP Status Codes

### Client Errors (4xx)

| Code  | Name                 | When                                          |
| ----- | -------------------- | --------------------------------------------- |
| `400` | Bad Request          | Invalid request body, missing required fields |
| `401` | Unauthorized         | Missing or invalid JWT token                  |
| `403` | Forbidden            | Valid token but insufficient permissions      |
| `404` | Not Found            | Resource does not exist                       |
| `409` | Conflict             | Duplicate resource or state conflict          |
| `422` | Unprocessable Entity | Validation error (Pydantic)                   |
| `429` | Too Many Requests    | Rate limit exceeded                           |

### Server Errors (5xx)

| Code  | Name                  | When                         |
| ----- | --------------------- | ---------------------------- |
| `500` | Internal Server Error | Unexpected server failure    |
| `502` | Bad Gateway           | Upstream service unavailable |
| `503` | Service Unavailable   | Service not ready            |
| `504` | Gateway Timeout       | Upstream service timeout     |

## :material-code-json: Error Examples

### 401 Unauthorized

```json
{
  "error": "unauthorized",
  "message": "Invalid or expired token"
}
```

### 422 Validation Error

FastAPI/Pydantic validation errors include field-level details:

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "trend_id"],
      "msg": "Field required",
      "input": {}
    },
    {
      "type": "string_too_short",
      "loc": ["body", "trend_topic"],
      "msg": "String should have at least 1 character",
      "input": "",
      "ctx": { "min_length": 1 }
    }
  ]
}
```

### 429 Rate Limited

```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests"
}
```

Rate limit headers on 429 responses:

| Header                  | Description                           |
| ----------------------- | ------------------------------------- |
| `X-RateLimit-Limit`     | Maximum requests allowed              |
| `X-RateLimit-Remaining` | `0`                                   |
| `X-RateLimit-Reset`     | Unix timestamp when the window resets |
| `Retry-After`           | Seconds until the client can retry    |

### 502 Bad Gateway

Returned when the gateway cannot reach an upstream service:

```json
{
  "error": "bad_gateway",
  "message": "Service scout is unavailable"
}
```

## :material-bug: Debugging Errors

### Check service health

```bash
curl http://localhost:8000/health
curl http://localhost:8000/ready
```

### Check individual service logs

```bash
docker compose -f deploy/docker-compose.yml logs scout
docker compose -f deploy/docker-compose.yml logs director
```

### Enable verbose CLI output

```bash
./bin/orion --verbose content list
```

### Check request ID

Every response includes an `X-Request-ID` header. Use this to correlate errors across service logs:

```bash
curl -v http://localhost:8000/api/v1/scout/api/v1/trends \
  -H "Authorization: Bearer $TOKEN" 2>&1 | grep X-Request-ID
```
