// Utseende-feltene lagres samlet som én tekst ("Etikett: verdi" per linje) og vises til den som har deg som offer.
export const BIO_FIELDS = [
  { key: "eyes", label: "Øyenfarge", placeholder: "Blå" },
  { key: "height", label: "Høyde", placeholder: "180 cm" },
  { key: "hair", label: "Hårfarge", placeholder: "Brun, kort" },
  { key: "study", label: "Studie", placeholder: "Dataingeniør" },
  { key: "year", label: "Klassetrinn", placeholder: "2. klasse" },
] as const;

export type BioKey = (typeof BIO_FIELDS)[number]["key"];
export type BioValues = Partial<Record<BioKey, string>>;

export const BIO_FIELD_MAX = 100;

export function composeBio(values: BioValues): string | null {
  const lines = BIO_FIELDS.flatMap(({ key, label }) => {
    const value = (values[key] ?? "").replace(/\s+/g, " ").trim().slice(0, BIO_FIELD_MAX);
    return value ? [`${label}: ${value}`] : [];
  });
  return lines.length ? lines.join("\n") : null;
}

export function parseBio(bio: string | null | undefined): BioValues {
  const values: BioValues = {};
  for (const line of (bio ?? "").split("\n")) {
    const field = BIO_FIELDS.find(({ label }) => line.startsWith(`${label}:`));
    if (field) values[field.key] = line.slice(field.label.length + 1).trim();
  }
  return values;
}
