import { describe, it, expect } from "vitest";
import {
  extractClusterId,
  validateVaultConfig,
} from "../../../src/lib/validation/vaultConfig";

describe("Vault Configuration Validation", () => {
  describe("extractClusterId()", () => {
    it("should extract cluster ID from valid vault URLs", () => {
      expect(extractClusterId("https://abc123.vault.skyflowapis.com")).toBe(
        "abc123"
      );
      expect(extractClusterId("https://test-cluster.vault.skyflowapis.com")).toBe(
        "test-cluster"
      );
      expect(extractClusterId("https://prod-123.vault.example.com")).toBe(
        "prod-123"
      );
    });

    it("should return null for invalid vault URLs", () => {
      expect(extractClusterId("https://example.com")).toBeNull();
      expect(extractClusterId("http://abc123.vault.skyflowapis.com")).toBeNull(); // http not https
      expect(extractClusterId("not-a-url")).toBeNull();
      expect(extractClusterId("")).toBeNull();
    });

    it("should handle URLs with additional paths", () => {
      expect(
        extractClusterId("https://abc123.vault.skyflowapis.com/path/to/resource")
      ).toBe("abc123");
    });
  });

  describe("validateVaultConfig()", () => {
    describe("successful validation", () => {
      it("should return valid result with complete config", () => {
        const result = validateVaultConfig({
          vaultId: "vault123",
          vaultUrl: "https://abc123.vault.skyflowapis.com",
          accountId: "acc456",
          workspaceId: "ws789",
        });

        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.config).toEqual({
          vaultId: "vault123",
          vaultUrl: "https://abc123.vault.skyflowapis.com",
          clusterId: "abc123",
          accountId: "acc456",
          workspaceId: "ws789",
        });
      });

      it("should return valid result with only required fields", () => {
        const result = validateVaultConfig({
          vaultId: "vault123",
          vaultUrl: "https://abc123.vault.skyflowapis.com",
        });

        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.config).toEqual({
          vaultId: "vault123",
          vaultUrl: "https://abc123.vault.skyflowapis.com",
          clusterId: "abc123",
          accountId: undefined,
          workspaceId: undefined,
        });
      });
    });

    describe("missing vaultId", () => {
      it("should return error when vaultId is missing", () => {
        const result = validateVaultConfig({
          vaultUrl: "https://abc123.vault.skyflowapis.com",
        });

        expect(result.isValid).toBe(false);
        expect(result.error).toBe(
          "vaultId is required (provide as query parameter or VAULT_ID environment variable)"
        );
        expect(result.config).toBeUndefined();
      });

      it("should return error when vaultId is empty string", () => {
        const result = validateVaultConfig({
          vaultId: "",
          vaultUrl: "https://abc123.vault.skyflowapis.com",
        });

        expect(result.isValid).toBe(false);
        expect(result.error).toContain("vaultId is required");
      });
    });

    describe("missing vaultUrl", () => {
      it("should return error when vaultUrl is missing", () => {
        const result = validateVaultConfig({
          vaultId: "vault123",
        });

        expect(result.isValid).toBe(false);
        expect(result.error).toBe(
          "vaultUrl is required (provide as query parameter or VAULT_URL environment variable)"
        );
        expect(result.config).toBeUndefined();
      });

      it("should return error when vaultUrl is empty string", () => {
        const result = validateVaultConfig({
          vaultId: "vault123",
          vaultUrl: "",
        });

        expect(result.isValid).toBe(false);
        expect(result.error).toContain("vaultUrl is required");
      });
    });

    describe("invalid vaultUrl format", () => {
      it("should return error for invalid vault URL format", () => {
        const result = validateVaultConfig({
          vaultId: "vault123",
          vaultUrl: "https://invalid.com",
        });

        expect(result.isValid).toBe(false);
        expect(result.error).toBe(
          "Invalid vaultUrl format. Expected format: https://<clusterId>.vault.skyflowapis.com"
        );
        expect(result.config).toBeUndefined();
      });

      it("should return error for http (not https) URLs", () => {
        const result = validateVaultConfig({
          vaultId: "vault123",
          vaultUrl: "http://abc123.vault.skyflowapis.com",
        });

        expect(result.isValid).toBe(false);
        expect(result.error).toContain("Invalid vaultUrl format");
      });

      it("should return error for malformed URLs", () => {
        const result = validateVaultConfig({
          vaultId: "vault123",
          vaultUrl: "not-a-url",
        });

        expect(result.isValid).toBe(false);
        expect(result.error).toContain("Invalid vaultUrl format");
      });
    });

    describe("edge cases", () => {
      it("should handle all undefined parameters", () => {
        const result = validateVaultConfig({});

        expect(result.isValid).toBe(false);
        expect(result.error).toContain("vaultId is required");
      });

      it("should preserve optional fields when provided", () => {
        const result = validateVaultConfig({
          vaultId: "vault123",
          vaultUrl: "https://abc123.vault.skyflowapis.com",
          accountId: "account",
          workspaceId: "workspace",
        });

        expect(result.isValid).toBe(true);
        expect(result.config?.accountId).toBe("account");
        expect(result.config?.workspaceId).toBe("workspace");
      });
    });
  });
});
