import "@tanstack/react-start/server-only";
import { and, eq, inArray, ne, sql as dsql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { type EmailBlock, emailOutbox, emailTemplates } from "@/db/schema";
import { env, isDevelopment } from "./env";

export type TemplateKey = keyof typeof DEFAULT_TEMPLATES;

export const DEFAULT_TEMPLATES = {
  game_start: {
    label: "Spillet starter",
    subject: "Mordvember har startet",
    body: "Spillet er i gang, og ditt første offer er klart.\n\nLogg inn og trykk på «Vis offer» under «Mitt offer» for å se hvem det er. Ikke vis skjermen til noen.",
    button: "/offer",
  },
  new_target: {
    label: "Nytt offer",
    subject: "Du har fått et nytt offer",
    body: "Du har fått et nytt offer i Mordvember. Logg inn for å se hvem.",
    button: "/offer",
  },
  kill_confirm: {
    label: "Bekreft drap",
    subject: "Et drap du er part i venter på bekreftelse",
    body: "Noen har meldt et drap der du er part. Logg inn og bekreft, eller si fra hvis det ikke stemmer. Uten svar innen 12 timer går saken til spillmesterne.",
    button: "/drap",
  },
  weekly_warning: {
    label: "Advarsel før fredagssjekken",
    subject: "Du ligger an til å ryke ut av Mordvember",
    body: "Fredag kl. 16.00 sjekkes ukas krav. Slik ligger du an nå:\n\n{{mangler}}\n\nDu rekker det fortsatt hvis du møter opp i morgen.",
    button: "/oppmote",
  },
  disqualified: {
    label: "Diskvalifisert",
    subject: "Du er diskvalifisert fra Mordvember",
    body: "Du er tatt ut av spillet.\n\nBegrunnelse: {{grunn}}",
    button: "/",
  },
  eliminated: {
    label: "Eliminert",
    subject: "Du er eliminert",
    body: "Drapet på deg er bekreftet, og du er ute av spillet. Takk for innsatsen!",
    button: "/",
  },
  image_rejected: {
    label: "Bilde avvist",
    subject: "Bildet ditt i Mordvember ble avvist",
    body: "Spillmesterne har avvist bildet ditt.\n\nMelding: {{melding}}\n\nLast opp et nytt bilde der ansiktet vises tydelig.",
    button: "/profil",
  },
  staff_case: {
    label: "Sak til godkjenning",
    subject: "Ny drapssak til godkjenning",
    body: "En drapssak trenger en avgjørelse.\n\nÅrsak: {{grunn}}",
    button: "/admin/drap",
  },
  staff_question: {
    label: "Nytt spørsmål",
    subject: "Nytt spørsmål til spillmesterne",
    body: "Det har kommet et nytt spørsmål i innboksen.",
    button: "/admin/sporsmal",
  },
  question_answered: {
    label: "Svar på spørsmål",
    subject: "Spillmesterne har svart deg",
    body: "Spørsmål: {{sporsmal}}\n\nSvar: {{svar}}",
    button: "/sporsmal",
  },
  emergency_access: {
    label: "Nødtilgang aktivert",
    subject: "Nødtilgang til sirkelen er slått på",
    body: "{{navn}} har slått på nødtilgang til sirkelen i én time.\n\nBegrunnelse: {{grunn}}",
    button: "/admin/logg",
  },
} as const;

function render(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(vars[key] ?? ""));
}

// Takes the caller's transaction: on Vercel the pool has a single connection, so reaching for `db` while a transaction holds it deadlocks.
async function templateFor(tx: Tx | typeof db, key: TemplateKey) {
  const override = await tx.query.emailTemplates.findFirst({ where: eq(emailTemplates.key, key) });
  const base = DEFAULT_TEMPLATES[key];
  return {
    subject: override?.subject ?? base.subject,
    body: override?.body ?? base.body,
    button: base.button,
  };
}

function blocks(body: string, button: string | null): EmailBlock[] {
  // Browsers submit textarea line breaks as CRLF.
  const content: EmailBlock[] = body
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({ type: "text", content: p }));
  if (button)
    content.push({ type: "button", text: "Åpne Mordvember", url: `${env.appUrl}${button}` });
  return content;
}

async function insertOutbox(
  tx: Tx | typeof db,
  to: readonly (string | null | undefined)[],
  subject: string,
  content: EmailBlock[],
) {
  const recipients = [...new Set(to.filter((t): t is string => !!t))];
  if (!recipients.length) return 0;
  await tx
    .insert(emailOutbox)
    .values(recipients.map((address) => ({ to: address, subject, content })));
  return recipients.length;
}

export async function queueEmail(
  tx: Tx | typeof db,
  key: TemplateKey,
  to: readonly (string | null | undefined)[],
  vars: Record<string, string | number> = {},
) {
  if (!to.some(Boolean)) return;
  const template = await templateFor(tx, key);
  await insertOutbox(
    tx,
    to,
    render(template.subject, vars),
    blocks(render(template.body, vars), template.button),
  );
}

/** A one-off message written by a gamemaster, sent as is. Returns how many addresses it was queued for. */
export async function queueCustomEmail(
  tx: Tx | typeof db,
  to: readonly (string | null | undefined)[],
  subject: string,
  body: string,
) {
  return insertOutbox(tx, to, subject, blocks(body, "/"));
}

async function sendViaPhoton(to: string, subject: string, content: EmailBlock[]) {
  const response = await fetch(`${env.photonApi}/email/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.emailApiKey}` },
    body: JSON.stringify({ to, from: env.emailFrom, subject, content }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Photon e-post ${response.status}: ${detail.slice(0, 200)}`);
  }
}

export async function deliverPendingEmails(limit = 50) {
  // Hentes og merkes i én spørring, så cron og utsending etter en handling aldri tar samme e-post.
  const claimed = await db.execute<{ id: string }>(dsql`
    update email_outbox set claimed_at = now(), attempts = attempts + 1
    where id in (
      select id from email_outbox
      where status in ('pending', 'failed') and attempts < 5
        and (claimed_at is null or claimed_at < now() - interval '5 minutes')
      order by created_at
      limit ${limit}
      for update skip locked
    )
    returning id`);
  if (!claimed.length) return 0;
  let failed = 0;
  const mails = await db
    .select()
    .from(emailOutbox)
    .where(
      inArray(
        emailOutbox.id,
        claimed.map((c) => c.id),
      ),
    );
  for (const mail of mails) {
    try {
      // Nullstilling sletter også e-post som alt er hentet her, så raden sjekkes rett før hver sending. Uten treff er den borte.
      // Oppdateringen venter på en nullstilling som er i gang, noe en vanlig lesing ikke ville gjort.
      const [current] = await db
        .update(emailOutbox)
        .set({ claimedAt: new Date() })
        .where(and(eq(emailOutbox.id, mail.id), ne(emailOutbox.status, "sent")))
        .returning({ id: emailOutbox.id });
      if (!current) continue;
      if (env.emailApiKey) {
        await sendViaPhoton(mail.to, mail.subject, mail.content);
      } else if (isDevelopment) {
        console.info(`[e-post til ${mail.to}] ${mail.subject}`);
      } else {
        throw new Error("PHOTON_EMAIL_API_KEY mangler");
      }
      await db
        .update(emailOutbox)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(emailOutbox.id, mail.id));
    } catch (error) {
      failed++;
      await db
        .update(emailOutbox)
        .set({ status: "failed", claimedAt: null, lastError: String(error).slice(0, 500) })
        .where(eq(emailOutbox.id, mail.id));
    }
  }
  return failed;
}
