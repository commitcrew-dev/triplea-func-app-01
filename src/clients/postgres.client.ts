import { Pool, PoolClient, QueryResultRow } from "pg";
import { optionalEnv, requireEnv } from "../config/env";

// One pool per Functions worker process, created on first use and reused across
// invocations. Keep `max` small: every scaled-out instance gets its own pool, so
// total connections = instances × max.
let pool: Pool | undefined;

export function getPool(): Pool {
    if (!pool) {
        pool = new Pool({
            connectionString: requireEnv("POSTGRES_CONNECTION_STRING"),
            max: Number(optionalEnv("POSTGRES_POOL_MAX", "5")),
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 10_000,
        });

        // An idle client can error (e.g. server restart). Without a listener this
        // would crash the worker; the pool discards the client and reconnects.
        pool.on("error", (err) => {
            console.error("Postgres pool error", err);
        });
    }
    return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
): Promise<T[]> {
    const result = await getPool().query<T>(text, params);
    return result.rows;
}

/** Runs `fn` inside BEGIN/COMMIT, rolling back if it throws. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await getPool().connect();
    try {
        await client.query("BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}
