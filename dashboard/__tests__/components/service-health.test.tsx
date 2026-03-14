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

  it("renders all six services in initial checking state", () => {
    mockFetchSystemStatus.mockImplementation(() => new Promise(() => {}));
    mockFetchGatewayHealth.mockImplementation(() => new Promise(() => {}));

    render(<ServiceHealth />);

    expect(screen.getByText("Gateway")).toBeInTheDocument();
    expect(screen.getByText("Scout (Trends)")).toBeInTheDocument();
    expect(screen.getByText("Director (Scripts)")).toBeInTheDocument();
    expect(screen.getByText("Media (Assets)")).toBeInTheDocument();
    expect(screen.getByText("Editor (Publish)")).toBeInTheDocument();
    expect(screen.getByText("Pulse (Analytics)")).toBeInTheDocument();
  });

  it("shows Checking badges initially", () => {
    mockFetchSystemStatus.mockImplementation(() => new Promise(() => {}));
    mockFetchGatewayHealth.mockImplementation(() => new Promise(() => {}));

    render(<ServiceHealth />);

    const checkingBadges = screen.getAllByText("Checking");
    expect(checkingBadges.length).toBe(6);
  });

  it("shows Healthy status for healthy services", async () => {
    mockFetchGatewayHealth.mockResolvedValue({ status: "ok" });
    mockFetchSystemStatus.mockResolvedValue({
      status: "ok",
      services: [
        { service: "scout", status: "ok" },
        { service: "director", status: "ok" },
        { service: "media", status: "ok" },
        { service: "editor", status: "ok" },
        { service: "pulse", status: "ok" },
      ],
    });

    render(<ServiceHealth />);

    await waitFor(() => {
      const healthyBadges = screen.getAllByText("Healthy");
      expect(healthyBadges.length).toBe(6);
    });
  });

  it("shows Unhealthy status when server actions return null", async () => {
    mockFetchGatewayHealth.mockResolvedValue(null);
    mockFetchSystemStatus.mockResolvedValue(null);

    render(<ServiceHealth />);

    await waitFor(() => {
      const unhealthyBadges = screen.getAllByText("Unhealthy");
      expect(unhealthyBadges.length).toBe(6);
    });
  });

  it("shows Unhealthy status when gateway is down", async () => {
    mockFetchGatewayHealth.mockResolvedValue(null);
    mockFetchSystemStatus.mockResolvedValue({
      status: "ok",
      services: [
        { service: "scout", status: "ok" },
        { service: "director", status: "ok" },
        { service: "media", status: "ok" },
        { service: "editor", status: "ok" },
        { service: "pulse", status: "ok" },
      ],
    });

    render(<ServiceHealth />);

    await waitFor(() => {
      const healthyBadges = screen.getAllByText("Healthy");
      expect(healthyBadges.length).toBe(5);
      expect(screen.getAllByText("Unhealthy").length).toBe(1);
    });
  });

  it("renders auto-refresh note", () => {
    mockFetchSystemStatus.mockImplementation(() => new Promise(() => {}));
    mockFetchGatewayHealth.mockImplementation(() => new Promise(() => {}));

    render(<ServiceHealth />);

    expect(
      screen.getByText("Auto-refreshes every 30 seconds")
    ).toBeInTheDocument();
  });

  it("renders refresh button", () => {
    mockFetchSystemStatus.mockImplementation(() => new Promise(() => {}));
    mockFetchGatewayHealth.mockImplementation(() => new Promise(() => {}));

    render(<ServiceHealth />);

    expect(screen.getByTitle("Refresh now")).toBeInTheDocument();
  });
});
