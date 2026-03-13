import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProviderConfig } from "@/components/provider-config";

// Mock api-client
vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({}),
  },
}));

// Mock actions
vi.mock("@/lib/actions", () => ({
  saveProviderConfig: vi.fn().mockResolvedValue({ success: true }),
}));

describe("ProviderConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all four service configs", async () => {
    render(<ProviderConfig />);

    expect(screen.getByText("LLM (Text Generation)")).toBeInTheDocument();
    expect(screen.getByText("Image Generation")).toBeInTheDocument();
    expect(screen.getByText("Video Generation")).toBeInTheDocument();
    expect(screen.getByText("Text-to-Speech")).toBeInTheDocument();
  });

  it("renders provider select dropdowns", () => {
    render(<ProviderConfig />);

    const providerSelects = screen.getAllByLabelText("Provider");
    expect(providerSelects.length).toBe(4);
  });

  it("renders model select dropdowns", () => {
    render(<ProviderConfig />);

    const modelSelects = screen.getAllByLabelText("Model");
    expect(modelSelects.length).toBe(4);
  });

  it("renders Save Configuration buttons for each service", () => {
    render(<ProviderConfig />);

    const saveButtons = screen.getAllByText("Save Configuration");
    expect(saveButtons.length).toBe(4);
  });

  it("shows local models by default for LLM", async () => {
    render(<ProviderConfig />);

    await waitFor(() => {
      const llmModelSelect = screen.getAllByLabelText("Model")[0] as HTMLSelectElement;
      // Default is LOCAL provider so local models should show
      const options = Array.from(llmModelSelect.options);
      const labels = options.map((o) => o.textContent);
      expect(labels).toContain("Llama 3.2");
    });
  });

  it("updates available models when provider changes", () => {
    render(<ProviderConfig />);

    // Change first provider dropdown to CLOUD
    const providerSelects = screen.getAllByLabelText("Provider");
    fireEvent.change(providerSelects[0], { target: { value: "CLOUD" } });

    // Now the model dropdown should show cloud options
    const modelSelects = screen.getAllByLabelText("Model");
    const options = Array.from(
      (modelSelects[0] as HTMLSelectElement).options
    );
    const labels = options.map((o) => o.textContent);
    expect(labels).toContain("GPT-4o");
    expect(labels).not.toContain("Llama 3.2");
  });

  it("calls saveProviderConfig when Save is clicked", async () => {
    const { saveProviderConfig } = await import("@/lib/actions");
    render(<ProviderConfig />);

    const saveButtons = screen.getAllByText("Save Configuration");
    fireEvent.click(saveButtons[0]);

    expect(saveProviderConfig).toHaveBeenCalledWith("llm", "LOCAL", "llama3.2");
  });

  it("shows success message after successful save", async () => {
    render(<ProviderConfig />);

    const saveButtons = screen.getAllByText("Save Configuration");
    fireEvent.click(saveButtons[0]);

    await waitFor(() => {
      expect(
        screen.getByText("LLM (Text Generation) configuration saved.")
      ).toBeInTheDocument();
    });
  });

  it("shows error message when save fails", async () => {
    const { saveProviderConfig } = await import("@/lib/actions");
    vi.mocked(saveProviderConfig).mockResolvedValueOnce({
      success: false,
      error: "Connection refused",
    });

    render(<ProviderConfig />);

    const saveButtons = screen.getAllByText("Save Configuration");
    fireEvent.click(saveButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Connection refused")).toBeInTheDocument();
    });
  });

  it("renders provider options: Local and Cloud", () => {
    render(<ProviderConfig />);

    const providerSelect = screen.getAllByLabelText("Provider")[0] as HTMLSelectElement;
    const options = Array.from(providerSelect.options);
    const labels = options.map((o) => o.textContent);
    expect(labels).toContain("Local (Ollama / ComfyUI)");
    expect(labels).toContain("Cloud (OpenAI / Replicate)");
  });
});
