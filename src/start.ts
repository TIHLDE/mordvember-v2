import { createMiddleware, createStart } from "@tanstack/react-start";

const MAX_ACTION_BYTES = 6 * 1024 * 1024;

const actionBodyLimit = createMiddleware().server(async ({ request, handlerType, next }) => {
  if (handlerType !== "serverFn" || !request.body) return next();
  if (Number(request.headers.get("content-length")) > MAX_ACTION_BYTES) {
    return new Response("Skjemaet er for stort", { status: 413 });
  }
  // Read a clone so downstream multipart parsing still receives the original body.
  const reader = request.clone().body!.getReader();
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_ACTION_BYTES) {
        void reader.cancel();
        return new Response("Skjemaet er for stort", { status: 413 });
      }
    }
  } finally {
    reader.releaseLock();
  }
  return next();
});

const responsePolicy = createMiddleware().server(async ({ next }) => {
  const result = await next();
  const response = new Response(result.response.body, result.response);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "same-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(self), geolocation=(self)");
  // Pages contain session-specific game data; preserve Next's force-dynamic intent.
  response.headers.set("Cache-Control", "no-store");
  return { ...result, response };
});

export const startInstance = createStart(() => ({ requestMiddleware: [responsePolicy, actionBodyLimit] }));
