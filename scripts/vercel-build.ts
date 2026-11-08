import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV;

// Preview endpoints must be authenticated too, even though Vercel only schedules production jobs.
if (env && !process.env.CRON_SECRET) {
  console.error("Mangler CRON_SECRET. Sett den i Vercel-prosjektet før utrulling.");
  process.exit(1);
}

if (env === "production") {
  // Uten database feiler bygget med vilje, så Vercel beholder forrige deploy i stedet for å publisere en side som svarer 500.
  const missing = ["DATABASE_URL", "QR_SECRET", "CRON_SECRET"].filter((key) => !process.env[key]);
  // Nyere Blob-lagre bruker OIDC med BLOB_STORE_ID i stedet for en token.
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID)
    missing.push("BLOB_READ_WRITE_TOKEN eller BLOB_STORE_ID");
  if (missing.length) {
    console.error(
      `Mangler ${missing.join(", ")}. Koble Neon og Blob til Vercel-prosjektet før produksjon kan bygges.`,
    );
    process.exit(1);
  }
  execSync("vpx scripts/migrate.ts", { stdio: "inherit" });
} else {
  console.log(`Hopper over migrering (VERCEL_ENV=${env ?? "ikke satt"})`);
}
