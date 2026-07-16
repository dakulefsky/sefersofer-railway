import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Singleton pattern — reuse the connection across hot reloads in dev
const globalForDb = globalThis as unknown as {
  _pgClient?: postgres.Sql;
  _db?: PostgresJsDatabase<typeof schema>;
};

function createDb(): PostgresJsDatabase<typeof schema> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set.");
  }

  const client =
    globalForDb._pgClient ??
    postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForDb._pgClient = client;
  }

  return drizzle(client, { schema });
}

function getDb(): PostgresJsDatabase<typeof schema> {
  if (!globalForDb._db) {
    globalForDb._db = createDb();
  }
  return globalForDb._db;
}

// Lazy getter — only connects when first accessed at runtime (not at build time)
export const db: PostgresJsDatabase<typeof schema> = new Proxy(
  {} as PostgresJsDatabase<typeof schema>,
  {
    get(_target, prop: string | symbol) {
      const instance = getDb();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (instance as any)[prop];
    },
  }
);

export * from "./schema";
