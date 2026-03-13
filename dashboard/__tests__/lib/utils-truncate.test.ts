import { describe, it, expect } from "vitest";
import { truncate } from "@/lib/utils";

describe("truncate", () => {
  it("returns the original string if shorter than max length", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("returns the original string if exactly max length", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("truncates and adds ellipsis when string exceeds max length", () => {
    expect(truncate("hello world", 5)).toBe("hello...");
  });

  it("handles empty string", () => {
    expect(truncate("", 5)).toBe("");
  });

  it("truncates to single character with ellipsis", () => {
    expect(truncate("hello", 1)).toBe("h...");
  });

  it("handles zero length", () => {
    expect(truncate("hello", 0)).toBe("...");
  });
});
