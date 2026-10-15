import { timingSafeEqual } from "node:crypto";
import { runCron } from "@/server/cron";
import { env } from "@/server/env";

export const maxDuration = 60;

export async function GET(request: Request) {
  const expected = Buffer.from(`Bearer ${env.cronSecret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  if (!env.cronSecret || expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return new Response("Ikke tilgang", { status: 401 });
  }
  const { done, failed } = await runCron();
  return Response.json({ ok: failed.length === 0, done, failed }, { status: failed.length ? 500 : 200 });
}
