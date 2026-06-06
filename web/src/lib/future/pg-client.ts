import pg from "pg";
import type { Queryable } from "./postgres";
import { createLogger } from "./logger";

const log = createLogger("pg-client");

let pool: pg.Pool | null = null;

export function getPostgresPool(): Queryable {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    log.error("DATABASE_URL is required for PostgresFutureRepository");
    throw new Error("DATABASE_URL is required for PostgresFutureRepository");
  }

  if (!pool) {
    const poolSize = Number(process.env.DATABASE_POOL_SIZE || 3);
    log.info({ poolSize, idleTimeoutMs: 10_000 }, "Creating PostgreSQL connection pool");
    pool = new pg.Pool({
      connectionString,
      max: poolSize,
      idleTimeoutMillis: 10_000,
    });
  } else {
    log.debug("Reusing existing PostgreSQL connection pool");
  }

  return {
    query: async <T = Record<string, unknown>>(sql: string, params?: unknown[]) => {
      const result = await pool!.query(sql, params);
      return { rows: result.rows as T[] };
    },
  };
}
