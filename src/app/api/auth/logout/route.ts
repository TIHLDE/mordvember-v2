import { createFileRoute } from "@tanstack/react-router";

import { endSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

 async function POST(request: Request) {
  await endSession();
  return Response.redirect(`${new URL(request.url).origin}/`, 303);
}

export const Route = createFileRoute("/api/auth/logout")({ server: { handlers: { POST: ({ request, params }) => POST(request) } } });
