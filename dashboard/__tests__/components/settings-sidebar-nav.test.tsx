import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsSidebarNav } from "@/components/settings/settings-sidebar-nav";

describe("SettingsSidebarNav", () => {
  it("renders all five navigation items", () => {
    render(
      <SettingsSidebarNav activePanel="api-keys" onNavigate={vi.fn()} />
    );

    expect(screen.getByText("API Keys")).toBeInTheDocument();
    expect(screen.getByText("Providers")).toBeInTheDocument();
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });

  it("renders Configuration and Account group labels", () => {
    render(
      <SettingsSidebarNav activePanel="api-keys" onNavigate={vi.fn()} />
    );

    expect(screen.getByText("Configuration")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
  });

  it("marks the active panel with aria-current=page", () => {
    render(
      <SettingsSidebarNav activePanel="pipeline" onNavigate={vi.fn()} />
    );

    const pipelineButton = screen.getByText("Pipeline").closest("button");
    expect(pipelineButton).toHaveAttribute("aria-current", "page");
  });

  it("does not mark non-active items as aria-current", () => {
    render(
      <SettingsSidebarNav activePanel="api-keys" onNavigate={vi.fn()} />
    );

    const providersButton = screen.getByText("Providers").closest("button");
    expect(providersButton).not.toHaveAttribute("aria-current");
  });

  it("calls onNavigate with the correct panel id when clicked", () => {
    const onNavigate = vi.fn();
    render(
      <SettingsSidebarNav activePanel="api-keys" onNavigate={onNavigate} />
    );

    fireEvent.click(screen.getByText("Profile"));
    expect(onNavigate).toHaveBeenCalledWith("profile");
  });

  it("calls onNavigate with notifications when Notifications is clicked", () => {
    const onNavigate = vi.fn();
    render(
      <SettingsSidebarNav activePanel="api-keys" onNavigate={onNavigate} />
    );

    fireEvent.click(screen.getByText("Notifications"));
    expect(onNavigate).toHaveBeenCalledWith("notifications");
  });

  it("applies active style class to the active panel item", () => {
    render(
      <SettingsSidebarNav activePanel="providers" onNavigate={vi.fn()} />
    );

    const providersButton = screen.getByText("Providers").closest("button");
    expect(providersButton?.className).toContain("bg-primary-surface");
  });

  it("renders the settings navigation landmark", () => {
    render(
      <SettingsSidebarNav activePanel="api-keys" onNavigate={vi.fn()} />
    );

    expect(
      screen.getByRole("navigation", { name: "Settings navigation" })
    ).toBeInTheDocument();
  });
});
