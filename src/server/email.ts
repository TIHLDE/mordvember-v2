import "server-only";
import { eq, inArray, sql as dsql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { type EmailBlock, emailOutbox, emailTemplates } from "@/db/schema";
import { env, isDevelopment } from "./env";

export type TemplateKey = keyof typeof DEFAULT_TEMPLATES;

export const DEFAULT_TEMPLATES = {
  game_start: {
    label: "Spillet starter",
    subject: "Mordvember har startet",
    body: "Spillet er i gang, og ditt første offer er klart.\n\nLogg inn og hold inne knappen på «Mitt offer» for å se hvem det er. Ikke vis skjermen til noen.",
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
    body: "Noen har meldt et drap der du er part. Logg inn og bekreft, eller si fra hvis det ikke stemmer. Uten svar innen 12 timer går saken til arrangørene.",
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
    body: "Arrangørene har avvist bildet ditt.\n\nMelding: {{melding}}\n\nLast opp et nytt bilde der ansiktet vises tydelig.",
    button: "/profil",
  },
  study_wrong: {
    label: "Feil studie eller kull",
    subject: "Feil studie eller kull meldt fra Mordvember",
    body: "En bruker sier at studieprogram eller kull i Photon ikke stemmer.\n\nBrukernavn: {{brukernavn}}\nStudieprogram i Photon: {{studie}}\nKull i Photon: {{kull}}",
    button: "",
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
  milestone: {
    label: "Milepæl",
    subject: "Mordvember: {{milepael}}",
    body: "{{milepael}}. Det er {{igjen}} spillere igjen.",
    button: "/",
  },
  emergency_access: {
    label: "Nødtilgang aktivert",
    subject: "Nødtilgang til sirkelen er slått på",
    body: "{{navn}} har slått på nødtilgang til sirkelen i én time.\n\nBegrunnelse: {{grunn}}",
    button: "/admin/logg",
  },
  deletion_reminder: {
    label: "Påminnelse om sletting",
    subject: "Husk å slette sesongdata for {{sesong}}",
    body: "Det er 30 dager siden {{sesong}} ble avsluttet. Slett navn, bilder og spilldata i adminpanelet.",
    button: "/admin/sesong",
  },
} as const;

export function render(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(vars[key] ?? ""));
}

export async function templateFor(key: TemplateKey) {
  const override = await db.query.emailTemplates.findFirst({ where: eq(emailTemplates.key, key) });
  const base = DEFAULT_TEMPLATES[key];
  return { subject: override?.subject ?? base.subject, body: override?.body ?? base.body, button: base.button };
}

export async function queueEmail(
  tx: Tx | typeof db,
  key: TemplateKey,
  to: readonly (string | null | undefined)[],
  vars: Record<string, string | number> = {},
) {
  const recipients = [...new Set(to.filter((t): t is string => !!t))];
  if (!recipients.length) return;
  const template = await templateFor(key);
  const content: EmailBlock[] = render(template.body, vars)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({ type: "text", content: p }));
  if (template.button) content.push({ type: "button", text: "Åpne Mordvember", url: `${env.appUrl}${template.button}` });
  await tx.insert(emailOutbox).values(
    recipients.map((address) => ({ to: address, subject: render(template.subject, vars), content })),
  );
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
  if (!claimed.length) return;
  const mails = await db.select().from(emailOutbox).where(inArray(emailOutbox.id, claimed.map((c) => c.id)));
  for (const mail of mails) {
    try {
      if (env.emailApiKey) {
        await sendViaPhoton(mail.to, mail.subject, mail.content);
      } else if (isDevelopment) {
        console.info(`[e-post til ${mail.to}] ${mail.subject}`);
      } else {
        throw new Error("PHOTON_EMAIL_API_KEY mangler");
      }
      await db.update(emailOutbox).set({ status: "sent", sentAt: new Date() }).where(eq(emailOutbox.id, mail.id));
    } catch (error) {
      await db
        .update(emailOutbox)
        .set({ status: "failed", claimedAt: null, lastError: String(error).slice(0, 500) })
        .where(eq(emailOutbox.id, mail.id));
    }
  }
}
