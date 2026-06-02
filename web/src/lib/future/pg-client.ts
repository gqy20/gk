import pg from "pg";
import type { Queryable } from "./postgres";

let pool: pg.Pool | null = null;

export function getPostgresPool(): Queryable {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for PostgresFutureRepository");
  }

  pool ??= new pg.Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_SIZE || 3),
    idleTimeoutMillis: 10_000,
  });

  return {
    query: async <T = Record<string, unknown>>(sql: string, params?: unknown[]) => {
      const result = await pool!.query(sql, params);
      return { rows: result.rows as T[] };
    },
  };
}
