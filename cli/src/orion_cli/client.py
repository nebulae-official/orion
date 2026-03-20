"""Gateway HTTP client — all CLI commands talk to the gateway through this."""

from __future__ import annotations

from typing import Any

import httpx
import structlog

logger = structlog.get_logger()


class GatewayClient:
    """Async HTTP client for the Orion gateway API."""

    def __init__(self, base_url: str, token: str | None = None) -> None:
        self._base_url = base_url.rstrip("/")
        self._token = token

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        return headers

    async def get(self, path: str, **kwargs: Any) -> dict[str, Any]:
        return await self._request("GET", path, **kwargs)

    async def post(self, path: str, **kwargs: Any) -> dict[str, Any]:
        return await self._request("POST", path, **kwargs)

    async def put(self, path: str, **kwargs: Any) -> dict[str, Any]:
        return await self._request("PUT", path, **kwargs)

    async def delete(self, path: str, **kwargs: Any) -> dict[str, Any]:
        return await self._request("DELETE", path, **kwargs)

    async def patch(self, path: str, **kwargs: Any) -> dict[str, Any]:
        return await self._request("PATCH", path, **kwargs)

    async def health(self) -> dict[str, Any]:
        return await self.get("/health")

    async def login(self, email: str, password: str) -> dict[str, Any]:
        return await self.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
        )

    async def whoami(self) -> dict[str, Any]:
        return await self.get("/api/v1/identity/users/me")

    async def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        url = f"{self._base_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=60.0) as http:
                resp = await http.request(method, url, headers=self._headers(), **kwargs)
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError:
            logger.error("connection_failed", url=self._base_url)
            raise SystemExit(3)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 401:
                logger.error("auth_failed", hint="run 'orion login' first")
                raise SystemExit(2)
            logger.error(
                "request_failed",
                status=exc.response.status_code,
                body=exc.response.text[:200],
            )
            raise SystemExit(1)
