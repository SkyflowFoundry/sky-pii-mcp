import type { Request, Response, NextFunction } from "express";

export interface TokenExtractionResult {
  isValid: boolean;
  token?: string;
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
 * Express middleware for bearer token authentication
 * Validates format and extracts token for use with Skyflow API
 */
export function authenticateBearer(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const result = extractBearerToken(req.headers.authorization);

  if (!result.isValid) {
    return res.status(401).json({ error: result.error });
  }

  req.bearerToken = result.token;
  next();
}
