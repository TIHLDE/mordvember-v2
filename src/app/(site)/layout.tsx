import { requireLogin } from "@/lib/route-auth";
import { getNavigation } from "@/server/navigation";
import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";

const publicPaths = new Set(["/", "/login", "/dev"]);

export const Route = createFileRoute("/(site)")({
  beforeLoad: (options) => {
    if (!publicPaths.has(options.location.pathname.replace(/\/+$/, "") || "/"))
      return requireLogin(options);
  },
  loader: () => getNavigation(),
  component: SiteLayout,
});

function SiteLayout() {
  const path = useLocation({ select: (location) => location.pathname });
  const navigation = Route.useLoaderData();
  return (
    <>
      <SiteHeader {...navigation} />
      <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16">
        <div key={path} className="page-enter">
          <Outlet />
        </div>
      </main>
    </>
  );
}
