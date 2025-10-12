import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Access token cookie name
const ACCESS_TOKEN = "MORDVEMBER-AccessToken";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if accessing admin route
  if (pathname.startsWith("/admin")) {
    // Check for auth token in cookies
    const token = request.cookies.get(ACCESS_TOKEN);

    if (!token) {
      // Redirect to login with redirectTo parameter
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: ["/admin/:path*"],
};
