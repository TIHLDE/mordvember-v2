import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  server: { port: 3000 },
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart({
      srcDirectory: "src",
      router: {
        routesDirectory: "app",
        indexToken: "page",
        routeToken: /layout|route/,
        routeFileIgnorePattern:
          "^(?!(?:__root|page|layout|route|sitemap\\[\\.\\]xml|robots\\[\\.\\]txt)\\.(?:ts|tsx)$).*\\.(?:ts|tsx)$",
      },
    }),
    viteReact(),
    nitro(),
  ],
});
