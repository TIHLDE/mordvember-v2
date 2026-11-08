import { createFileRoute } from "@tanstack/react-router";
import { Status } from "./Status";
export const dynamic = "force-dynamic";
function StatusPage() {
    return <Status />;
}

export const Route = createFileRoute("/status/")({ component: StatusPage });
