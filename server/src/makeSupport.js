// Делает пользователя главным админом (полный доступ + управление операторами).
// Запуск: npm run make:admin -- email@пользователя.ru
import { pool } from './db.js';

const email = (process.argv[2] || '').toLowerCase();
if (!email) {
  console.error('Использование: npm run make:admin -- <email>');
  process.exit(1);
}

try {
  const { rowCount } = await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [email]);
  console.log(rowCount ? `✅ ${email} теперь главный админ. Перезайдите в /admin.` : `❌ Пользователь ${email} не найден. Сначала зарегистрируйтесь на сайте.`);
} catch (e) {
  console.error('Ошибка:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
