/**
 * Base64-decode the JWT payload (middle segment) and return claims.
 * No cryptographic verification — just parses the JSON payload.
 * Returns null for malformed tokens.
 */
export function decodeToken(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = Buffer.from(payload, "base64url").toString("utf-8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}
