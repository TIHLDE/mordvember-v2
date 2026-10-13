import { asc, like } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { Button, Card, PageTitle } from "@/components/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import { safeNext } from "@/lib/redirect";
import { onLogin } from "@/server/auth/login";

const TEST_PREFIX = "test-";

async function devLogin(form: FormData) {
  "use server";
  if (process.env.NODE_ENV !== "development") notFound();
  const username = String(form.get("username") ?? "");
  if (!username.startsWith(TEST_PREFIX)) notFound();
  const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.username, username) });
  if (!user) notFound();
  await onLogin({
    username: user.username,
    name: user.name,
    email: user.email,
    image: user.photonImage,
    studyProgram: user.studyProgram,
    studyStartYear: user.studyStartYear,
    classYear: user.classYear,
    isKokLeader: form.get("kok") === "on",
    isIndexLeader: form.get("index") === "on",
  });
  redirect(safeNext(String(form.get("next") ?? "/")));
}

export default async function DevLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { next } = await searchParams;
  const testUsers = await db.select().from(users).where(like(users.username, `${TEST_PREFIX}%`)).orderBy(asc(users.username));
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle sub="Bare tilgjengelig i lokal utvikling. Finnes ikke i produksjonsbygget.">Testbrukere</PageTitle>
      {!testUsers.length && <p className="text-zinc-400">Ingen testbrukere. Kjør npm run db:seed.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {testUsers.map((u) => (
          <Card key={u.id}>
            <form action={devLogin} className="space-y-2">
              <input type="hidden" name="username" value={u.username} />
              <input type="hidden" name="next" value={safeNext(next)} />
              <p className="font-medium text-white">{u.name}</p>
              <p className="text-xs text-zinc-500">{u.username}</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="kok" defaultChecked={u.username === "test-kokleder"} /> Leder i KoK
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="index" defaultChecked={u.username === "test-indexleder"} /> Leder i Index
              </label>
              <Button type="submit">Logg inn som {u.name.split(" ")[0]}</Button>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
