export class FedExAuthError extends Error {}

const TOKEN_SAFETY_MARGIN_MS = 2 * 60 * 1000;

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

export function getFedExBaseUrl(): string {
  return process.env.FEDEX_API_BASE_URL ?? "https://apis.fedex.com";
}

/**
 * Returns a valid FedEx OAuth access token, reusing the cached one
 * until shortly before its 1-hour expiry.
 */
export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.accessToken;
  }

  const clientId = process.env.FEDEX_CLIENT_ID;
  const clientSecret = process.env.FEDEX_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new FedExAuthError(
      "FedEx credentials are not configured. Set FEDEX_CLIENT_ID and FEDEX_CLIENT_SECRET in .env.local."
    );
  }

  const response = await fetch(`${getFedExBaseUrl()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      detail = body?.errors?.[0]?.message ?? detail;
    } catch {
      // keep HTTP status as detail
    }
    throw new FedExAuthError(`FedEx authentication failed: ${detail}`);
  }

  const data: { access_token: string; expires_in: number } = await response.json();
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - TOKEN_SAFETY_MARGIN_MS,
  };
  return cachedToken.accessToken;
}
