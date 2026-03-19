# :lucide-lock: Authentication

Orion uses DB-backed multi-user authentication with support for email/password login and OAuth 2.0 (GitHub, Google). The Go gateway handles all authentication flows, delegating user management to the Identity service.

## :material-key: Token Design

| Token          | Format           | Lifetime | Storage                    |
| -------------- | ---------------- | -------- | -------------------------- |
| Access token   | JWT (HS256)      | 15 min   | Client memory / cookie     |
| Refresh token  | Opaque (`ort_*`) | 30 days  | DB-backed (Identity svc)   |

Access tokens are short-lived JWTs used in the `Authorization: Bearer` header. Refresh tokens are opaque strings stored in the database with family-based tracking for theft detection.

## :material-login: Email/Password Login

### `POST /api/v1/auth/login`

=== "curl"

    ```bash
    curl -X POST http://localhost:8000/api/v1/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email": "admin@orion.local", "password": "orion_dev"}'
    ```

=== "Python"

    ```python
    import httpx

    resp = httpx.post(
        "http://localhost:8000/api/v1/auth/login",
        json={"email": "admin@orion.local", "password": "orion_dev"},
    )
    data = resp.json()
    access_token = data["access_token"]
    refresh_token = data["refresh_token"]
    ```

**Request:**

```json
{
  "email": "admin@orion.local",
  "password": "orion_dev"
}
```

**Response (200):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "ort_a1b2c3d4e5f6g7h8i9j0...",
  "token_type": "Bearer",
  "expires_in": 900,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@orion.local",
    "name": "Admin",
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

## :material-account-plus: Registration

### `POST /api/v1/auth/register`

Create a new user account. A verification email is sent (stubbed in development).

**Request:**

```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "Jane Smith"
}
```

**Response (201):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "ort_x1y2z3...",
  "token_type": "Bearer",
  "expires_in": 900,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Jane Smith",
    "role": "user"
  }
}
```

---

## :material-github: OAuth 2.0 (GitHub / Google)

OAuth flows are handled entirely by the gateway. The user is redirected to the provider, and after authorization, the gateway creates or links the account via the Identity service.

### Initiate OAuth

| Provider | Endpoint                           |
| -------- | ---------------------------------- |
| GitHub   | `GET /api/v1/auth/oauth/github`    |
| Google   | `GET /api/v1/auth/oauth/google`    |

Both endpoints redirect the user to the provider's authorization page with a `state` parameter for CSRF protection.

### OAuth Callback

| Provider | Endpoint                                    |
| -------- | ------------------------------------------- |
| GitHub   | `GET /api/v1/auth/oauth/github/callback`    |
| Google   | `GET /api/v1/auth/oauth/google/callback`    |

After successful authorization, the callback:

1. Exchanges the authorization code for an access token
2. Fetches the user profile from the provider
3. Creates a new account or links to an existing one
4. Sets `access_token` and `refresh_token` cookies
5. Redirects to the dashboard

```mermaid
sequenceDiagram
    participant User
    participant Gateway
    participant Provider as GitHub/Google
    participant Identity

    User->>Gateway: GET /api/v1/auth/oauth/github
    Gateway->>User: 302 → Provider authorize URL

    User->>Provider: Authorize app
    Provider->>Gateway: Callback with code + state

    Gateway->>Provider: Exchange code → access token
    Gateway->>Provider: Fetch user profile

    Gateway->>Identity: Find or create user
    Identity->>Gateway: User record

    Gateway->>Gateway: Sign JWT (15-min)
    Gateway->>User: Set cookies, redirect to /
```

---

## :material-refresh: Token Refresh

### `POST /api/v1/auth/refresh`

Exchange a valid refresh token for a new access token and a rotated refresh token. The old refresh token is invalidated.

**Request:**

```json
{
  "refresh_token": "ort_a1b2c3d4e5f6..."
}
```

**Response (200):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "ort_new_token...",
  "token_type": "Bearer",
  "expires_in": 900
}
```

!!! warning "Refresh Token Rotation"
    Each refresh token can only be used **once**. After use, a new refresh token is issued and the old one is revoked. If a revoked token is reused, the entire token family is invalidated to protect against token theft.

---

## :material-close-circle: Token Revocation

Refresh tokens can be revoked on logout. Access tokens are short-lived (15 min) and expire naturally.

```bash
curl -X POST http://localhost:8000/api/v1/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "ort_a1b2c3d4e5f6..."}'
```

---

## :material-email: Email Verification

### `POST /api/v1/auth/verify-email`

Verify an email address using the token sent during registration.

**Request:**

```json
{
  "token": "verification-token-from-email"
}
```

---

## :material-lock-reset: Password Reset

### Step 1: Request Reset

#### `POST /api/v1/auth/forgot-password`

```json
{
  "email": "user@example.com"
}
```

A password reset email is sent (stubbed in development). The response always returns 200 regardless of whether the email exists (to prevent user enumeration).

### Step 2: Complete Reset

#### `POST /api/v1/auth/reset-password`

```json
{
  "token": "reset-token-from-email",
  "new_password": "newsecurepassword123"
}
```

---

## :material-badge-account: Using Tokens

Include the access token in the `Authorization` header for all protected requests:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

## :material-format-list-checks: JWT Claims

| Claim   | Type                 | Description               |
| ------- | -------------------- | ------------------------- |
| `sub`   | string (UUID)        | User ID                   |
| `email` | string               | Email address             |
| `name`  | string               | Display name              |
| `role`  | string               | User role (`admin`, `user`) |
| `iat`   | int (Unix timestamp) | Issued at                 |
| `exp`   | int (Unix timestamp) | Expiry (iat + 900)        |

## :material-clock: Token Lifecycle

```mermaid
sequenceDiagram
    participant Client
    participant Gateway

    Client->>Gateway: POST /api/v1/auth/login
    Gateway->>Client: access_token (15-min) + refresh_token (30-day)

    loop Every 15 minutes
        Client->>Gateway: POST /api/v1/auth/refresh {refresh_token}
        Gateway->>Client: New access_token + rotated refresh_token
    end

    loop Until refresh needed
        Client->>Gateway: GET /api/v1/... + Bearer token
        Gateway->>Client: 200 OK
    end

    Client->>Gateway: POST /api/v1/auth/logout {refresh_token}
    Gateway->>Client: 200 OK (refresh token revoked)
```

## :material-cog: Configuration

| Variable                 | Default                           | Description                      |
| ------------------------ | --------------------------------- | -------------------------------- |
| `ORION_JWT_SECRET`       | `dev-secret-change-in-production` | HS256 signing key                |
| `GITHUB_CLIENT_ID`       | --                                | GitHub OAuth app client ID       |
| `GITHUB_CLIENT_SECRET`   | --                                | GitHub OAuth app client secret   |
| `GOOGLE_CLIENT_ID`       | --                                | Google OAuth client ID           |
| `GOOGLE_CLIENT_SECRET`   | --                                | Google OAuth client secret       |
| `OAUTH_REDIRECT_BASE`    | `http://localhost:8000`           | Base URL for OAuth callbacks     |

!!! danger "Production Security"
    - Always change `ORION_JWT_SECRET` from the default value
    - Use HTTPS for `OAUTH_REDIRECT_BASE` in production
    - Store OAuth client secrets securely (e.g., vault, sealed secrets)

!!! warning "Deprecated"
    `ORION_ADMIN_USER` and `ORION_ADMIN_PASS` are deprecated. User accounts are now managed through the Identity service with DB-backed credentials.
