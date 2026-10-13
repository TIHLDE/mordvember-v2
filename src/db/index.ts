import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

// Kobler først ved første spørring, så bygget går gjennom uten DATABASE_URL.
export const sql =
  globalForDb.sql ?? postgres(process.env.DATABASE_URL ?? "", { max: process.env.VERCEL ? 1 : 10, prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;

export const db = drizzle(sql, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
