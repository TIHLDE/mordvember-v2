# TanStack Start migration

Stage 0: Node 25, pnpm 12, single app under src/app, tsx available. No configured formatter found.
Stage 1: Installed Start, Router, Vite, Nitro and Tailwind's Vite plugin alongside Next. Scripts now target Vite/Nitro. Later stages are pending; the application is not yet runnable with Start.

## Behavior to preserve

- `next.config.ts`: preserve nosniff, same-origin referrer policy, frame denial and camera/geolocation permissions headers via request middleware. Verify headers on HTML and API responses before completion.
- `next.config.ts`: server actions accept 6 MB bodies. Translate the limit at explicit server request boundaries and verify upload limits.
- `postcss.config.mjs`: Tailwind PostCSS integration retained alongside the new Vite plugin pending runtime verification.
- `package.json`, `scripts/vercel-build.ts`: build:vercel still targets Next. Deployment changes require a separate user decision; verify Nitro hosting and build environment before switching deployment.

## Stage 2

Root document and router created; pages, layouts and HTTP endpoints now export Route. Route generation runs through Vite. Async server rendering and removed route props deliberately remain for stages 4/8.

- `src/app/global-error.tsx`: Next's document-level error handling requires a root error component adaptation. Preserve error logging and fallback; verify thrown SSR and client errors before completion.
- `src/app/(site)/template.tsx`, `src/app/admin/template.tsx`: Next remounts templates on navigation. These are ignored by Start; inspect animation/remount behavior and adapt with a keyed component if needed; verify navigation transitions.
- `src/app/api/auth/*`, `src/server/auth/*`: NextResponse cookie mutation and next/headers remain pending explicit auth request-boundary migration. Verify OAuth state, PKCE, session creation/refresh/logout and cookie flags before completion.

Stage 3: Renamed [id] and both [playerId] route directories to $id/$playerId. Regenerated the route tree with Vite; public paths and parameter names preserved.

Stage 4: Route params use Route.useParams; login/dev/profile/checkin/attendance search values have explicit string validation. Layouts render Outlet. Async component execution remains stage 8 work.

## Stage 5 (partial)

Next Link components now use TanStack Link; pathname reads use useLocation. Existing navigation entries are retained. Dynamic URL strings and navigation data need typed LinkOptions conversion; redirects still use Next and must move to loading boundaries along with stage 8. Verify back/forward, query preservation, active states and authenticated redirects before marking this stage complete.

Stage 5 follow-up: login query strings and player detail links now use typed search/params; optional validated search fields accept omitted inputs. Zero-argument public status handlers no longer receive a Request. Full redirect migration remains dependent on explicit server loaders.

## Request cookie and HTTP response migration

OAuth state, sessions and pending scan cookies now use Start's request cookie API, preserving cookie flags and root path. HTTP endpoints return standard Response objects, preserving 307/303 redirects. This removes the callback Request type mismatch. Live OAuth/session/check-in smoke tests remain required; this change does not complete async page rendering or action RPC migration.

## Stage 6 audit

Root title, description, noindex/nofollow, language and viewport are migrated to route head. No additional metadata/generateMetadata/generateStaticParams, robots/sitemap or dynamic image conventions exist in src. Rendered-head verification awaits executable pages.

## Stage 7 inventory

No NEXT_PUBLIC variables exist. `.env.example` values remain server/deployment configuration (APP_URL is used to construct email/QR URLs). No secret is renamed to VITE_. `src/db`, `src/server`, `src/lib/guard.ts` and `src/lib/action.ts` must remain behind explicit server boundaries. Current production build correctly rejects browser access to server-only modules from async route components. Stage 8 must move data reads and writes behind createServerFn and return serializable data; do not disable import protection.

## Stage 8 first data route

`src/app/(site)/oppmote/page.tsx` now uses a GET server function and route loader. Its React component is synchronous, server imports are contained in the handler, and login/home redirects use TanStack redirect. Start serializes the attendance dates for loader consumption. Typecheck passes. Verify logged-out return path, non-player redirect, date rendering, and weekly attendance against a seeded database. Other async routes and shared async header/banner components remain to be converted.

`src/app/(site)/offer/page.tsx`: status loads through a GET server function and returns only running/alive booleans; sensitive target data remains behind an explicit POST server function invoked by RevealButton. The existing action still checks player authorization on each reveal. Verify reveal/hide, navigation cleanup and unauthorized requests. No target identity is included in loader data.

Stage 8 navigation: site layout loader calls getNavigation, which returns only header identity/role/status fields, unread count and a pending-kill boolean. SiteHeader and PendingKillBanner are synchronous, with database and session reads inside the server function. Admin layout still awaits conversion and temporarily calls the same function for its banner. Verify unread counts, role-dependent menus and pending-kill visibility after mutation invalidation.

Stage 8 actions: site/admin actions now expose explicit POST server functions, validate FormData/file limits and check-in coordinates, and retain authorization and domain validation in server-only implementations. ActionForm invalidates router data on successful mutations. Email delivery is awaited rather than using Next after(). Audit, circle, season, staff, questions, notifications, kill cases and player-list routes now load data through GET server functions; arbitrary audit/event payloads are serialized to JSON text. Remaining early-return/search-dependent pages and admin layout still need conversion.

Stage 8 route conversion complete: all route components and nested home/check-in components are synchronous. Server data uses explicit RPC loaders; search/id inputs are validated; Next server markers replaced with Start's import-protection marker. Local development login is an explicit POST RPC gated on development mode. Shared date formatting moved out of the server action module. Production bundling passed before the final request-policy changes; rerun below records final status.

Stage 8 caching: removed ignored force-dynamic exports. Start request middleware explicitly sets no-store on application responses; no prerendering is configured. SWR remains unchanged; the app does not use TanStack Query.
