import { readFile } from "node:fs/promises";
import { pool, databaseReady } from "./db";
if (!databaseReady())
  throw new Error("Set DATABASE_URL to your hosted PostgreSQL database.");
await pool.query(
  await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
);
await pool.end();
console.log("Database schema ready.");
