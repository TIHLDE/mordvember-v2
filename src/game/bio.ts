// Utseende-feltene lagres samlet som én tekst ("Etikett: verdi" per linje) og vises til den som har deg som offer.
export const BIO_FIELDS = [
  { key: "eyes", label: "Øyenfarge", placeholder: "Blå" },
  { key: "height", label: "Høyde", placeholder: "180 cm" },
  { key: "hair", label: "Hårfarge", placeholder: "Brun, kort" },
  { key: "study", label: "Studie", placeholder: "Velg studie", options: ["Data", "DigFor", "DigSec", "DigTrans"] },
  { key: "year", label: "Klassetrinn", placeholder: "Velg klassetrinn", options: ["1. klasse", "2. klasse", "3. klasse", "4. klasse", "5. klasse"] },
] as const;

// Felt med faste valg godtar bare disse verdiene, så et forfalsket skjema ikke kan lagre fritekst.
export function bioOptions(key: BioKey): readonly string[] | undefined {
  const field = BIO_FIELDS.find((f) => f.key === key);
  return field && "options" in field ? field.options : undefined;
}

export type BioKey = (typeof BIO_FIELDS)[number]["key"];
export type BioValues = Partial<Record<BioKey, string>>;

export const BIO_FIELD_MAX = 100;

export function composeBio(values: BioValues): string | null {
  const lines = BIO_FIELDS.flatMap(({ key, label }) => {
    const value = (values[key] ?? "").replace(/\s+/g, " ").trim().slice(0, BIO_FIELD_MAX);
    const options = bioOptions(key);
    if (options && !options.includes(value)) return [];
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
