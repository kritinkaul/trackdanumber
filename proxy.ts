import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Gates the entire app behind a shared username/password (HTTP Basic Auth).
 *
 * This is a lightweight, short-term access control for an internal tool that
 * handles personal data (names, addresses) — it is NOT a substitute for real
 * identity-based auth (e.g. company SSO or Vercel's own access protection).
 * See DASHBOARD_USERNAME / DASHBOARD_PASSWORD in the deployment's env vars.
 *
 * If those env vars are unset (e.g. local development), the app stays open.
 */
function unauthorized(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Shipment Dashboard", charset="UTF-8"',
    },
  });
}

function isAuthorized(request: NextRequest, username: string, password: string): boolean {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return false;

  let decoded: string;
  try {
    decoded = Buffer.from(header.slice(6), "base64").toString("utf-8");
  } catch {
    return false;
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) return false;

  const providedUser = decoded.slice(0, separatorIndex);
  const providedPass = decoded.slice(separatorIndex + 1);
  return providedUser === username && providedPass === password;
}

export function proxy(request: NextRequest): NextResponse {
  const username = process.env.DASHBOARD_USERNAME;
  const password = process.env.DASHBOARD_PASSWORD;

  if (!username || !password) {
    return NextResponse.next();
  }

  if (!isAuthorized(request, username, password)) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
