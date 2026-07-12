// Сброс пароля пользователя.
// Запуск: npm run set:password -- email@пользователя.ru НОВЫЙ_ПАРОЛЬ
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const email = (process.argv[2] || '').toLowerCase();
const pw = process.argv[3] || '';
if (!email || !pw) {
  console.error('Использование: npm run set:password -- <email> <новый_пароль>');
  process.exit(1);
}

try {
  const hash = await bcrypt.hash(pw, 10);
  const { rowCount } = await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, email]);
  console.log(rowCount ? `✅ Пароль для ${email} обновлён.` : `❌ Пользователь ${email} не найден.`);
} catch (e) {
  console.error('Ошибка:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
