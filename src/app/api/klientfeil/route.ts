import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const MAX_LENGTH = 2000;

// Browser errors never reach the server logs on their own, so global-error.tsx sends them here.
export async function POST(request: NextRequest) {
  const report = (await request.text()).slice(0, MAX_LENGTH);
  console.error("Klientfeil", report, request.headers.get("user-agent")?.slice(0, 300));
  return new NextResponse(null, { status: 204 });
}
