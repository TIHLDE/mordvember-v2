import { NextResponse, type NextRequest } from "next/server";
import { endSession } from "@/server/auth/session";

export async function POST(request: NextRequest) {
  await endSession();
  return NextResponse.redirect(`${request.nextUrl.origin}/`, { status: 303 });
}
