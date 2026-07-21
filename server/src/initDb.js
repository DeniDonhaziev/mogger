// Создаёт таблицы в базе. Запуск: npm run db:init
import fs from 'fs';
import { pool } from './db.js';

const sql = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

try {
  await pool.query(sql);
  await pool.query('ALTER TABLE chats ADD COLUMN IF NOT EXISTS support_read_at TIMESTAMPTZ');
  console.log('✅ База инициализирована (таблицы созданы).');
} catch (e) {
  console.error('❌ Ошибка инициализации базы:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
