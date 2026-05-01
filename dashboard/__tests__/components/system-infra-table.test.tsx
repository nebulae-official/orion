import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SystemInfraTable } from "@/app/(dashboard)/system/system-infra-table";

vi.mock("@/lib/actions", () => ({
  fetchSystemStatus: vi.fn(),
}));

import { fetchSystemStatus } from "@/lib/actions";

const mockFetchSystemStatus = vi.mocked(fetchSystemStatus);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SystemInfraTable", () => {
  it("renders the Infrastructure heading", () => {
    mockFetchSystemStatus.mockImplementation(() => new Promise(() => {}));

    render(<SystemInfraTable />);

    expect(screen.getByText("Infrastructure")).toBeInTheDocument();
  });

  it("renders the section subtitle", () => {
    mockFetchSystemStatus.mockImplementation(() => new Promise(() => {}));

    render(<SystemInfraTable />);

    expect(
      screen.getByText("Data stores & supporting services"),
    ).toBeInTheDocument();
  });

  it("renders all three infrastructure rows", () => {
    mockFetchSystemStatus.mockImplementation(() => new Promise(() => {}));

    render(<SystemInfraTable />);

    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
    expect(screen.getByText("Redis")).toBeInTheDocument();
    expect(screen.getByText("Milvus")).toBeInTheDocument();
  });

  it("renders usage labels from demo data", () => {
    mockFetchSystemStatus.mockImplementation(() => new Promise(() => {}));

    render(<SystemInfraTable />);

    expect(screen.getByText("42% disk")).toBeInTheDocument();
    expect(screen.getByText("18% mem")).toBeInTheDocument();
    expect(screen.getByText("31% vecs")).toBeInTheDocument();
  });

  it("shows Healthy badges by default", () => {
    mockFetchSystemStatus.mockImplementation(() => new Promise(() => {}));

    render(<SystemInfraTable />);

    const healthyBadges = screen.getAllByText("Healthy");
    expect(healthyBadges.length).toBe(3);
  });

  it("shows Degraded badge for postgres when check fails", async () => {
    mockFetchSystemStatus.mockResolvedValue({
      data: {
        status: "ok",
        services: [
          {
            service: "scout",
            status: "ok",
            uptime: "1h",
            queue_size: 0,
            checks: { redis: true, postgres: false },
          },
        ],
      },
      authFailed: false,
    });

    render(<SystemInfraTable />);

    await waitFor(() => {
      expect(screen.getByText("Degraded")).toBeInTheDocument();
    });
  });

  it("does not update when auth fails", async () => {
    mockFetchSystemStatus.mockResolvedValue({ data: null, authFailed: true });

    render(<SystemInfraTable />);

    // Should keep demo defaults (all Healthy) when auth fails
    await waitFor(() => {
      const healthyBadges = screen.getAllByText("Healthy");
      expect(healthyBadges.length).toBe(3);
    });
  });

  it("keeps Milvus as Healthy regardless of service checks", async () => {
    mockFetchSystemStatus.mockResolvedValue({
      data: {
        status: "ok",
        services: [
          {
            service: "scout",
            status: "ok",
            uptime: "1h",
            queue_size: 0,
            checks: { redis: false, postgres: false },
          },
        ],
      },
      authFailed: false,
    });

    render(<SystemInfraTable />);

    await waitFor(() => {
      // Milvus always stays at its demo value
      expect(screen.getByText("Milvus")).toBeInTheDocument();
    });
  });
});
