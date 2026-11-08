import { BIO_FIELD_MAX, BIO_FIELDS, bioOptions, type BioValues } from "@/game/bio";
import { inputClass } from "./styles";
import { Field } from "./ui";

export function BioFields({ values }: { values: BioValues }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {BIO_FIELDS.map(({ key, label, placeholder }) => {
        const options = bioOptions(key);
        return (
          <Field key={key} label={label}>
            {options ? (
              <select
                name={`bio_${key}`}
                defaultValue={options.includes(values[key] ?? "") ? values[key] : ""}
                className={inputClass}
              >
                <option value="">{placeholder}</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={`bio_${key}`}
                defaultValue={values[key] ?? ""}
                placeholder={placeholder}
                maxLength={BIO_FIELD_MAX}
                className={inputClass}
              />
            )}
          </Field>
        );
      })}
    </div>
  );
}
