import pg from "pg";
import { readFile } from "node:fs/promises";
if (!process.env.DATABASE_URL)
  throw new Error("Set DATABASE_URL in Hostinger before launching.");
const migrationPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: true }
      : undefined,
  connectionTimeoutMillis: 10000,
});
try {
  await migrationPool.query(
    await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
  );
} finally {
  await migrationPool.end();
}
await import("./app");
