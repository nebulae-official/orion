# Authentication

Orion uses JWT Bearer tokens for API authentication. All protected endpoints require a valid token in the `Authorization` header.

## :material-login: Login

### `POST /api/v1/auth/login`

=== "curl"

    ```bash
    curl -X POST http://localhost:8000/api/v1/auth/login \
      -H "Content-Type: application/json" \
      -d '{"username": "admin", "password": "orion_dev"}'
    ```

=== "Python"

    ```python
    import httpx

    resp = httpx.post(
        "http://localhost:8000/api/v1/auth/login",
        json={"username": "admin", "password": "orion_dev"},
    )
    data = resp.json()
    token = data["access_token"]
    ```

**Request:**

```json
{
  "username": "admin",
  "password": "orion_dev"
}
```

**Response (200):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "admin",
    "email": "admin@orion.local",
    "role": "admin"
  }
}
```

**Response (401):**

```json
{
  "error": "invalid credentials"
}
```

---

## :material-refresh: Token Refresh

### `POST /api/v1/auth/refresh`

Refresh an existing token before it expires.

=== "curl"

    ```bash
    curl -X POST http://localhost:8000/api/v1/auth/refresh \
      -H "Authorization: Bearer $TOKEN"
    ```

=== "Python"

    ```python
    resp = httpx.post(
        "http://localhost:8000/api/v1/auth/refresh",
        headers={"Authorization": f"Bearer {token}"},
    )
    new_token = resp.json()["access_token"]
    ```

---

## :material-key: Using Tokens

Include the token in the `Authorization` header for all protected requests:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

## :material-clock: Token Lifecycle

```mermaid
sequenceDiagram
    participant Client
    participant Gateway

    Client->>Gateway: POST /api/v1/auth/login
    Gateway->>Client: access_token (24h TTL)

    loop Until expiry
        Client->>Gateway: GET /api/v1/... + Bearer token
        Gateway->>Client: 200 OK
    end

    Client->>Gateway: POST /api/v1/auth/refresh + Bearer token
    Gateway->>Client: New access_token (24h TTL)
```

## :material-format-list-checks: JWT Claims

| Claim      | Type                 | Description          |
| ---------- | -------------------- | -------------------- |
| `sub`      | string (UUID)        | User ID              |
| `username` | string               | Username             |
| `email`    | string               | Email address        |
| `role`     | string               | User role (`admin`)  |
| `iat`      | int (Unix timestamp) | Issued at            |
| `exp`      | int (Unix timestamp) | Expiry (iat + 86400) |

## :material-cog: Configuration

| Variable            | Default                           | Description       |
| ------------------- | --------------------------------- | ----------------- |
| `ORION_JWT_SECRET`  | `dev-secret-change-in-production` | HS256 signing key |
| `ORION_ADMIN_USER`  | `admin`                           | Admin username    |
| `ORION_ADMIN_PASS`  | `orion_dev`                       | Admin password    |
| `ORION_ADMIN_EMAIL` | `admin@orion.local`               | Admin email       |

!!! danger "Production security"
Always change `ORION_JWT_SECRET` and `ORION_ADMIN_PASS` before deploying to production.
