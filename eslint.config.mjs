import next from "eslint-config-next/core-web-vitals";
import ts from "eslint-config-next/typescript";

const config = [
  ...next,
  ...ts,
  { ignores: [".next/**", "node_modules/**", "drizzle/**", "next-env.d.ts", ".data/**"] },
];

export default config;
