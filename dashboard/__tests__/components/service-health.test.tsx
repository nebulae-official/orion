import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ServiceHealth } from "@/components/service-health";

// Mock server actions directly — mocking globalThis.fetch doesn't work because
// getAuthToken() inside the actions resolves/throws before fetch is reached.
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

describe("ServiceHealth", () => {
  it("renders Service Status heading", () => {
    mockFetchSystemStatus.mockImplementation(() => new Promise(() => {}));
    mockFetchGatewayHealth.mockImplementation(() => new Promise(() => {}));

    render(<ServiceHealth />);

    expect(screen.getByText("Service Status")).toBeInTheDocument();
  });

  it("renders all seven services in initial checking state", () => {
    mockFetchSystemStatus.mockImplementation(() => new Promise(() => {}));
    mockFetchGatewayHealth.mockImplementation(() => new Promise(() => {}));

    render(<ServiceHealth />);

    expect(screen.getByText("Gateway")).toBeInTheDocument();
    expect(screen.getByText("Scout (Trends)")).toBeInTheDocument();
    expect(screen.getByText("Director (Scripts)")).toBeInTheDocument();
    expect(screen.getByText("Media (Assets)")).toBeInTheDocument();
    expect(screen.getByText("Editor (Video)")).toBeInTheDocument();
    expect(screen.getByText("Pulse (Analytics)")).toBeInTheDocument();
    expect(screen.getByText("Publisher (Social)")).toBeInTheDocument();
  });

  it("shows Checking badges initially", () => {
    mockFetchSystemStatus.mockImplementation(() => new Promise(() => {}));
    mockFetchGatewayHealth.mockImplementation(() => new Promise(() => {}));

    render(<ServiceHealth />);

    const checkingBadges = screen.getAllByText("Checking");
    expect(checkingBadges.length).toBe(7);
  });

  it("shows Healthy status for healthy services", async () => {
    mockFetchGatewayHealth.mockResolvedValue({ status: "ok" });
    mockFetchSystemStatus.mockResolvedValue({
      data: {
        status: "ok",
        services: [
          { service: "scout", status: "ok", uptime: "1h", queue_size: 0 },
          { service: "director", status: "ok", uptime: "1h", queue_size: 0 },
          { service: "media", status: "ok", uptime: "1h", queue_size: 0 },
          { service: "editor", status: "ok", uptime: "1h", queue_size: 0 },
          { service: "pulse", status: "ok", uptime: "1h", queue_size: 0 },
          { service: "publisher", status: "ok", uptime: "1h", queue_size: 0 },
        ],
      },
      authFailed: false,
    });

    render(<ServiceHealth />);

    await waitFor(() => {
      const healthyBadges = screen.getAllByText("Healthy");
      expect(healthyBadges.length).toBe(7);
    });
  });

  it("shows Unhealthy status when server actions return null", async () => {
    mockFetchGatewayHealth.mockResolvedValue(null);
    mockFetchSystemStatus.mockResolvedValue({ data: null, authFailed: false });

    render(<ServiceHealth />);

    await waitFor(() => {
      const unhealthyBadges = screen.getAllByText("Unhealthy");
      expect(unhealthyBadges.length).toBe(7);
    });
  });

  it("shows Auth Required when auth fails", async () => {
    mockFetchGatewayHealth.mockResolvedValue({ status: "ok" });
    mockFetchSystemStatus.mockResolvedValue({ data: null, authFailed: true });

    render(<ServiceHealth />);

    await waitFor(() => {
      const authBadges = screen.getAllByText("Auth Required");
      expect(authBadges.length).toBe(6);
      expect(screen.getAllByText("Healthy").length).toBe(1);
      expect(screen.getByText("Sign in for full service status")).toBeInTheDocument();
    });
  });

  it("shows Unhealthy status when gateway is down", async () => {
    mockFetchGatewayHealth.mockResolvedValue(null);
    mockFetchSystemStatus.mockResolvedValue({
      data: {
        status: "ok",
        services: [
          { service: "scout", status: "ok", uptime: "1h", queue_size: 0 },
          { service: "director", status: "ok", uptime: "1h", queue_size: 0 },
          { service: "media", status: "ok", uptime: "1h", queue_size: 0 },
          { service: "editor", status: "ok", uptime: "1h", queue_size: 0 },
          { service: "pulse", status: "ok", uptime: "1h", queue_size: 0 },
          { service: "publisher", status: "ok", uptime: "1h", queue_size: 0 },
        ],
      },
      authFailed: false,
    });

    render(<ServiceHealth />);

    await waitFor(() => {
      const healthyBadges = screen.getAllByText("Healthy");
      expect(healthyBadges.length).toBe(6);
      expect(screen.getAllByText("Unhealthy").length).toBe(1);
    });
  });

  it("renders auto-refresh note", () => {
    mockFetchSystemStatus.mockImplementation(() => new Promise(() => {}));
    mockFetchGatewayHealth.mockImplementation(() => new Promise(() => {}));

    render(<ServiceHealth />);

    expect(
      screen.getByText("Auto-refreshes every 5 seconds")
    ).toBeInTheDocument();
  });

  it("renders refresh button", () => {
    mockFetchSystemStatus.mockImplementation(() => new Promise(() => {}));
    mockFetchGatewayHealth.mockImplementation(() => new Promise(() => {}));

    render(<ServiceHealth />);

    expect(screen.getByTitle("Refresh now")).toBeInTheDocument();
  });
});
