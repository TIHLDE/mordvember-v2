import next from "eslint-config-next/core-web-vitals";
import ts from "eslint-config-next/typescript";

const config = [
  ...next,
  ...ts,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='input'] > JSXAttribute[name.name='type'][value.value=/^(date|datetime-local|time|month|week)$/]",
          message: "Bruk <DateTimePicker> fra @/components/DateTimePicker i stedet for native dato- og tidsfelt.",
        },
      ],
    },
  },
  { ignores: [".next/**", "node_modules/**", "drizzle/**", "next-env.d.ts", ".data/**"] },
];

export default config;
