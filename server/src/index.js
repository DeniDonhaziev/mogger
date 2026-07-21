import express from 'express';
import http from 'http';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { pool } from './db.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';
const PORT = process.env.PORT || 4000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Авто-ответ: отправляется от имени поддержки на первое сообщение пользователя в чате.
const AUTO_REPLY = 'Спасибо за обращение! 🙌 Техподдержка ответит вам в течение 24 часов.';

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

/* ---------- support: список чатов и история ---------- */
app.get('/api/chats', authHttp, async (req, res) => {
  if (req.user.role !== 'support') return res.status(403).json({ error: 'Только для операторов' });
  const { rows } = await pool.query(
    `SELECT c.id, c.last_message, c.updated_at, u.username, u.email
       FROM chats c JOIN users u ON u.id = c.user_id
      ORDER BY c.updated_at DESC`
  );
  res.json({ chats: rows });
});

app.get('/api/chats/:id/messages', authHttp, async (req, res) => {
  const chatId = Number(req.params.id);
  const owner = await pool.query('SELECT user_id FROM chats WHERE id = $1', [chatId]);
  if (!owner.rows[0]) return res.status(404).json({ error: 'Чат не найден' });
  if (req.user.role !== 'support' && owner.rows[0].user_id !== req.user.id) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const { rows } = await pool.query(
    'SELECT id, sender, body, created_at FROM messages WHERE chat_id = $1 ORDER BY created_at',
    [chatId]
  );
  res.json({ messages: rows });
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
  const asOperator = socket.handshake.auth?.mode === 'operator' && u.role === 'support';
  socket.data.asOperator = asOperator;

  if (asOperator) {
    socket.join('support'); // операторы получают обновления списка
  } else {
    // любой вошедший (в т.ч. оператор на главной) пишет как обычный пользователь в свой чат
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
      if (typeof ack === 'function') ack({ ok: true });

      // Авто-ответ на самое первое сообщение пользователя в чате.
      if (sender === 'user') {
        const cnt = await pool.query('SELECT COUNT(*)::int AS n FROM messages WHERE chat_id = $1', [targetChat]);
        if (cnt.rows[0].n === 1) {
          const autoIns = await pool.query(
            'INSERT INTO messages(chat_id, sender, body) VALUES($1, $2, $3) RETURNING id, sender, body, created_at',
            [targetChat, 'support', AUTO_REPLY]
          );
          const autoMsg = autoIns.rows[0];
          await pool.query(
            'UPDATE chats SET last_message = $1, updated_at = now() WHERE id = $2',
            ['Поддержка: ' + AUTO_REPLY, targetChat]
          );
          io.to(`chat:${targetChat}`).emit('chat:message', { chatId: targetChat, ...autoMsg });
          io.to('support').emit('chat:updated', { chatId: targetChat });
        }
      }
    } catch (e) {
      console.error(e);
      if (typeof ack === 'function') ack({ ok: false, error: 'Не удалось отправить' });
    }
  });
});

server.listen(PORT, () => console.log(`🚀 MOGGER API на http://localhost:${PORT}`));
