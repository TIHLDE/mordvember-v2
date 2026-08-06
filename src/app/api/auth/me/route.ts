import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_TOKEN, fetchUser } from "../photon";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = (await cookies()).get(ACCESS_TOKEN)?.value;

  if (!token) {
    return NextResponse.json({ error: "Ikke innlogget" }, { status: 401 });
  }

  const user = await fetchUser(token);
  if (!user) {
    // Photon avviste tokenet — som regel fordi det er utløpt. 401 lar
    // klienten sende brukeren til innlogging i stedet for å vise en feil.
    return NextResponse.json({ error: "Sesjonen er utløpt" }, { status: 401 });
  }

  return NextResponse.json(user);
}
