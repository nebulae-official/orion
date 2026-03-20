import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Demo mode: bypass authentication entirely
  if (DEMO_MODE) {
    // Redirect auth pages to home in demo mode
    if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    // If user is already authenticated and visits /login, redirect to home
    const token = request.cookies.get("orion_token")?.value;
    if (token) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Allow Next.js internals and static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check for auth token
  const token = request.cookies.get("orion_token")?.value;
  const expiry = request.cookies.get("orion_token_expiry")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check token expiry
  if (expiry) {
    const expiresAt = new Date(expiry);
    if (expiresAt <= new Date()) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("orion_token");
      response.cookies.delete("orion_token_expiry");
      response.cookies.delete("orion_user");
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
