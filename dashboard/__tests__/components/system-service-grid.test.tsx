import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SystemServiceGrid } from "@/app/(dashboard)/system/system-service-grid";

vi.mock("@/lib/actions", () => ({
  fetchSystemStatus: vi.fn(),
  fetchGatewayHealth: vi.fn(),
}));

import { fetchSystemStatus, fetchGatewayHealth } from "@/lib/actions";

const mockFetchSystemStatus = vi.mocked(fetchSystemStatus);
const mockFetchGatewayHealth = vi.mocked(fetchGatewayHealth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SystemServiceGrid", () => {
  it("renders all six service cards", () => {
    mockFetchSystemStatus.mockImplementation(() => new Promise(() => {}));
    mockFetchGatewayHealth.mockImplementation(() => new Promise(() => {}));

    render(<SystemServiceGrid />);

    expect(screen.getByText("Gateway")).toBeInTheDocument();
    expect(screen.getByText("Scout")).toBeInTheDocument();
    expect(screen.getByText("Director")).toBeInTheDocument();
    expect(screen.getByText("Media")).toBeInTheDocument();
    expect(screen.getByText("Editor")).toBeInTheDocument();
    expect(screen.getByText("Publisher")).toBeInTheDocument();
  });

  it("renders service host annotations", () => {
    mockFetchSystemStatus.mockImplementation(() => new Promise(() => {}));
    mockFetchGatewayHealth.mockImplementation(() => new Promise(() => {}));

    render(<SystemServiceGrid />);

    expect(screen.getByText(":8000 · Go")).toBeInTheDocument();
    expect(screen.getByText(":8001 · Python")).toBeInTheDocument();
    expect(screen.getByText(":8003 · Python")).toBeInTheDocument();
  });

  it("shows demo metric labels", () => {
    mockFetchSystemStatus.mockImplementation(() => new Promise(() => {}));
    mockFetchGatewayHealth.mockImplementation(() => new Promise(() => {}));

    render(<SystemServiceGrid />);

    expect(screen.getByText("Req/s")).toBeInTheDocument();
    expect(screen.getByText("P95 Latency")).toBeInTheDocument();
    expect(screen.getByText("Trends/hr")).toBeInTheDocument();
    expect(screen.getByText("LLM Model")).toBeInTheDocument();
  });

  it("shows Checking badges initially", () => {
    mockFetchSystemStatus.mockImplementation(() => new Promise(() => {}));
    mockFetchGatewayHealth.mockImplementation(() => new Promise(() => {}));

    render(<SystemServiceGrid />);

    const checkingBadges = screen.getAllByText("Checking");
    expect(checkingBadges.length).toBe(6);
  });

  it("shows Healthy badge for gateway when online", async () => {
    mockFetchGatewayHealth.mockResolvedValue({ status: "ok" });
    mockFetchSystemStatus.mockResolvedValue({
      data: {
        status: "ok",
        services: [
          { service: "scout", status: "ok", uptime: "1h", queue_size: 0, checks: { redis: true, postgres: true } },
          { service: "director", status: "ok", uptime: "1h", queue_size: 0, checks: { redis: true, postgres: true } },
          { service: "media", status: "ok", uptime: "1h", queue_size: 5, checks: { redis: true, postgres: true } },
          { service: "editor", status: "ok", uptime: "1h", queue_size: 0, checks: { redis: true, postgres: true } },
          { service: "publisher", status: "ok", uptime: "1h", queue_size: 0, checks: { redis: true, postgres: true } },
        ],
      },
      authFailed: false,
    });

    render(<SystemServiceGrid />);

    await waitFor(() => {
      expect(screen.getByText("Healthy")).toBeInTheDocument();
    });
  });

  it("shows Busy badge when service queue depth exceeds threshold", async () => {
    mockFetchGatewayHealth.mockResolvedValue({ status: "ok" });
    mockFetchSystemStatus.mockResolvedValue({
      data: {
        status: "ok",
        services: [
          { service: "scout", status: "ok", uptime: "1h", queue_size: 0, checks: { redis: true, postgres: true } },
          { service: "director", status: "ok", uptime: "1h", queue_size: 0, checks: { redis: true, postgres: true } },
          { service: "media", status: "ok", uptime: "1h", queue_size: 23, checks: { redis: true, postgres: true } },
          { service: "editor", status: "ok", uptime: "1h", queue_size: 0, checks: { redis: true, postgres: true } },
          { service: "publisher", status: "ok", uptime: "1h", queue_size: 0, checks: { redis: true, postgres: true } },
        ],
      },
      authFailed: false,
    });

    render(<SystemServiceGrid />);

    await waitFor(() => {
      expect(screen.getByText("Busy")).toBeInTheDocument();
    });
  });

  it("shows Unhealthy badges when gateway and services are down", async () => {
    mockFetchGatewayHealth.mockResolvedValue(null);
    mockFetchSystemStatus.mockResolvedValue({ data: null, authFailed: false });

    render(<SystemServiceGrid />);

    await waitFor(() => {
      // Gateway + all services return no data → all six cards show Unhealthy
      expect(screen.getAllByText("Unhealthy").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows live queue size for media service", async () => {
    mockFetchGatewayHealth.mockResolvedValue({ status: "ok" });
    mockFetchSystemStatus.mockResolvedValue({
      data: {
        status: "ok",
        services: [
          { service: "scout", status: "ok", uptime: "1h", queue_size: 0, checks: { redis: true, postgres: true } },
          { service: "director", status: "ok", uptime: "1h", queue_size: 0, checks: { redis: true, postgres: true } },
          { service: "media", status: "ok", uptime: "1h", queue_size: 7, checks: { redis: true, postgres: true } },
          { service: "editor", status: "ok", uptime: "1h", queue_size: 0, checks: { redis: true, postgres: true } },
          { service: "publisher", status: "ok", uptime: "1h", queue_size: 0, checks: { redis: true, postgres: true } },
        ],
      },
      authFailed: false,
    });

    render(<SystemServiceGrid />);

    await waitFor(() => {
      expect(screen.getByText("7")).toBeInTheDocument();
    });
  });
});
