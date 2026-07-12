import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const url = process.env.DATABASE_URL || '';
const isLocal = url.includes('localhost') || url.includes('127.0.0.1');

export const pool = new Pool({
  connectionString: url,
  // облачные Postgres (Neon/Railway/Supabase) требуют SSL; локальный — нет
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => console.error('Postgres pool error:', err));
