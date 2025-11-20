import type { Request, Response, NextFunction } from "express";

export interface TokenExtractionResult {
  isValid: boolean;
  token?: string;
  error?: string;
}

export interface CredentialsExtractionResult {
  isValid: boolean;
  credentials?: { token: string } | { apiKey: string };
  error?: string;
}

/**
 * Extract and validate bearer token from Authorization header
 * Pure function for easier testing
 *
 * @param authHeader - The Authorization header value
 * @returns TokenExtractionResult with isValid, optional token, and optional error
 *
 * @example
 * extractBearerToken("Bearer abc123") // => { isValid: true, token: "abc123" }
 * extractBearerToken("Invalid") // => { isValid: false, error: "..." }
 * extractBearerToken(undefined) // => { isValid: false, error: "..." }
 */
export function extractBearerToken(
  authHeader: string | undefined
): TokenExtractionResult {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      isValid: false,
      error: "Missing or invalid Authorization header",
    };
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  if (!token || token.trim().length === 0) {
    return {
      isValid: false,
      error: "Bearer token is empty",
    };
  }

  return {
    isValid: true,
    token,
  };
}

/**
 * Extract and validate API key from query parameter
 * Pure function for easier testing
 *
 * @param apiKeyParam - The apiKey query parameter value
 * @returns TokenExtractionResult with isValid, optional token (apiKey), and optional error
 *
 * @example
 * extractApiKey("my-api-key-123") // => { isValid: true, token: "my-api-key-123" }
 * extractApiKey("") // => { isValid: false, error: "..." }
 * extractApiKey(undefined) // => { isValid: false, error: "..." }
 */
export function extractApiKey(
  apiKeyParam: string | undefined
): TokenExtractionResult {
  if (!apiKeyParam || typeof apiKeyParam !== "string") {
    return {
      isValid: false,
      error: "Missing or invalid apiKey query parameter",
    };
  }

  const apiKey = apiKeyParam.trim();

  if (apiKey.length === 0) {
    return {
      isValid: false,
      error: "API key is empty",
    };
  }

  return {
    isValid: true,
    token: apiKey,
  };
}

/**
 * Extract credentials from either Authorization header (bearer token) or query parameter (API key)
 * Tries header first, then falls back to query parameter
 *
 * @param authHeader - The Authorization header value
 * @param apiKeyParam - The apiKey query parameter value
 * @returns CredentialsExtractionResult with credentials in Skyflow SDK format
 *
 * @example
 * extractCredentials("Bearer abc123", undefined)
 * // => { isValid: true, credentials: { token: "abc123" } }
 *
 * extractCredentials(undefined, "my-api-key")
 * // => { isValid: true, credentials: { apiKey: "my-api-key" } }
 *
 * extractCredentials(undefined, undefined)
 * // => { isValid: false, error: "..." }
 */
export function extractCredentials(
  authHeader: string | undefined,
  apiKeyParam: string | undefined
): CredentialsExtractionResult {
  // Try bearer token from header first
  const bearerResult = extractBearerToken(authHeader);
  if (bearerResult.isValid && bearerResult.token) {
    return {
      isValid: true,
      credentials: { token: bearerResult.token },
    };
  }

  // Fallback to API key from query parameter
  const apiKeyResult = extractApiKey(apiKeyParam);
  if (apiKeyResult.isValid && apiKeyResult.token) {
    return {
      isValid: true,
      credentials: { apiKey: apiKeyResult.token },
    };
  }

  // Both failed
  return {
    isValid: false,
    error: "Missing or invalid credentials. Provide either Authorization header with Bearer token or apiKey query parameter.",
  };
}

/**
 * Express middleware for credentials authentication
 * Supports both bearer token (from Authorization header) and API key (from query parameter)
 * Bearer token takes precedence if both are provided
 */
export function authenticateBearer(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Debug logging - indicate presence without logging sensitive values
  console.log("Auth Debug:", {
    authHeader: req.headers.authorization ? "present" : "missing",
    apiKeyQuery: req.query.apiKey ? "present" : "missing",
    vaultId: req.query.vaultId,
    vaultUrl: req.query.vaultUrl,
    path: req.path,
  });

  const result = extractCredentials(
    req.headers.authorization,
    req.query.apiKey as string | undefined
  );

  if (!result.isValid) {
    console.log("Auth failed:", result.error);
    return res.status(401).json({ error: result.error });
  }

  console.log("Auth succeeded with credential type:",
    result.credentials && "token" in result.credentials ? "bearer token" : "API key"
  );
  req.skyflowCredentials = result.credentials;
  next();
}
