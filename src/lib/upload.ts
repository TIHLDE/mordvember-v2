// Vercel rejects request bodies above 4.5 MB before our code runs, so the limit has to stay below that.
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const IMAGE_TOO_LARGE = "Bildet er større enn 4 MB. Velg et mindre bilde.";
