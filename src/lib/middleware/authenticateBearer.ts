import type { Request, Response, NextFunction } from "express";

export interface TokenExtractionResult {
  isPresent: boolean;
  token?: string;
  error?: string;
}

export interface CredentialsExtractionResult {
  isPresent: boolean;
  credentials?: { token: string } | { apiKey: string };
  error?: string;
}

/**
 * Extract bearer token from Authorization header and check format
 * Pure function for easier testing
 * Note: This only validates format, not authenticity. Skyflow API validates the actual token.
 *
 * @param authHeader - The Authorization header value
 * @returns TokenExtractionResult with isPresent, optional token, and optional error
 *
 * @example
 * extractBearerToken("Bearer abc123") // => { isPresent: true, token: "abc123" }
 * extractBearerToken("Invalid") // => { isPresent: false, error: "..." }
 * extractBearerToken(undefined) // => { isPresent: false, error: "..." }
 */
export function extractBearerToken(
  authHeader: string | undefined
): TokenExtractionResult {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      isPresent: false,
      error: "Missing or invalid Authorization header",
    };
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  if (!token || token.trim().length === 0) {
    return {
      isPresent: false,
      error: "Bearer token is empty",
    };
  }

  return {
    isPresent: true,
    token,
  };
}

/**
 * Extract API key from query parameter and check format
 * Pure function for easier testing
 * Note: This only validates format, not authenticity. Skyflow API validates the actual key.
 *
 * @param apiKeyParam - The apiKey query parameter value
 * @returns TokenExtractionResult with isPresent, optional token (apiKey), and optional error
 *
 * @example
 * extractApiKey("my-api-key-123") // => { isPresent: true, token: "my-api-key-123" }
 * extractApiKey("") // => { isPresent: false, error: "..." }
 * extractApiKey(undefined) // => { isPresent: false, error: "..." }
 */
export function extractApiKey(
  apiKeyParam: string | undefined
): TokenExtractionResult {
  if (!apiKeyParam || typeof apiKeyParam !== "string") {
    return {
      isPresent: false,
      error: "Missing or invalid apiKey query parameter",
    };
  }

  const apiKey = apiKeyParam.trim();

  if (apiKey.length === 0) {
    return {
      isPresent: false,
      error: "API key is empty",
    };
  }

  return {
    isPresent: true,
    token: apiKey,
  };
}

/**
 * Extract credentials from either Authorization header (bearer token) or query parameter (API key)
 * Tries header first, then falls back to query parameter
 * Note: This only checks format/presence, not authenticity. Skyflow API validates the actual credentials.
 *
 * @param authHeader - The Authorization header value
 * @param apiKeyParam - The apiKey query parameter value
 * @returns CredentialsExtractionResult with credentials in Skyflow SDK format
 *
 * @example
 * extractCredentials("Bearer abc123", undefined)
 * // => { isPresent: true, credentials: { token: "abc123" } }
 *
 * extractCredentials(undefined, "my-api-key")
 * // => { isPresent: true, credentials: { apiKey: "my-api-key" } }
 *
 * extractCredentials(undefined, undefined)
 * // => { isPresent: false, error: "..." }
 */
export function extractCredentials(
  authHeader: string | undefined,
  apiKeyParam: string | undefined
): CredentialsExtractionResult {
  // Try bearer token from header first
  const bearerResult = extractBearerToken(authHeader);
  if (bearerResult.isPresent && bearerResult.token) {
    return {
      isPresent: true,
      credentials: { token: bearerResult.token },
    };
  }

  // Fallback to API key from query parameter
  const apiKeyResult = extractApiKey(apiKeyParam);
  if (apiKeyResult.isPresent && apiKeyResult.token) {
    return {
      isPresent: true,
      credentials: { apiKey: apiKeyResult.token },
    };
  }

  // Both failed
  return {
    isPresent: false,
    error: "Missing or invalid credentials. Provide either Authorization header with Bearer token or apiKey query parameter.",
  };
}

/**
 * Express middleware for credentials authentication
 * Supports both bearer token (from Authorization header) and API key (from query parameter)
 * Bearer token takes precedence if both are provided
 * Note: Only validates format/presence. Skyflow API validates authenticity when SDK is initialized.
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

  if (!result.isPresent) {
    console.log("Credentials not found:", result.error);
    return res.status(401).json({ error: result.error });
  }

  console.log("Credentials found, type:",
    result.credentials && "token" in result.credentials ? "bearer token" : "API key"
  );
  req.skyflowCredentials = result.credentials;
  next();
}
