# TanStack Start migration

Application migration stages 0–10 are implemented. Next packages/configuration remain intentionally installed for the guide's user-controlled cleanup step. Deployment has not been switched or published.

## Completed

| Stage | Result | Commits |
| --- | --- | --- |
| 0–1 | Node/pnpm single-app inventory; Start, Router, Vite, Nitro and Tailwind Vite setup alongside Next | dbe3530 |
| 2–3 | Root document/router, registered UI/API routes, generated tracked route tree, `$id`/`$playerId` segments | c8e107e, 683a023 |
| 4–5 | Route-specific params, validated optional search values, TanStack links/path matching, redirects moved into loaders/server functions | d3000dc, 6787c21, e94cbc1 and server-boundary commits below |
| 6–7 | Root head metadata preserved; environment inventory found no NEXT_PUBLIC values, no secrets exposed as VITE variables | 8f48e50 and root-route changes |
| 8 | Cookies/HTTP responses, explicit server RPC actions/loaders, synchronous route/header/banner components, mutation invalidation | 142951a, d96ecd3, da1bd39, be5f9f7, e7f26f0, 70842c0 |
| 9 | Request security/cache policies, return-path headers, template animation wrappers, root shell/error boundary; old proxy removed | 321295f |
| 10 | Start server markers, 6 MB action-body cap, retained native images/Fontsource, ignored cron export documented, runtime fixes and smoke checks | 757b2d1 and final verification commit |

No active `next/*` imports, `use server` directives, async route components, or ignored Next route exports remain in `src`. There were no dynamic metadata, static params, robots/sitemap, next/font, next/image, next/script, next/dynamic or TanStack Query integrations to replace. SWR remains in place. Private environment names are unchanged.

Server actions preserve authorization/domain validation, validate FormData and file sizes, and validate check-in intent/coordinates. Successful ActionForm submissions invalidate router data. Email delivery is awaited because Next's `after()` no longer runs. Server imports use Start's import-protection marker. Audit/event JSON is serialized explicitly; Start handles dates in loader results. Target identity is fetched only on explicit reveal, not in loader data.

Security headers cover application responses and Nitro static assets. Application responses default to `no-store`; endpoints with explicit cache headers retain them. Action requests retain the 6 MB body limit, including chunked bodies. Keep Next's PostCSS integration until the final dependency/configuration cleanup.

## Verification

- `pnpm typecheck`: passes.
- `pnpm lint`: passes without warnings; generated build output and route tree are excluded.
- `pnpm test`: 116 passed; 34 database-dependent tests skipped (10 test files passed, 4 skipped).
- `pnpm build`: passes and generates `.output/server/index.mjs`.
- `E2E_BASE=http://localhost:3104 pnpm test:start-smoke`: passes against the production build. Covers login/status rendering, metadata, production-only dev-login denial, protected-route redirects with query preservation, unauthorized APIs, logout cookie deletion, missing OAuth code, malformed OAuth state, security headers, and fixed-length/chunked 413 body limits.
- Browser bundles pass Start import protection; no server-only import bypass was added.

## Remaining user-controlled work

| Affected area | Behavior to preserve | Why deferred / replacement | Required verification |
| --- | --- | --- | --- |
| `vercel.json`, `package.json` `build:vercel`, `scripts/vercel-build.ts`, hosting dashboard | Production preflight, database migration/build, cron schedule, environment and Blob configuration | The guide excludes deployment infrastructure changes. Existing deployment still targets Next; choose a Nitro/Start hosting preset and update the build command/framework together before deploying. Current Nitro dependency is a 3.x release candidate. | Staging deploy with real environment, migrations, static assets, SSR, OAuth callback URL, Blob storage, cron authentication/schedule and logs. |
| `src/app/api/cron/route.ts` / hosting configuration | Cron may run for up to 60 seconds | `maxDuration` is a deployment setting; its inert export was replaced with a comment. Configure the equivalent duration on the chosen platform. | Exercise a realistic cron run and confirm no premature timeout or duplicate processing. |
| Database-backed game flows and Photon OAuth | Session refresh, role enforcement, circle privacy, uploads, geolocation/check-in, mutation refresh and email delivery | No local database was available; Docker's daemon socket was unavailable. No production services were used for verification. Existing DB/e2e suites remain the replacement validation path. | Run with a dedicated test database and seeded development app: DB tests, `test:e2e`, `test:leak`, and mock Photon `test:photon`; verify expired sessions, logout, role changes, image failure states and navigation refresh. |
| `next`, `eslint-config-next`, `next.config.ts`, TypeScript Next plugin and `.next` includes, `next-env.d.ts`, Tailwind PostCSS configuration | Deliberate retention during staged migration | The guide requires a separate user decision before final framework cleanup. No application runtime depends on Next now. | Approve removal, adapt lint configuration as needed, then rerun typecheck/lint/tests/build and deployment smoke checks. |

Recommended sequence: validate the remaining integration flows, choose the Next/config cleanup timing, rerun the dedicated type/lint checks after cleanup, then complete the production route/SSR/navigation/metadata/middleware/image/deployment smoke pass.
