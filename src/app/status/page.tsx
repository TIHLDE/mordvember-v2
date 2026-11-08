import { createFileRoute } from "@tanstack/react-router";
import { Status } from "./Status";
function StatusPage() {
    return <Status />;
}

export const Route = createFileRoute("/status/")({ component: StatusPage });
