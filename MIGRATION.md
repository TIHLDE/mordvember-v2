# TanStack Start migration

Stage 0: Node 25, pnpm 12, single app under src/app, tsx available. No configured formatter found.
Stage 1: Installed Start, Router, Vite, Nitro and Tailwind's Vite plugin alongside Next. Scripts now target Vite/Nitro. Later stages are pending; the application is not yet runnable with Start.

## Behavior to preserve

- `next.config.ts`: preserve nosniff, same-origin referrer policy, frame denial and camera/geolocation permissions headers via request middleware. Verify headers on HTML and API responses before completion.
- `next.config.ts`: server actions accept 6 MB bodies. Translate the limit at explicit server request boundaries and verify upload limits.
- `postcss.config.mjs`: Tailwind PostCSS integration retained alongside the new Vite plugin pending runtime verification.
- `package.json`, `scripts/vercel-build.ts`: build:vercel still targets Next. Deployment changes require a separate user decision; verify Nitro hosting and build environment before switching deployment.
