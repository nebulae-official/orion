"""Locust load test for Orion gateway."""

from locust import HttpUser, between, task


class OrionUser(HttpUser):
    """Simulates a typical Orion user hitting gateway endpoints."""

    wait_time = between(0.5, 2)
    host = "http://localhost:8000"

    def on_start(self) -> None:
        """Authenticate on session start."""
        resp = self.client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "admin"},
        )
        if resp.status_code == 200:
            self.token = resp.json().get("access_token", "")
            self.auth_headers = {"Authorization": f"Bearer {self.token}"}
        else:
            self.token = ""
            self.auth_headers = {}

    @task(5)
    def health_check(self) -> None:
        self.client.get("/health")

    @task(3)
    def list_trends(self) -> None:
        self.client.get("/api/v1/scout/trends", headers=self.auth_headers)

    @task(2)
    def list_content(self) -> None:
        self.client.get("/api/v1/director/content", headers=self.auth_headers)

    @task(1)
    def check_status(self) -> None:
        self.client.get("/status", headers=self.auth_headers)

    @task(1)
    def pipeline_metrics(self) -> None:
        self.client.get("/api/v1/pulse/analytics/pipeline", headers=self.auth_headers)
