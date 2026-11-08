import { getNavigation } from "@/server/navigation";
import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/(site)")({
  loader: ({ location }) => getNavigation({ headers: { "x-mv-path": location.href } }),
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
