import "server-only";

export const isDevelopment = process.env.NODE_ENV === "development";

export const env = {
  get appUrl() {
    return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get photonIssuer() {
    return process.env.PHOTON_ISSUER ?? "https://photon.tihlde.org/api/auth";
  },
  get photonApi() {
    return this.photonIssuer.replace(/\/auth$/, "");
  },
  get photonClientId() {
    return process.env.PHOTON_CLIENT_ID ?? "";
  },
  get photonClientSecret() {
    return process.env.PHOTON_CLIENT_SECRET ?? "";
  },
  get emailApiKey() {
    return process.env.PHOTON_EMAIL_API_KEY ?? "";
  },
  get emailFrom() {
    return process.env.EMAIL_FROM ?? "no-reply@tihlde.org";
  },
  get qrSecret() {
    const secret = process.env.QR_SECRET;
    if (!secret) throw new Error("QR_SECRET mangler");
    return secret;
  },
  get cronSecret() {
    return process.env.CRON_SECRET ?? "";
  },
  get blobToken() {
    return process.env.BLOB_READ_WRITE_TOKEN ?? "";
  },
};

export const STUDY_REPORT_ADDRESS = "teknologiminister@tihlde.org";
