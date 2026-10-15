import pg from "pg";
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
  ssl:
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: true }
      : undefined,
});
export const databaseReady = () => Boolean(process.env.DATABASE_URL);
