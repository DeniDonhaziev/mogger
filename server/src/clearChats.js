// Полная очистка всех чатов и сообщений (пользователи и админы остаются).
// Запуск: npm run db:clear-chats
import { pool } from './db.js';

try {
  const { rowCount: msgCount } = await pool.query('DELETE FROM messages');
  const { rowCount: chatCount } = await pool.query('DELETE FROM chats');
  console.log(`✅ Очищено: ${msgCount} сообщений, ${chatCount} чатов.`);
} catch (e) {
  console.error('❌ Ошибка:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
