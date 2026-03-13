import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ServiceHealth } from "@/components/service-health";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ServiceHealth", () => {
  it("renders Service Status heading", () => {
    vi.mocked(globalThis.fetch).mockImplementation(
      () => new Promise(() => {})
    );

    render(<ServiceHealth />);

    expect(screen.getByText("Service Status")).toBeInTheDocument();
  });

  it("renders all six services in initial checking state", () => {
    vi.mocked(globalThis.fetch).mockImplementation(
      () => new Promise(() => {})
    );

    render(<ServiceHealth />);

    expect(screen.getByText("Gateway")).toBeInTheDocument();
    expect(screen.getByText("Scout (Trends)")).toBeInTheDocument();
    expect(screen.getByText("Director (Scripts)")).toBeInTheDocument();
    expect(screen.getByText("Media (Assets)")).toBeInTheDocument();
    expect(screen.getByText("Editor (Publish)")).toBeInTheDocument();
    expect(screen.getByText("Pulse (Analytics)")).toBeInTheDocument();
  });

  it("shows Checking badges initially", () => {
    vi.mocked(globalThis.fetch).mockImplementation(
      () => new Promise(() => {})
    );

    render(<ServiceHealth />);

    const checkingBadges = screen.getAllByText("Checking");
    expect(checkingBadges.length).toBe(6);
  });

  it("shows Healthy status for healthy services", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "ok", uptime: "2h 30m" }),
    } as Response);

    render(<ServiceHealth />);

    await waitFor(() => {
      const healthyBadges = screen.getAllByText("Healthy");
      expect(healthyBadges.length).toBe(6);
    });
  });

  it("shows Unhealthy status when fetch fails", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error("Network"));

    render(<ServiceHealth />);

    await waitFor(() => {
      const unhealthyBadges = screen.getAllByText("Unhealthy");
      expect(unhealthyBadges.length).toBe(6);
    });
  });

  it("shows Unhealthy status when response is not ok", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    render(<ServiceHealth />);

    await waitFor(() => {
      const unhealthyBadges = screen.getAllByText("Unhealthy");
      expect(unhealthyBadges.length).toBe(6);
    });
  });

  it("displays uptime when provided by healthy service", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "ok", uptime: "3h 45m" }),
    } as Response);

    render(<ServiceHealth />);

    await waitFor(() => {
      const uptimeElements = screen.getAllByText("Uptime: 3h 45m");
      expect(uptimeElements.length).toBeGreaterThan(0);
    });
  });

  it("displays queue size when provided", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ status: "ok", uptime: "1h", queue_size: 42 }),
    } as Response);

    render(<ServiceHealth />);

    await waitFor(() => {
      const queueLabels = screen.getAllByText("Queue");
      expect(queueLabels.length).toBeGreaterThan(0);
    });
  });

  it("renders auto-refresh note", () => {
    vi.mocked(globalThis.fetch).mockImplementation(
      () => new Promise(() => {})
    );

    render(<ServiceHealth />);

    expect(
      screen.getByText("Auto-refreshes every 30 seconds")
    ).toBeInTheDocument();
  });

  it("renders refresh button", () => {
    vi.mocked(globalThis.fetch).mockImplementation(
      () => new Promise(() => {})
    );

    render(<ServiceHealth />);

    expect(screen.getByTitle("Refresh now")).toBeInTheDocument();
  });
});
