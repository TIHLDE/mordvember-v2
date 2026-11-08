import { createFileRoute } from "@tanstack/react-router";
import { asc, like } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { Button, Card, Checkbox, PageTitle } from "@/components/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import { safeNext } from "@/lib/redirect";
import { onLogin } from "@/server/auth/login";
const TEST_PREFIX = "test-";
async function devLogin(form: FormData) {
    "use server";
    if (process.env.NODE_ENV !== "development")
        notFound();
    const username = String(form.get("username") ?? "");
    if (!username.startsWith(TEST_PREFIX))
        notFound();
    const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.username, username) });
    if (!user)
        notFound();
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
async function DevLoginPage() {
    if (process.env.NODE_ENV !== "development")
        notFound();
    const [{ next }, testUsers] = await Promise.all([
        searchParams,
        db.select().from(users).where(like(users.username, `${TEST_PREFIX}%`)).orderBy(asc(users.username)),
    ]);
    return (<div className="mx-auto max-w-2xl">
      <PageTitle sub="Bare tilgjengelig i lokal utvikling. Finnes ikke i produksjonsbygget.">Testbrukere</PageTitle>
      {!testUsers.length && <p className="text-zinc-400">Ingen testbrukere. Kjør pnpm db:seed.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {testUsers.map((u) => (<Card key={u.id}>
            <form action={devLogin} className="space-y-3">
              <input type="hidden" name="username" value={u.username}/>
              <input type="hidden" name="next" value={safeNext(next)}/>
              <div>
                <p className="font-medium text-white">{u.name}</p>
                <p className="text-xs text-zinc-500">{u.username}</p>
              </div>
              <Checkbox name="kok" defaultChecked={u.username === "test-kokleder"}>Leder i KoK</Checkbox>
              <Checkbox name="index" defaultChecked={u.username === "test-indexleder"}>Leder i Index</Checkbox>
              <Button type="submit">Logg inn som {u.name.split(" ")[0]}</Button>
            </form>
          </Card>))}
      </div>
    </div>);
}

export const Route = createFileRoute("/(site)/dev/")({ component: DevLoginPage });
