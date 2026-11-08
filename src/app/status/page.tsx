import { createFileRoute } from "@tanstack/react-router";
import { Status } from "./Status";

export const Route = createFileRoute("/status/")({ component: StatusPage });

function StatusPage() {
  return <Status />;
}
