import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { GpuGauge } from "@/components/gpu-gauge";

// Mock config to disable demo mode
vi.mock("@/lib/config", () => ({
  DEMO_MODE: false,
  GATEWAY_URL: "http://localhost:8000",
}));

vi.mock("@/lib/demo-data", () => ({
  demoGpuInfo: [],
}));

const mockGpuData = {
  gpus: [
    {
      name: "NVIDIA RTX 4090",
      vram_total_mb: 24576,
      vram_used_mb: 8192,
      vram_free_mb: 16384,
      utilization_percent: 45,
      temperature_c: 65,
      power_draw_w: null,
      clock_gpu_mhz: null,
      clock_mem_mhz: null,
      fan_speed_percent: null,
      driver_version: "",
      cuda_version: "",
    },
  ],
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("GpuGauge", () => {
  it("shows loading state initially", () => {
    vi.mocked(globalThis.fetch).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<GpuGauge />);

    expect(screen.getByText("GPU Status")).toBeInTheDocument();
  });

  it("displays GPU info after successful fetch", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockGpuData),
    } as Response);

    render(<GpuGauge />);

    await waitFor(() => {
      expect(screen.getByText("NVIDIA RTX 4090")).toBeInTheDocument();
    });

    // 45% appears in both the utilization badge and detail metrics
    expect(screen.getAllByText("45%").length).toBeGreaterThanOrEqual(1);
  });

  it("displays temperature when available", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockGpuData),
    } as Response);

    render(<GpuGauge />);

    await waitFor(() => {
      // Temperature appears in both the summary badge and detail metrics
      expect(screen.getAllByText("65°C").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("does not display temperature when null", async () => {
    const noTempData = {
      gpus: [
        { ...mockGpuData.gpus[0], temperature_c: null },
      ],
    };
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(noTempData),
    } as Response);

    render(<GpuGauge />);

    await waitFor(() => {
      expect(screen.getByText("NVIDIA RTX 4090")).toBeInTheDocument();
    });

    expect(screen.queryByText("Temperature")).not.toBeInTheDocument();
  });

  it("shows error message when fetch fails", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error("Network"));

    render(<GpuGauge />);

    await waitFor(() => {
      expect(screen.getByText("Failed to fetch GPU info")).toBeInTheDocument();
    });
  });

  it("shows error message when response is not ok", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    render(<GpuGauge />);

    await waitFor(() => {
      expect(screen.getByText("GPU info unavailable")).toBeInTheDocument();
    });
  });

  it("displays auto-refresh note", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockGpuData),
    } as Response);

    render(<GpuGauge />);

    expect(screen.getByText("Auto-refreshes every 1 second")).toBeInTheDocument();
  });

  it("renders the GPU Status heading", () => {
    vi.mocked(globalThis.fetch).mockImplementation(
      () => new Promise(() => {})
    );

    render(<GpuGauge />);

    expect(screen.getByText("GPU Status")).toBeInTheDocument();
  });

  it("renders refresh button", () => {
    vi.mocked(globalThis.fetch).mockImplementation(
      () => new Promise(() => {})
    );

    render(<GpuGauge />);

    expect(screen.getByTitle("Refresh")).toBeInTheDocument();
  });

  it("calculates VRAM percentage correctly", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockGpuData),
    } as Response);

    render(<GpuGauge />);

    // 8192 / 24576 * 100 = 33.33... => rounded to 33%
    // May appear in both the VRAM bar and gauge ring
    await waitFor(() => {
      expect(screen.getAllByText("33%").length).toBeGreaterThanOrEqual(1);
    });
  });
});
