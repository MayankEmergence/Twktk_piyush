import pg from "pg";
import { existsSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load .env automatically if present
try {
  if (typeof process.loadEnvFile === "function") {
    const envFile = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../.env",
    );
    if (existsSync(envFile)) {
      process.loadEnvFile(envFile);
    }
  }
} catch {}

const dbUrl = (process.env.DATABASE_URL || "").trim();
const isLocalPglite =
  dbUrl === "local" || dbUrl === "pglite" || dbUrl.startsWith("pglite://");

let pgliteInstance: any = null;
let pgliteInitPromise: Promise<any> | null = null;

async function getPglite() {
  if (pgliteInstance) return pgliteInstance;
  if (pgliteInitPromise) return pgliteInitPromise;
  pgliteInitPromise = (async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const dataDir = process.env.VERCEL
      ? path.join("/tmp", ".data/db")
      : path.resolve(
          path.dirname(fileURLToPath(import.meta.url)),
          "../.data/db",
        );
    mkdirSync(dataDir, { recursive: true });
    const db = new PGlite(dataDir);
    // Check if schema needs to be applied
    try {
      await db.query("SELECT 1 FROM events LIMIT 1");
    } catch {
      let sql = "";
      const candidates = [
        path.resolve(path.dirname(fileURLToPath(import.meta.url)), "schema.sql"),
        path.resolve(process.cwd(), "server/schema.sql"),
        path.resolve(process.cwd(), "schema.sql"),
      ];
      for (const p of candidates) {
        if (existsSync(p)) {
          sql = await readFile(p, "utf8");
          break;
        }
      }
      if (sql) {
        await db.exec(sql);
        console.log("Local PGlite database initialized with schema.sql");
      }
    }
    pgliteInstance = db;
    return db;
  })();
  return pgliteInitPromise;
}

class PGlitePool {
  async query(text: string, params?: any[]) {
    const db = await getPglite();
    if (!params || params.length === 0) {
      if (text.includes(";")) {
        const res = await db.exec(text);
        const last = Array.isArray(res) ? res[res.length - 1] : res;
        return { rows: last?.rows || [], rowCount: last?.rows?.length ?? 0 };
      }
    }
    const res = await db.query(text, params);
    return { rows: res.rows || [], rowCount: res.rows?.length ?? 0 };
  }
  async connect() {
    const db = await getPglite();
    return {
      query: async (text: string, params?: any[]) => {
        if (!params || params.length === 0) {
          if (text.includes(";")) {
            const res = await db.exec(text);
            const last = Array.isArray(res) ? res[res.length - 1] : res;
            return {
              rows: last?.rows || [],
              rowCount: last?.rows?.length ?? 0,
            };
          }
        }
        const res = await db.query(text, params);
        return { rows: res.rows || [], rowCount: res.rows?.length ?? 0 };
      },
      release: () => {},
    };
  }
  async end() {
    if (pgliteInstance) {
      await pgliteInstance.close();
      pgliteInstance = null;
    }
  }
}

export const pool: any = isLocalPglite
  ? new PGlitePool()
  : new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 5000,
      ssl:
        process.env.DATABASE_SSL === "true"
          ? { rejectUnauthorized: true }
          : undefined,
    });

export const databaseReady = () => Boolean(dbUrl);
