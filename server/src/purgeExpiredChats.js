import { pool } from './db.js';

const TTL_HOURS = 24;

/** Удаляет чаты и сообщения старше 24 ч. Без логов и уведомлений. */
export async function purgeExpiredChats() {
  const { rows } = await pool.query(
    'SELECT id FROM chats WHERE updated_at < now() - make_interval(hours => $1)',
    [TTL_HOURS]
  );
  if (!rows.length) return;
  const ids = rows.map((r) => r.id);
  await pool.query('DELETE FROM messages WHERE chat_id = ANY($1::int[])', [ids]);
  await pool.query('DELETE FROM chats WHERE id = ANY($1::int[])', [ids]);
}

export function scheduleChatPurge() {
  const run = () => purgeExpiredChats().catch(() => {});
  run();
  setInterval(run, 30 * 60 * 1000);
}
