import { NextResponse } from "next/server";
import { endSession } from "@/server/auth/session";
import { env } from "@/server/env";

export async function POST() {
  await endSession();
  return NextResponse.redirect(`${env.appUrl}/`, { status: 303 });
}
