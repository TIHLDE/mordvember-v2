import { createFileRoute } from "@tanstack/react-router";

import { endSession } from "@/server/auth/session";


 async function POST(request: Request) {
  await endSession();
  return Response.redirect(`${new URL(request.url).origin}/`, 303);
}

export const Route = createFileRoute("/api/auth/logout")({ server: { handlers: { POST: ({ request }) => POST(request) } } });
