import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
function SiteLayout() {
    return (<>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16"><Outlet /></main>
    </>);
}

export const Route = createFileRoute("/(site)")({ component: SiteLayout });
