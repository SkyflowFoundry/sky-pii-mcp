import { describe, it, expect } from "vitest";
import {
  extractBearerToken,
  extractApiKey,
  extractCredentials,
} from "../../../src/lib/middleware/authenticateBearer";

describe("Credentials Authentication", () => {
  describe("extractBearerToken()", () => {
    describe("valid tokens", () => {
      it("should extract token from valid Bearer header", () => {
        const result = extractBearerToken("Bearer abc123xyz");

        expect(result.isPresent).toBe(true);
        expect(result.token).toBe("abc123xyz");
        expect(result.error).toBeUndefined();
      });

      it("should handle tokens with special characters", () => {
        const result = extractBearerToken("Bearer abc-123_xyz.token");

        expect(result.isPresent).toBe(true);
        expect(result.token).toBe("abc-123_xyz.token");
      });

      it("should handle long tokens", () => {
        const longToken = "a".repeat(500);
        const result = extractBearerToken(`Bearer ${longToken}`);

        expect(result.isPresent).toBe(true);
        expect(result.token).toBe(longToken);
      });

      it("should handle tokens with spaces in the token value", () => {
        // Some tokens might have spaces (though uncommon)
        const result = extractBearerToken("Bearer token with spaces");

        expect(result.isPresent).toBe(true);
        expect(result.token).toBe("token with spaces");
      });
    });

    describe("missing or invalid headers", () => {
      it("should return error for undefined header", () => {
        const result = extractBearerToken(undefined);

        expect(result.isPresent).toBe(false);
        expect(result.token).toBeUndefined();
        expect(result.error).toBe("Missing or invalid Authorization header");
      });

      it("should return error for empty string header", () => {
        const result = extractBearerToken("");

        expect(result.isPresent).toBe(false);
        expect(result.error).toBe("Missing or invalid Authorization header");
      });

      it("should return error for header without Bearer prefix", () => {
        const result = extractBearerToken("abc123xyz");

        expect(result.isPresent).toBe(false);
        expect(result.error).toBe("Missing or invalid Authorization header");
      });

      it("should return error for wrong auth scheme", () => {
        const result = extractBearerToken("Basic abc123xyz");

        expect(result.isPresent).toBe(false);
        expect(result.error).toBe("Missing or invalid Authorization header");
      });

      it("should return error for case-sensitive Bearer", () => {
        const result = extractBearerToken("bearer abc123xyz"); // lowercase

        expect(result.isPresent).toBe(false);
        expect(result.error).toBe("Missing or invalid Authorization header");
      });
    });

    describe("empty tokens", () => {
      it("should return error for Bearer with no token", () => {
        const result = extractBearerToken("Bearer ");

        expect(result.isPresent).toBe(false);
        expect(result.token).toBeUndefined();
        expect(result.error).toBe("Bearer token is empty");
      });

      it("should return error for Bearer with only whitespace", () => {
        const result = extractBearerToken("Bearer    ");

        expect(result.isPresent).toBe(false);
        expect(result.error).toBe("Bearer token is empty");
      });

      it("should return error for Bearer with tabs", () => {
        const result = extractBearerToken("Bearer \t\t");

        expect(result.isPresent).toBe(false);
        expect(result.error).toBe("Bearer token is empty");
      });
    });

    describe("edge cases", () => {
      it("should handle Bearer prefix with extra spaces", () => {
        // Note: According to RFC 7235, there should be exactly one space
        // But we're lenient and accept "Bearer  token" (2 spaces)
        const result = extractBearerToken("Bearer  abc123");

        // The token will be " abc123" (with leading space)
        expect(result.isPresent).toBe(true);
        expect(result.token).toBe(" abc123");
      });

      it("should handle minimum length token", () => {
        const result = extractBearerToken("Bearer a");

        expect(result.isPresent).toBe(true);
        expect(result.token).toBe("a");
      });

      it("should not trim token value", () => {
        const result = extractBearerToken("Bearer  token  ");

        expect(result.isPresent).toBe(true);
        expect(result.token).toBe(" token  ");
      });
    });
  });

  describe("extractApiKey()", () => {
    describe("valid API keys", () => {
      it("should extract API key from valid parameter", () => {
        const result = extractApiKey("my-api-key-123");

        expect(result.isPresent).toBe(true);
        expect(result.token).toBe("my-api-key-123");
        expect(result.error).toBeUndefined();
      });

      it("should handle API keys with special characters", () => {
        const result = extractApiKey("api_key-with.special-chars_123");

        expect(result.isPresent).toBe(true);
        expect(result.token).toBe("api_key-with.special-chars_123");
      });

      it("should handle long API keys", () => {
        const longKey = "k".repeat(500);
        const result = extractApiKey(longKey);

        expect(result.isPresent).toBe(true);
        expect(result.token).toBe(longKey);
      });

      it("should trim whitespace from API keys", () => {
        const result = extractApiKey("  my-api-key  ");

        expect(result.isPresent).toBe(true);
        expect(result.token).toBe("my-api-key");
      });
    });

    describe("missing or invalid API keys", () => {
      it("should return error for undefined parameter", () => {
        const result = extractApiKey(undefined);

        expect(result.isPresent).toBe(false);
        expect(result.token).toBeUndefined();
        expect(result.error).toBe("Missing or invalid apiKey query parameter");
      });

      it("should return error for empty string", () => {
        const result = extractApiKey("");

        expect(result.isPresent).toBe(false);
        expect(result.error).toBe("Missing or invalid apiKey query parameter");
      });

      it("should return error for whitespace-only string", () => {
        const result = extractApiKey("   ");

        expect(result.isPresent).toBe(false);
        expect(result.error).toBe("API key is empty");
      });
    });
  });

  describe("extractCredentials()", () => {
    describe("bearer token takes precedence", () => {
      it("should use bearer token when both are provided", () => {
        const result = extractCredentials("Bearer token123", "api-key-456");

        expect(result.isPresent).toBe(true);
        expect(result.credentials).toEqual({ token: "token123" });
      });

      it("should use bearer token when only bearer is provided", () => {
        const result = extractCredentials("Bearer token123", undefined);

        expect(result.isPresent).toBe(true);
        expect(result.credentials).toEqual({ token: "token123" });
      });
    });

    describe("API key fallback", () => {
      it("should use API key when bearer token is missing", () => {
        const result = extractCredentials(undefined, "api-key-456");

        expect(result.isPresent).toBe(true);
        expect(result.credentials).toEqual({ apiKey: "api-key-456" });
      });

      it("should use API key when bearer token is invalid", () => {
        const result = extractCredentials("InvalidAuth", "api-key-456");

        expect(result.isPresent).toBe(true);
        expect(result.credentials).toEqual({ apiKey: "api-key-456" });
      });

      it("should use API key when bearer token is empty", () => {
        const result = extractCredentials("Bearer ", "api-key-456");

        expect(result.isPresent).toBe(true);
        expect(result.credentials).toEqual({ apiKey: "api-key-456" });
      });
    });

    describe("both credentials missing or invalid", () => {
      it("should return error when both are undefined", () => {
        const result = extractCredentials(undefined, undefined);

        expect(result.isPresent).toBe(false);
        expect(result.credentials).toBeUndefined();
        expect(result.error).toBe(
          "Missing or invalid credentials. Provide either Authorization header with Bearer token or apiKey query parameter."
        );
      });

      it("should return error when both are invalid", () => {
        const result = extractCredentials("InvalidAuth", "");

        expect(result.isPresent).toBe(false);
        expect(result.credentials).toBeUndefined();
        expect(result.error).toBe(
          "Missing or invalid credentials. Provide either Authorization header with Bearer token or apiKey query parameter."
        );
      });

      it("should return error when bearer is empty and apiKey is whitespace", () => {
        const result = extractCredentials("Bearer ", "   ");

        expect(result.isPresent).toBe(false);
        expect(result.error).toBe(
          "Missing or invalid credentials. Provide either Authorization header with Bearer token or apiKey query parameter."
        );
      });
    });

    describe("credential format validation", () => {
      it("should return credentials in Skyflow token format", () => {
        const result = extractCredentials("Bearer my-token", undefined);

        expect(result.credentials).toEqual({ token: "my-token" });
        expect(result.credentials).toHaveProperty("token");
        expect(result.credentials).not.toHaveProperty("apiKey");
      });

      it("should return credentials in Skyflow apiKey format", () => {
        const result = extractCredentials(undefined, "my-api-key");

        expect(result.credentials).toEqual({ apiKey: "my-api-key" });
        expect(result.credentials).toHaveProperty("apiKey");
        expect(result.credentials).not.toHaveProperty("token");
      });
    });
  });
});
