import { describe, expect, it } from "vitest";
import { shouldShowSocketErrorToast } from "./useChatSocketEvents";

describe("shouldShowSocketErrorToast", () => {
  it("suppresses toast inside cooldown window", () => {
    expect(shouldShowSocketErrorToast(1000, 5000)).toBe(false);
  });

  it("allows toast after cooldown window", () => {
    expect(shouldShowSocketErrorToast(1000, 9000)).toBe(true);
  });
});
