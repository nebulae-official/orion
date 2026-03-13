import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { GpuGauge } from "@/components/gpu-gauge";

const mockGpuData = {
  name: "NVIDIA RTX 4090",
  vram_total_mb: 24576,
  vram_used_mb: 8192,
  vram_free_mb: 16384,
  utilization_percent: 45,
  temperature_c: 65,
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
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

    expect(screen.getByText("45%")).toBeInTheDocument();
    expect(screen.getByText(/8192/)).toBeInTheDocument();
    expect(screen.getByText(/24576/)).toBeInTheDocument();
  });

  it("displays temperature when available", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockGpuData),
    } as Response);

    render(<GpuGauge />);

    await waitFor(() => {
      expect(screen.getByText("65°C")).toBeInTheDocument();
    });
  });

  it("does not display temperature when null", async () => {
    const noTempData = { ...mockGpuData, temperature_c: null };
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

    expect(screen.getByText("Auto-refreshes every 30 seconds")).toBeInTheDocument();
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
    await waitFor(() => {
      expect(screen.getByText("33%")).toBeInTheDocument();
    });
  });
});
