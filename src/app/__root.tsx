import "@fontsource/creepster/400.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./globals.css";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";

export const Route = createRootRoute({
  head: () => ({ meta: [
    { charSet: "utf-8" },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { title: "Mordvember" },
    { name: "description", content: "Mordvember i TIHLDE" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: RootLayout,
});

function RootLayout() {
  return <html lang="nb"><head><HeadContent /></head><body className="font-sans text-zinc-200 antialiased"><Outlet /><Scripts /></body></html>;
}
