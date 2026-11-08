import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

import { notFound, redirect } from "@tanstack/react-router";
import { Button, Card, Checkbox, PageTitle } from "@/components/ui";

import { safeNext } from "@/lib/redirect";

const TEST_PREFIX = "test-";
const devLoginRpc = createServerFn({ method: "POST" })
  .validator((value: unknown) => {
    if (!(value instanceof FormData)) throw new Error("Ugyldig skjema");
    return value;
  })
  .handler(async ({ data: form }) => {
    const { db } = await import("@/db");
    const { onLogin } = await import("@/server/auth/login");

    if (process.env.NODE_ENV !== "development") throw notFound();
    const username = form.get("username");
    if (typeof username !== "string") throw notFound();
    if (!username.startsWith(TEST_PREFIX)) throw notFound();
    const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.username, username) });
    if (!user) throw notFound();
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
    const target = form.get("next");
    throw redirect({ href: safeNext(typeof target === "string" ? target : "/") });
  });
function devLogin(form: FormData) {
  return devLoginRpc({ data: form });
}
function DevLoginPage() {
  const { next, testUsers } = Route.useLoaderData();
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle sub="Bare tilgjengelig i lokal utvikling. Finnes ikke i produksjonsbygget.">
        Testbrukere
      </PageTitle>
      {!testUsers.length && (
        <p className="text-zinc-400">Ingen testbrukere. Kjør vp run db:seed.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {testUsers.map((u) => (
          <Card key={u.id}>
            <form action={devLogin} className="space-y-3">
              <input type="hidden" name="username" value={u.username} />
              <input type="hidden" name="next" value={safeNext(next)} />
              <div>
                <p className="font-medium text-white">{u.name}</p>
                <p className="text-xs text-zinc-500">{u.username}</p>
              </div>
              <Checkbox name="kok" defaultChecked={u.username === "test-kokleder"}>
                Leder i KoK
              </Checkbox>
              <Checkbox name="index" defaultChecked={u.username === "test-indexleder"}>
                Leder i Index
              </Checkbox>
              <Button type="submit">Logg inn som {u.name.split(" ")[0]}</Button>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/(site)/dev/")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  validateSearch: (search: Record<string, unknown>): { next?: string } => ({
    next: typeof search.next === "string" ? search.next : undefined,
  }),
  loaderDeps: ({ search }) => ({ next: search.next }),
  loader: ({ deps, location }) =>
    loadDevLoginPage({ data: deps.next ?? "", headers: { "x-mv-path": location.href } }),
  component: DevLoginPage,
});

const loadDevLoginPage = createServerFn({ method: "GET" })
  .validator((value: unknown) => {
    if (typeof value !== "string") throw new Error("Ugyldig parameter");
    return value;
  })
  .handler(async ({ data }) => {
    const { asc, like } = await import("drizzle-orm");
    const { db } = await import("@/db");
    const { users } = await import("@/db/schema");
    if (process.env.NODE_ENV !== "development") throw notFound();
    const next = data;
    const testUsers = await db
      .select()
      .from(users)
      .where(like(users.username, `${TEST_PREFIX}%`))
      .orderBy(asc(users.username));
    return { next, testUsers };
  });
