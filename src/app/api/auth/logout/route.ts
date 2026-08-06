import { NextResponse } from "next/server";
import { ACCESS_TOKEN } from "../photon";

export const dynamic = "force-dynamic";

/**
 * Cookien er httpOnly, så klienten kan ikke slette den selv — det må skje her.
 */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ACCESS_TOKEN);
  return response;
}
