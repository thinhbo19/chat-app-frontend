import { describe, expect, it } from "vitest";
import { getApiErrorMessage } from "./apiError";

describe("getApiErrorMessage", () => {
  it("returns nested API error message first", () => {
    const result = getApiErrorMessage(
      { response: { data: { error: { message: "Nested error" }, message: "Fallback data message" } } },
      "Default fallback",
    );
    expect(result).toBe("Nested error");
  });
});
