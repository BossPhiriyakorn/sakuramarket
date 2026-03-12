/**
 * Transaction helper — ใช้สำหรับจองล็อค+ชำระเงิน เพื่อกันการชน
 * แยกจาก lib/db เพื่อให้ bundler resolve ชัดเจน
 */
import type { PoolClient } from "pg";
import { pool } from "@/lib/db";

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
