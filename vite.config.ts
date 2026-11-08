import { fileURLToPath } from "node:url";
import { defineConfig, lazyPlugins } from "vite-plus";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const generated = [
  ".next/**", ".output/**", ".nitro/**", ".tanstack/**", ".vitest/**",
  "node_modules/**", "drizzle/**", ".data/**", "test-results/**",
  "src/routeTree.gen.ts", "next-env.d.ts",
];

export default defineConfig(({ mode }) => ({
  fmt: { ignorePatterns: generated },
  lint: {
    ignorePatterns: generated,
    plugins: ["typescript", "react", "jsx-a11y", "import"],
    env: { browser: true, node: true },
    jsPlugins: ["./lint/project.ts"],
    categories: { correctness: "error" },
    options: { typeAware: true, typeCheck: true },
    rules: {
      "project/no-native-date-input": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "typescript/no-explicit-any": "error",
      "react/rules-of-hooks": "error",
      "react/exhaustive-deps": "warn",
      "jsx-a11y/alt-text": "warn",
      // Custom listboxes and dialog focus use valid ARIA patterns.
      "jsx-a11y/prefer-tag-over-role": "off",
      "jsx-a11y/no-noninteractive-element-to-interactive-role": "off",
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/no-autofocus": "off",
    },
  },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@tanstack/react-start/server-only": fileURLToPath(new URL("./tests/stubs/empty.ts", import.meta.url)),
    },
  },
  server: { port: 3000 },
  resolve: { tsconfigPaths: true },
  plugins: mode === "test" ? [] : lazyPlugins(() => [
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
    nitro({
      experimental: { tasks: true },
      tasks: {
        "game:cron": {
          handler: fileURLToPath(new URL("./src/tasks/game-cron.ts", import.meta.url)),
          description: "Process scheduled game updates and queued email",
        },
      },
      scheduledTasks: { "*/10 * * * *": ["game:cron"] },
      vercel: { functionRules: { "/_vercel/cron": { maxDuration: 60 } } },
      routeRules: {
        "/**": { headers: {
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "same-origin",
          "X-Frame-Options": "DENY",
          "Permissions-Policy": "camera=(self), geolocation=(self)",
        } },
      },
    }),
    viteReact(),
  ]),
}));
