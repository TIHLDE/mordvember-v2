import { setResponseHeader } from "@tanstack/react-start/server";
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
  setResponseHeader("X-Content-Type-Options", "nosniff");
  setResponseHeader("Referrer-Policy", "same-origin");
  setResponseHeader("X-Frame-Options", "DENY");
  setResponseHeader("Permissions-Policy", "camera=(self), geolocation=(self)");
  setResponseHeader("Cache-Control", result.response.headers.get("Cache-Control") ?? "no-store");
  return result;
});

export const startInstance = createStart(() => ({ requestMiddleware: [responsePolicy, actionBodyLimit] }));
