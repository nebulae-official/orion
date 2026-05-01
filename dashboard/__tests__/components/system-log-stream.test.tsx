import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SystemLogStream } from "@/app/(dashboard)/system/system-log-stream";

describe("SystemLogStream", () => {
  it("renders the System Logs heading", () => {
    render(<SystemLogStream />);
    expect(screen.getByText("System Logs")).toBeInTheDocument();
  });

  it("renders the LIVE chip", () => {
    render(<SystemLogStream />);
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("renders INFO log entries", () => {
    render(<SystemLogStream />);
    const infoEntries = screen.getAllByText("INFO");
    expect(infoEntries.length).toBeGreaterThan(0);
  });

  it("renders WARN log entries", () => {
    render(<SystemLogStream />);
    const warnEntries = screen.getAllByText("WARN");
    expect(warnEntries.length).toBeGreaterThan(0);
  });

  it("renders ERR log entries", () => {
    render(<SystemLogStream />);
    const errEntries = screen.getAllByText("ERR");
    expect(errEntries.length).toBeGreaterThan(0);
  });

  it("renders service names in log entries", () => {
    render(<SystemLogStream />);
    expect(screen.getAllByText("scout").length).toBeGreaterThan(0);
    expect(screen.getAllByText("director").length).toBeGreaterThan(0);
    expect(screen.getAllByText("media").length).toBeGreaterThan(0);
  });

  it("renders timestamps for log entries", () => {
    render(<SystemLogStream />);
    expect(screen.getByText("14:32:07")).toBeInTheDocument();
    expect(screen.getByText("14:31:52")).toBeInTheDocument();
  });

  it("renders log message content", () => {
    render(<SystemLogStream />);
    expect(
      screen.getByText(/trend\.detected topic="#LangGraph"/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/queue\.depth=23 threshold=20 backpressure=true/),
    ).toBeInTheDocument();
  });

  it("renders ten log entries", () => {
    render(<SystemLogStream />);
    // Each entry contains a timestamp; count unique timestamps
    expect(screen.getByText("14:24:18")).toBeInTheDocument();
    expect(screen.getByText("14:25:33")).toBeInTheDocument();
    expect(screen.getByText("14:26:44")).toBeInTheDocument();
    expect(screen.getByText("14:27:01")).toBeInTheDocument();
    expect(screen.getByText("14:28:12")).toBeInTheDocument();
  });
});
