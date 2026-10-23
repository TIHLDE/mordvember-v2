import { NextResponse, type NextRequest } from "next/server";
import { PATH_HEADER } from "@/lib/redirect";

// Pages can't read their own URL, so the requested path is passed on for the login redirect to send the user back.
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

// Pages only. Server actions are skipped, since the proxy would buffer their bodies (image uploads).
export const config = {
  matcher: [{ source: "/((?!api|_next|status|.*\\..*).*)", missing: [{ type: "header", key: "next-action" }] }],
};
