import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ApiKeysPanel } from "@/components/settings/settings-api-keys-panel";

vi.mock("@/lib/config", () => ({ DEMO_MODE: true }));

describe("ApiKeysPanel", () => {
  describe("section headings", () => {
    it("renders the API Keys section heading", () => {
      render(<ApiKeysPanel />);
      expect(screen.getByText("API Keys")).toBeInTheDocument();
    });

    it("renders the Pipeline Configuration section heading", () => {
      render(<ApiKeysPanel />);
      expect(screen.getByText("Pipeline Configuration")).toBeInTheDocument();
    });

    it("renders the Automation Toggles section heading", () => {
      render(<ApiKeysPanel />);
      expect(screen.getByText("Automation Toggles")).toBeInTheDocument();
    });
  });

  describe("API key rows", () => {
    it("renders all four provider rows", () => {
      render(<ApiKeysPanel />);
      expect(screen.getByText("Anthropic (Claude)")).toBeInTheDocument();
      expect(screen.getByText("Fal.ai (Image Gen)")).toBeInTheDocument();
      expect(screen.getByText("ElevenLabs (TTS)")).toBeInTheDocument();
      expect(screen.getByText("Twitter / X")).toBeInTheDocument();
    });

    it("shows Active badge for the three configured providers", () => {
      render(<ApiKeysPanel />);
      const activeBadges = screen.getAllByText("Active");
      expect(activeBadges).toHaveLength(3);
    });

    it("shows Missing badge for Twitter / X", () => {
      render(<ApiKeysPanel />);
      expect(screen.getByText("Missing")).toBeInTheDocument();
    });

    it("shows Edit button for active providers", () => {
      render(<ApiKeysPanel />);
      const editButtons = screen.getAllByText("Edit");
      expect(editButtons).toHaveLength(3);
    });

    it("shows Connect button for missing provider", () => {
      render(<ApiKeysPanel />);
      expect(screen.getByText("Connect")).toBeInTheDocument();
    });

    it("shows masked key values for active providers", () => {
      render(<ApiKeysPanel />);
      expect(screen.getByText("sk-ant-••••••••••••3a9f")).toBeInTheDocument();
      expect(screen.getByText("fal-••••••••••••8c2d")).toBeInTheDocument();
      expect(screen.getByText("el-••••••••••••1f7a")).toBeInTheDocument();
    });

    it("shows Not configured for missing provider", () => {
      render(<ApiKeysPanel />);
      expect(screen.getByText("Not configured")).toBeInTheDocument();
    });
  });

  describe("pipeline configuration fields", () => {
    it("renders Target Niche field", () => {
      render(<ApiKeysPanel />);
      expect(screen.getByText("Target Niche")).toBeInTheDocument();
    });

    it("renders Max concurrent jobs field", () => {
      render(<ApiKeysPanel />);
      expect(screen.getByText("Max concurrent jobs")).toBeInTheDocument();
    });

    it("renders Image provider field", () => {
      render(<ApiKeysPanel />);
      expect(screen.getByText("Image provider")).toBeInTheDocument();
    });

    it("renders LLM Model field", () => {
      render(<ApiKeysPanel />);
      expect(screen.getByText("LLM Model")).toBeInTheDocument();
    });

    it("defaults max jobs to 5", () => {
      render(<ApiKeysPanel />);
      const input = screen.getByDisplayValue("5");
      expect(input).toBeInTheDocument();
    });
  });

  describe("automation toggles", () => {
    it("renders all four toggle labels", () => {
      render(<ApiKeysPanel />);
      // Each label appears in both the visible <p> and the sr-only button span.
      expect(
        screen.getAllByText("Auto-approve high-confidence content")
      ).not.toHaveLength(0);
      expect(
        screen.getAllByText("Daily publish cadence")
      ).not.toHaveLength(0);
      expect(
        screen.getAllByText("Content safety checks")
      ).not.toHaveLength(0);
      expect(
        screen.getAllByText("Local LLM fallback (Ollama)")
      ).not.toHaveLength(0);
    });

    it("renders three toggles as on and one as off by default", () => {
      render(<ApiKeysPanel />);
      const switches = screen.getAllByRole("switch");
      const onCount = switches.filter(
        (s) => s.getAttribute("aria-checked") === "true"
      ).length;
      const offCount = switches.filter(
        (s) => s.getAttribute("aria-checked") === "false"
      ).length;
      expect(onCount).toBe(3);
      expect(offCount).toBe(1);
    });

    it("toggles a switch when clicked", () => {
      render(<ApiKeysPanel />);
      const localLlmSwitch = screen.getByRole("switch", {
        name: /Local LLM fallback/i,
      });
      expect(localLlmSwitch).toHaveAttribute("aria-checked", "false");
      fireEvent.click(localLlmSwitch);
      expect(localLlmSwitch).toHaveAttribute("aria-checked", "true");
    });

    it("toggles an on switch to off when clicked", () => {
      render(<ApiKeysPanel />);
      const safetySwitch = screen.getByRole("switch", {
        name: /Content safety checks/i,
      });
      expect(safetySwitch).toHaveAttribute("aria-checked", "true");
      fireEvent.click(safetySwitch);
      expect(safetySwitch).toHaveAttribute("aria-checked", "false");
    });
  });

  describe("footer actions", () => {
    it("renders the Discard button", () => {
      render(<ApiKeysPanel />);
      expect(screen.getByText("Discard")).toBeInTheDocument();
    });

    it("renders the Save changes button", () => {
      render(<ApiKeysPanel />);
      expect(screen.getByText("Save changes")).toBeInTheDocument();
    });

    it("shows Saved! briefly after clicking Save changes", async () => {
      vi.useFakeTimers();
      render(<ApiKeysPanel />);
      fireEvent.click(screen.getByText("Save changes"));
      expect(screen.getByText("Saved!")).toBeInTheDocument();
      vi.runAllTimers();
      vi.useRealTimers();
    });

    it("resets pipeline fields to defaults when Discard is clicked", () => {
      render(<ApiKeysPanel />);
      const maxJobsInput = screen.getByDisplayValue("5") as HTMLInputElement;
      fireEvent.change(maxJobsInput, { target: { value: "10" } });
      expect(screen.getByDisplayValue("10")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Discard"));
      expect(screen.getByDisplayValue("5")).toBeInTheDocument();
    });
  });
});
