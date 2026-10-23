import type { Page } from "playwright";

export type LeaderFlags = { kok?: boolean; index?: boolean };

// Logs in through the local /dev page with the given Photon leader roles, then waits for the redirect to `next`.
export async function devLogin(page: Page, base: string, username: string, flags: LeaderFlags = {}, next = "/") {
  page.on("dialog", (d) => void d.accept());
  await page.goto(next === "/" ? `${base}/dev` : `${base}/dev?next=${encodeURIComponent(next)}`);
  const card = page.locator("form", { has: page.locator(`input[name=username][value="${username}"]`) });
  for (const flag of ["kok", "index"] as const) {
    const box = card.locator(`input[name=${flag}]`);
    if ((await box.isChecked()) !== !!flags[flag]) await box.click();
  }
  await card.getByRole("button").click();
  await page.waitForURL(`${base}${next}`);
}
