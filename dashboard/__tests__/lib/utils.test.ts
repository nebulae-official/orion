import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cn, formatRelativeTime, formatDate } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("merges conflicting tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("handles undefined and null inputs", () => {
    expect(cn("foo", undefined, null, "bar")).toBe("foo bar");
  });
});

describe("formatDate", () => {
  it("formats a date string", () => {
    const result = formatDate("2025-01-15T10:30:00Z");
    expect(result).toContain("Jan");
    expect(result).toContain("15");
    expect(result).toContain("2025");
  });

  it("formats a Date object", () => {
    const result = formatDate(new Date("2025-06-01T14:00:00Z"));
    expect(result).toContain("Jun");
    expect(result).toContain("1");
    expect(result).toContain("2025");
  });
});

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-13T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for times less than a minute ago', () => {
    const result = formatRelativeTime("2025-03-13T11:59:45Z");
    expect(result).toBe("just now");
  });

  it("returns minutes ago for times less than an hour", () => {
    const result = formatRelativeTime("2025-03-13T11:30:00Z");
    expect(result).toBe("30m ago");
  });

  it("returns hours ago for times less than a day", () => {
    const result = formatRelativeTime("2025-03-13T06:00:00Z");
    expect(result).toBe("6h ago");
  });

  it("returns days ago for times less than a week", () => {
    const result = formatRelativeTime("2025-03-10T12:00:00Z");
    expect(result).toBe("3d ago");
  });

  it("returns formatted date for times older than a week", () => {
    const result = formatRelativeTime("2025-02-01T12:00:00Z");
    expect(result).toContain("Feb");
    expect(result).toContain("1");
    expect(result).toContain("2025");
  });
});
