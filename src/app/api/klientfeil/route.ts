import { createFileRoute } from "@tanstack/react-router";



const MAX_LENGTH = 2000;

// Browser errors never reach the server logs on their own, so global-error.tsx sends them here.
 async function POST(request: Request) {
  const report = (await request.text()).slice(0, MAX_LENGTH);
  console.error("Klientfeil", report, request.headers.get("user-agent")?.slice(0, 300));
  return new Response(null, { status: 204 });
}

export const Route = createFileRoute("/api/klientfeil")({ server: { handlers: { POST: ({ request }) => POST(request) } } });
