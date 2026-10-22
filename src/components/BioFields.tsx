import { BIO_FIELD_MAX, BIO_FIELDS, type BioValues } from "@/game/bio";
import { Field, inputClass } from "./ui";

export function BioFields({ values }: { values: BioValues }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {BIO_FIELDS.map(({ key, label, placeholder }) => (
        <Field key={key} label={label}>
          <input name={`bio_${key}`} defaultValue={values[key] ?? ""} placeholder={placeholder} maxLength={BIO_FIELD_MAX} className={inputClass} />
        </Field>
      ))}
    </div>
  );
}
