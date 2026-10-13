import { notFound } from "next/navigation";
import { seasonForScreenToken } from "@/server/admin";
import { Board } from "./Board";

export const dynamic = "force-dynamic";

export default async function BoardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await seasonForScreenToken(token))) notFound();
  return <Board token={token} />;
}
