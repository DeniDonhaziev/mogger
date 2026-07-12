// Делает пользователя оператором поддержки.
// Запуск: npm run make:support -- email@пользователя.ru
import { pool } from './db.js';

const email = (process.argv[2] || '').toLowerCase();
if (!email) {
  console.error('Использование: npm run make:support -- <email>');
  process.exit(1);
}

try {
  const { rowCount } = await pool.query("UPDATE users SET role = 'support' WHERE email = $1", [email]);
  console.log(rowCount ? `✅ ${email} теперь оператор (support). Перезайдите в аккаунт.` : `❌ Пользователь ${email} не найден.`);
} catch (e) {
  console.error('Ошибка:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
