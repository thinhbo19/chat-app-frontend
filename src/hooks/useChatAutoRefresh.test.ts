import { describe, expect, it } from "vitest";
import { shouldRunChatPolling } from "./useChatAutoRefresh";

describe("shouldRunChatPolling", () => {
  it("returns false when tab is hidden", () => {
    expect(shouldRunChatPolling("hidden", false)).toBe(false);
  });

  it("returns false when socket is connected", () => {
    expect(shouldRunChatPolling("visible", true)).toBe(false);
  });

  it("returns true only when visible and socket disconnected", () => {
    expect(shouldRunChatPolling("visible", false)).toBe(true);
  });
});
