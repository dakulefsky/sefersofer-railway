import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Singleton pattern — reuse the connection across hot reloads in dev
const globalForDb = globalThis as unknown as { _pgClient?: postgres.Sql };

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set.");
}

const client =
  globalForDb._pgClient ??
  postgres(connectionString, {
    max: 10,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb._pgClient = client;
}

export const db = drizzle(client, { schema });
export * from "./schema";
