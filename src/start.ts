import { createMiddleware, createStart } from "@tanstack/react-start";

const responsePolicy = createMiddleware().server(async ({ next }) => {
  const result = await next();
  result.response.headers.set("X-Content-Type-Options", "nosniff");
  result.response.headers.set("Referrer-Policy", "same-origin");
  result.response.headers.set("X-Frame-Options", "DENY");
  result.response.headers.set("Permissions-Policy", "camera=(self), geolocation=(self)");
  // Pages contain session-specific game data; preserve Next's force-dynamic intent.
  result.response.headers.set("Cache-Control", "no-store");
  return result;
});

export const startInstance = createStart(() => ({ requestMiddleware: [responsePolicy] }));
