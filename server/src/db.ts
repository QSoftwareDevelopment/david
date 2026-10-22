import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The one thing the rest of the server knows about Postgres.
 *
 * Production passes a `pg` pool; tests and the local demo pass PGlite, an
 * in-process Postgres. Both run the same SQL, so what the tests prove about a
 * query is true of the real thing.
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
  /** Run a script of several statements (no parameters). */
  exec(sql: string): Promise<void>;
  /** Run several statements as one unit; everything or nothing. */
  tx<R>(fn: (db: Db) => Promise<R>): Promise<R>;
  close(): Promise<void>;
}

export async function pgDb(connectionString: string): Promise<Db> {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString, max: 8, ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false } });
  const wrap = (c: { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }> }): Db["query"] =>
    async (sql, params) => {
      const r = await c.query(sql, params);
      return { rows: r.rows as never[], rowCount: r.rowCount ?? 0 };
    };
  const make = (c: Parameters<typeof wrap>[0], own: boolean): Db => ({
    query: wrap(c),
    async exec(sql) {
      await c.query(sql);
    },
    async tx(fn) {
      if (!own) return fn(make(c, false));
      const client = await pool.connect();
      try {
        await client.query("begin");
        const out = await fn(make(client, false));
        await client.query("commit");
        return out;
      } catch (error) {
        await client.query("rollback").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      if (own) await pool.end();
    },
  });
  return make(pool, true);
}

export async function pgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const lite = dataDir ? new PGlite(dataDir) : new PGlite();
  await lite.waitReady;
  const make = (c: { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[]; affectedRows?: number }> }, inTx: boolean): Db => ({
    async query(sql, params) {
      const r = await c.query(sql, params);
      return { rows: r.rows as never[], rowCount: r.affectedRows ?? r.rows.length };
    },
    async exec(sql) {
      await (c as unknown as { exec: (s: string) => Promise<unknown> }).exec(sql);
    },
    async tx(fn) {
      if (inTx) return fn(make(c, true));
      return lite.transaction((t) => fn(make(t as never, true)));
    },
    async close() {
      if (!inTx) await lite.close();
    },
  });
  return make(lite as never, false);
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.resolve(HERE, "../../supabase/migrations");

/** Apply every migration in order. They are written to be safe to run twice. */
export async function migrate(db: Db, dir = MIGRATIONS_DIR): Promise<string[]> {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    await db.exec(sql);
  }
  return files;
}
