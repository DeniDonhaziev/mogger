import express from 'express';
import http from 'http';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { pool } from './db.js';
import { purgeExpiredChats, scheduleChatPurge } from './purgeExpiredChats.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';
const PORT = process.env.PORT || 4000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AUTO_REPLY_TEXT = 'Спасибо за обращение! Техническая поддержка ответит вам в течение 24 часов.';

const isOperator = (role) => role === 'support' || role === 'admin';
const isAdmin = (role) => role === 'admin';

const app = express();
// Разрешаем любой источник: аутентификация по JWT в заголовке (не по кукам), так безопасно.
app.use(cors());
app.use(express.json());

/* ---------- helpers ---------- */
function signToken(u) {
  return jwt.sign({ id: u.id, role: u.role, username: u.username }, JWT_SECRET, { expiresIn: '7d' });
}
function authHttp(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return res.status(401).json({ error: 'Требуется вход' });
  try { req.user = jwt.verify(t, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Недействительный токен' }); }
}
async function getUserChatId(userId) {
  const found = await pool.query('SELECT id FROM chats WHERE user_id = $1', [userId]);
  if (found.rows[0]) return found.rows[0].id;
  const ins = await pool.query('INSERT INTO chats(user_id) VALUES($1) RETURNING id', [userId]);
  return ins.rows[0].id;
}
async function sendChatMessage(targetChat, sender, text, io) {
  const ins = await pool.query(
    'INSERT INTO messages(chat_id, sender, body) VALUES($1, $2, $3) RETURNING id, sender, body, created_at',
    [targetChat, sender, text]
  );
  const msg = ins.rows[0];
  await pool.query(
    'UPDATE chats SET last_message = $1, updated_at = now() WHERE id = $2',
    [(sender === 'support' ? 'Поддержка: ' : '') + text, targetChat]
  );
  io.to(`chat:${targetChat}`).emit('chat:message', { chatId: targetChat, ...msg });
  io.to('support').emit('chat:updated', { chatId: targetChat });
  return msg;
}
async function maybeSendAutoReply(targetChat, userMsgId, io) {
  const { rows } = await pool.query(
    `SELECT sender, body FROM messages
      WHERE chat_id = $1 AND id != $2
      ORDER BY created_at DESC LIMIT 1`,
    [targetChat, userMsgId]
  );
  const prev = rows[0];
  if (prev?.sender === 'support' && prev.body === AUTO_REPLY_TEXT) return;
  await sendChatMessage(targetChat, 'support', AUTO_REPLY_TEXT, io);
}

/* ---------- auth ---------- */
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || String(username).trim().length < 2) return res.status(400).json({ error: 'Имя минимум 2 символа' });
  if (!EMAIL_RE.test(email || '')) return res.status(400).json({ error: 'Некорректный email' });
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users(username, email, password_hash)
       VALUES($1, $2, $3) RETURNING id, username, email, role`,
      [String(username).trim(), email.toLowerCase(), hash]
    );
    const user = rows[0];
    await getUserChatId(user.id);
    res.json({ token: signToken(user), user });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Этот email уже зарегистрирован' });
    console.error(e); res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [(email || '').toLowerCase()]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password || '', user.password_hash))) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }
  const safe = { id: user.id, username: user.username, email: user.email, role: user.role };
  res.json({ token: signToken(user), user: safe });
});

app.get('/api/me', authHttp, (req, res) => res.json({ user: req.user }));

/* ---------- регистрация админов (страница /admin/register) ---------- */
app.post('/api/admin/register', async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || String(username).trim().length < 2) return res.status(400).json({ error: 'Имя минимум 2 символа' });
  if (!EMAIL_RE.test(email || '')) return res.status(400).json({ error: 'Некорректный email' });
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });
  const mail = email.toLowerCase();
  try {
    const { rows: cnt } = await pool.query("SELECT COUNT(*)::int AS n FROM users WHERE role IN ('admin', 'support')");
    const role = cnt[0].n === 0 ? 'admin' : 'support';
    const hash = await bcrypt.hash(password, 10);
    const existing = await pool.query('SELECT id, role FROM users WHERE email = $1', [mail]);
    if (existing.rows[0]) {
      if (isOperator(existing.rows[0].role)) {
        return res.status(409).json({ error: 'Этот email уже зарегистрирован. Войдите в аккаунт.' });
      }
      const { rows } = await pool.query(
        `UPDATE users SET username = $1, password_hash = $2, role = $3
          WHERE email = $4 RETURNING id, username, email, role`,
        [String(username).trim(), hash, role, mail]
      );
      const user = rows[0];
      return res.json({ token: signToken(user), user });
    }
    const { rows } = await pool.query(
      `INSERT INTO users(username, email, password_hash, role)
       VALUES($1, $2, $3, $4) RETURNING id, username, email, role`,
      [String(username).trim(), mail, hash, role]
    );
    const user = rows[0];
    res.json({ token: signToken(user), user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* ---------- support: список чатов и история ---------- */
app.get('/api/chats', authHttp, async (req, res) => {
  if (!isOperator(req.user.role)) return res.status(403).json({ error: 'Только для операторов' });
  await purgeExpiredChats().catch(() => {});
  const { rows } = await pool.query(
    `SELECT c.id, c.last_message, c.updated_at, u.username, u.email,
            (SELECT COUNT(*)::int FROM messages m
              WHERE m.chat_id = c.id AND m.sender = 'user'
                AND m.created_at > COALESCE(c.support_read_at, '1970-01-01'::timestamptz)) AS unread_count
       FROM chats c JOIN users u ON u.id = c.user_id
      WHERE EXISTS (SELECT 1 FROM messages m WHERE m.chat_id = c.id AND m.sender = 'user')
      ORDER BY c.updated_at DESC`
  );
  res.json({ chats: rows });
});

app.post('/api/chats/:id/read', authHttp, async (req, res) => {
  if (!isOperator(req.user.role)) return res.status(403).json({ error: 'Только для операторов' });
  const chatId = Number(req.params.id);
  const { rowCount } = await pool.query(
    'UPDATE chats SET support_read_at = now() WHERE id = $1',
    [chatId]
  );
  if (!rowCount) return res.status(404).json({ error: 'Чат не найден' });
  res.json({ ok: true });
});

app.get('/api/chats/:id/messages', authHttp, async (req, res) => {
  await purgeExpiredChats().catch(() => {});
  const chatId = Number(req.params.id);
  const owner = await pool.query('SELECT user_id FROM chats WHERE id = $1', [chatId]);
  if (!owner.rows[0]) return res.status(404).json({ error: 'Чат не найден' });
  if (!isOperator(req.user.role) && owner.rows[0].user_id !== req.user.id) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const { rows } = await pool.query(
    'SELECT id, sender, body, created_at FROM messages WHERE chat_id = $1 ORDER BY created_at',
    [chatId]
  );
  res.json({ messages: rows });
});

/* ---------- смена своего пароля (операторы и админы) ---------- */
app.post('/api/me/password', authHttp, async (req, res) => {
  if (!isOperator(req.user.role)) return res.status(403).json({ error: 'Только для операторов' });
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'Новый пароль минимум 6 символов' });
  }
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(currentPassword || '', user.password_hash))) {
    return res.status(401).json({ error: 'Неверный текущий пароль' });
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
  res.json({ ok: true });
});

/* ---------- управление операторами (только главный админ) ---------- */
app.get('/api/admin/operators', authHttp, async (req, res) => {
  if (!isAdmin(req.user.role)) return res.status(403).json({ error: 'Только для главного админа' });
  const { rows } = await pool.query(
    `SELECT id, username, email, role, created_at FROM users
      WHERE role IN ('support', 'admin') ORDER BY created_at`
  );
  res.json({ operators: rows });
});

app.post('/api/admin/operators', authHttp, async (req, res) => {
  if (!isAdmin(req.user.role)) return res.status(403).json({ error: 'Только для главного админа' });
  const { username, email, password } = req.body || {};
  if (!username || String(username).trim().length < 2) return res.status(400).json({ error: 'Имя минимум 2 символа' });
  if (!EMAIL_RE.test(email || '')) return res.status(400).json({ error: 'Некорректный email' });
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });
  const mail = email.toLowerCase();
  try {
    const hash = await bcrypt.hash(password, 10);
    const existing = await pool.query('SELECT id, role FROM users WHERE email = $1', [mail]);
    if (existing.rows[0]) {
      if (existing.rows[0].role === 'admin') return res.status(409).json({ error: 'Этот email уже главный админ' });
      const { rows } = await pool.query(
        `UPDATE users SET username = $1, password_hash = $2, role = 'support'
          WHERE email = $3 RETURNING id, username, email, role, created_at`,
        [String(username).trim(), hash, mail]
      );
      return res.json({ operator: rows[0] });
    }
    const { rows } = await pool.query(
      `INSERT INTO users(username, email, password_hash, role)
       VALUES($1, $2, $3, 'support') RETURNING id, username, email, role, created_at`,
      [String(username).trim(), mail, hash]
    );
    res.json({ operator: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/', (_req, res) => res.send('MOGGER API работает'));

/* ---------- socket.io realtime ---------- */
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.use((socket, next) => {
  const t = socket.handshake.auth?.token;
  try { socket.user = jwt.verify(t, JWT_SECRET); next(); }
  catch { next(new Error('unauthorized')); }
});

io.on('connection', async (socket) => {
  const u = socket.user;
  // режим определяется клиентом: 'operator' — панель /admin, иначе — обычный чат на сайте.
  // Оператором считается только support, зашедший именно в режиме оператора.
  const asOperator = socket.handshake.auth?.mode === 'operator' && isOperator(u.role);
  socket.data.asOperator = asOperator;

  if (asOperator) {
    socket.join('support'); // операторы получают обновления списка
  } else {
    await purgeExpiredChats().catch(() => {});
    const chatId = await getUserChatId(u.id);
    socket.data.chatId = chatId;
    socket.join(`chat:${chatId}`);
    socket.emit('chat:ready', { chatId });
  }

  // оператор открывает конкретный чат
  socket.on('chat:join', ({ chatId }) => {
    if (socket.data.asOperator && chatId) socket.join(`chat:${chatId}`);
  });

  // отправка сообщения
  socket.on('chat:send', async ({ chatId, body }, ack) => {
    try {
      const text = String(body || '').trim();
      if (!text) return;
      if (text.length > 4000) return;

      // куда и от чьего имени пишем
      let targetChat, sender;
      if (socket.data.asOperator) {
        targetChat = Number(chatId);
        sender = 'support';
      } else {
        targetChat = await getUserChatId(u.id); // пользователь всегда пишет в свой
        sender = 'user';
      }
      if (!targetChat) { if (typeof ack === 'function') ack({ ok: false, error: 'Чат не выбран' }); return; }

      const msg = await sendChatMessage(targetChat, sender, text, io);
      if (sender === 'user') await maybeSendAutoReply(targetChat, msg.id, io);
      if (typeof ack === 'function') ack({ ok: true });
    } catch (e) {
      console.error(e);
      if (typeof ack === 'function') ack({ ok: false, error: 'Не удалось отправить' });
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 MOGGER API на http://localhost:${PORT}`);
  scheduleChatPurge();
});
