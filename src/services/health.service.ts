import { query } from "../clients/postgres.client";

export async function checkDatabase(): Promise<{ ok: boolean; serverTime?: string; error?: string }> {
    try {
        const [row] = await query<{ now: Date }>("SELECT now() AS now");
        return { ok: true, serverTime: row.now.toISOString() };
    } catch (err) {
        return { ok: false, error: (err as Error).message };
    }
}
