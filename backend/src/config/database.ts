import { Pool, PoolClient } from 'pg';
import { databaseLogger } from './logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  databaseLogger.error('Unexpected database pool error', {
    message: err.message,
    stack: err.stack,
  });
});

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const start = Date.now();
  try {
    const result = await pool.query(sql, params);
    if (process.env.NODE_ENV === 'development') {
      databaseLogger.debug('Query executed', {
        query: sql,
        duration: `${Date.now() - start}ms`,
      });
    }
    return result.rows as T[];
  } catch (err: any) {
    databaseLogger.error('Database query error', {
      query: sql,
      message: err.message,
    });
    throw err;
  }
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
