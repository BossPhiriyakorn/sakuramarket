/**
 * การเชื่อมต่อ PostgreSQL สำหรับ Sakura Market
 * ใช้ตัวแปรจาก .env: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 */
import pg from "pg";

const pool = new pg.Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "sakuramarket",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

/** ใช้ withTransaction จาก @/lib/dbTransaction (แยกไฟล์เพื่อให้ bundler resolve ถูกต้อง) */
export { pool };
