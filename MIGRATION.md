# TanStack Start migration

Application migration stages 0–10 are implemented. Next packages/configuration remain intentionally installed for the guide's user-controlled cleanup step. Deployment now builds TanStack Start through Vite Plus; no deployment has been published.

## Completed

| Stage | Result                                                                                                                                        | Commits                                                     |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 0–1   | Node/pnpm single-app inventory; Start, Router, Vite, Nitro and Tailwind Vite setup alongside Next                                             | dbe3530                                                     |
| 2–3   | Root document/router, registered UI/API routes, generated tracked route tree, `$id`/`$playerId` segments                                      | c8e107e, 683a023                                            |
| 4–5   | Route-specific params, validated optional search values, TanStack links/path matching, redirects moved into loaders/server functions          | d3000dc, 6787c21, e94cbc1 and server-boundary commits below |
| 6–7   | Root head metadata preserved; environment inventory found no NEXT_PUBLIC values, no secrets exposed as VITE variables                         | 8f48e50 and root-route changes                              |
| 8     | Cookies/HTTP responses, explicit server RPC actions/loaders, synchronous route/header/banner components, mutation invalidation                | 142951a, d96ecd3, da1bd39, be5f9f7, e7f26f0, 70842c0        |
| 9     | Request security/cache policies, return-path headers, template animation wrappers, root shell/error boundary; old proxy removed               | 321295f                                                     |
| 10    | Start server markers, 6 MB action-body cap, retained native images/Fontsource, ignored cron export documented, runtime fixes and smoke checks | 757b2d1 and final verification commit                       |

No active `next/*` imports, `use server` directives, async route components, or ignored Next route exports remain in `src`. There were no dynamic metadata, static params, robots/sitemap, next/font, next/image, next/script, next/dynamic or TanStack Query integrations to replace. SWR remains in place. Private environment names are unchanged.

Server actions preserve authorization/domain validation, validate FormData and file sizes, and validate check-in intent/coordinates. Successful ActionForm submissions invalidate router data. Email delivery is awaited because Next's `after()` no longer runs. Server imports use Start's import-protection marker. Audit/event JSON is serialized explicitly; Start handles dates in loader results. Target identity is fetched only on explicit reveal, not in loader data.

Security headers cover application responses and Nitro static assets. Application responses default to `no-store`; endpoints with explicit cache headers retain them. Action requests retain the 6 MB body limit, including chunked bodies. Tailwind uses `@tailwindcss/vite`; the PostCSS configuration and direct PostCSS dependencies have been removed.

## Verification

- `vp check`: unified Oxfmt, Oxlint and TypeScript checks.
- Oxlint and Oxfmt share the generated-output and route-tree exclusions in `vite.config.ts`.
- `vp test`: 123 passed; 34 database-dependent tests skipped (12 test files passed, 4 skipped).
- `vp build`: passes and generates `.output/server/index.mjs`.
- `NITRO_PRESET=vercel vp build`: generates a single ten-minute `/_vercel/cron` schedule and a cron function with `maxDuration: 60`.
- Dev server `/_nitro/tasks`: lists the same `game:cron` schedule. Task success/failure is tested with a mocked game job; no database jobs were executed.
- `E2E_BASE=http://localhost:3104 vp run test:start-smoke`: passes against the production build. Covers login/status rendering, metadata, production-only dev-login denial, protected-route redirects with query preservation, unauthorized APIs, logout cookie deletion, missing OAuth code, malformed OAuth state, security headers, and fixed-length/chunked 413 body limits.
- Browser bundles pass Start import protection; no server-only import bypass was added.

## Remaining user-controlled work

| Affected area                                                                          | Behavior to preserve                                                                                                  | Why deferred / replacement                                                                                                                                                                 | Required verification                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database-backed game flows and Photon OAuth                                            | Session refresh, role enforcement, circle privacy, uploads, geolocation/check-in, mutation refresh and email delivery | No local database was available; Docker's daemon socket was unavailable. No production services were used for verification. Existing DB/e2e suites remain the replacement validation path. | Run with a dedicated test database and seeded development app: DB tests, `test:e2e`, `test:leak`, and mock Photon `test:photon`; verify expired sessions, logout, role changes, image failure states and navigation refresh. |
| `next`, `next.config.ts`, TypeScript Next plugin and `.next` includes, `next-env.d.ts` | Deliberate retention during staged migration                                                                          | The guide requires a separate user decision before final framework cleanup. No application runtime depends on Next now.                                                                    | Approve removal, then rerun typecheck/lint/tests/build and deployment smoke checks.                                                                                                                                          |

Recommended sequence: validate the remaining integration flows, choose the Next/config cleanup timing, rerun the dedicated type/lint checks after cleanup, then complete the production route/SSR/navigation/metadata/middleware/image/deployment smoke pass.

## Vite Plus and scheduled jobs follow-up

Vite Plus 1.5.0 now owns lint (Oxlint), format (Oxfmt), tests (Vitest), development and builds in `vite.config.ts`. Test imports use `vite-plus/test`; ESLint and standalone Vitest/tsx have been removed. The `vite` dependency is an alias to Vite Plus core for plugin compatibility, managed by the workspace catalog/override. Use `vp` for dependency management; pnpm remains the lockfile backend. Node is pinned through `.node-version`. The existing DateTimePicker restriction is preserved by a typed local Oxlint rule.

Nitro experimental tasks register `game:cron` explicitly and schedule it every ten minutes in dev/Node and Vercel. The existing authenticated `/api/cron` remains available for manual calls. `vercel.json` now selects TanStack Start and the Vite Plus build preflight; it contains no cron definition. Vercel build preflight and the task runtime require CRON_SECRET so the generated Vercel task endpoint cannot execute without its authentication secret, including on preview deployments. Scheduled game failures surface as failed tasks.

Login redirects now run in shared site/admin `beforeLoad` guards using the router location. The custom path header and server-side login redirect helper have been removed. Server functions independently require the viewer/role; the invalid QR scan message remains readable without login. Guard tests cover destination/query preservation, authenticated navigation and pending-scan behavior.
