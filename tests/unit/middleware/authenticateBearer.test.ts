import { describe, it, expect } from "vitest";
import { extractBearerToken } from "../../../src/lib/middleware/authenticateBearer";

describe("Bearer Token Authentication", () => {
  describe("extractBearerToken()", () => {
    describe("valid tokens", () => {
      it("should extract token from valid Bearer header", () => {
        const result = extractBearerToken("Bearer abc123xyz");

        expect(result.isValid).toBe(true);
        expect(result.token).toBe("abc123xyz");
        expect(result.error).toBeUndefined();
      });

      it("should handle tokens with special characters", () => {
        const result = extractBearerToken("Bearer abc-123_xyz.token");

        expect(result.isValid).toBe(true);
        expect(result.token).toBe("abc-123_xyz.token");
      });

      it("should handle long tokens", () => {
        const longToken = "a".repeat(500);
        const result = extractBearerToken(`Bearer ${longToken}`);

        expect(result.isValid).toBe(true);
        expect(result.token).toBe(longToken);
      });

      it("should handle tokens with spaces in the token value", () => {
        // Some tokens might have spaces (though uncommon)
        const result = extractBearerToken("Bearer token with spaces");

        expect(result.isValid).toBe(true);
        expect(result.token).toBe("token with spaces");
      });
    });

    describe("missing or invalid headers", () => {
      it("should return error for undefined header", () => {
        const result = extractBearerToken(undefined);

        expect(result.isValid).toBe(false);
        expect(result.token).toBeUndefined();
        expect(result.error).toBe("Missing or invalid Authorization header");
      });

      it("should return error for empty string header", () => {
        const result = extractBearerToken("");

        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Missing or invalid Authorization header");
      });

      it("should return error for header without Bearer prefix", () => {
        const result = extractBearerToken("abc123xyz");

        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Missing or invalid Authorization header");
      });

      it("should return error for wrong auth scheme", () => {
        const result = extractBearerToken("Basic abc123xyz");

        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Missing or invalid Authorization header");
      });

      it("should return error for case-sensitive Bearer", () => {
        const result = extractBearerToken("bearer abc123xyz"); // lowercase

        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Missing or invalid Authorization header");
      });
    });

    describe("empty tokens", () => {
      it("should return error for Bearer with no token", () => {
        const result = extractBearerToken("Bearer ");

        expect(result.isValid).toBe(false);
        expect(result.token).toBeUndefined();
        expect(result.error).toBe("Bearer token is empty");
      });

      it("should return error for Bearer with only whitespace", () => {
        const result = extractBearerToken("Bearer    ");

        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Bearer token is empty");
      });

      it("should return error for Bearer with tabs", () => {
        const result = extractBearerToken("Bearer \t\t");

        expect(result.isValid).toBe(false);
        expect(result.error).toBe("Bearer token is empty");
      });
    });

    describe("edge cases", () => {
      it("should handle Bearer prefix with extra spaces", () => {
        // Note: According to RFC 7235, there should be exactly one space
        // But we're lenient and accept "Bearer  token" (2 spaces)
        const result = extractBearerToken("Bearer  abc123");

        // The token will be " abc123" (with leading space)
        expect(result.isValid).toBe(true);
        expect(result.token).toBe(" abc123");
      });

      it("should handle minimum length token", () => {
        const result = extractBearerToken("Bearer a");

        expect(result.isValid).toBe(true);
        expect(result.token).toBe("a");
      });

      it("should not trim token value", () => {
        const result = extractBearerToken("Bearer  token  ");

        expect(result.isValid).toBe(true);
        expect(result.token).toBe(" token  ");
      });
    });
  });
});
