import React, { useState, useEffect, useRef, useCallback } from 'react';
import { login, getToken, setToken, decodeUser, makeSocket, getChats, getMessages } from './api.js';

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const initial = (s) => (String(s || '?').trim().charAt(0).toUpperCase() || '?');
const fmt = (ts) => { try { return new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

export default function Admin() {
  const [user, setUser] = useState(() => (getToken() ? decodeUser(getToken()) : null));
  const logout = () => { setToken(null); setUser(null); };

  if (!user) return <OpLogin onAuthed={(t) => { setToken(t); setUser(decodeUser(t)); }} />;
  if (user.role !== 'support') return <NotOperator user={user} onLogout={logout} />;
  return <OpPanel user={user} onLogout={logout} />;
}

/* ---- вход оператора ---- */
function OpLogin({ onAuthed }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const { token } = await login(email.trim(), pass); onAuthed(token); }
    catch (e2) { setErr(e2.message || 'Ошибка входа'); }
    finally { setBusy(false); }
  };
  return (
    <div className="op-login">
      <div className="form-card">
        <a href="/" className="brand"><span className="brand-name">MOGGER · Поддержка</span></a>
        <h3>Вход оператора</h3>
        <form onSubmit={submit} noValidate>
          <div className={'field' + (err ? ' err' : '')}>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(''); }} placeholder="email оператора" autoComplete="email" />
          </div>
          <div className={'field' + (err ? ' err' : '')}>
            <label>Пароль</label>
            <input type="password" value={pass} onChange={(e) => { setPass(e.target.value); setErr(''); }} placeholder="Пароль" autoComplete="current-password" />
            <small className="ferr" style={{ display: err ? 'block' : 'none' }}>{err}</small>
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Вход…' : 'Войти'}</button>
        </form>
      </div>
    </div>
  );
}

/* ---- вошёл, но не оператор ---- */
function NotOperator({ user, onLogout }) {
  return (
    <div className="op-login">
      <div className="form-card">
        <h3>Аккаунт не оператор</h3>
        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          Вы вошли как <b>{user.username}</b>, но у аккаунта нет прав оператора поддержки.
          Чтобы их выдать, выполните на сервере команду:
        </p>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, fontSize: 13, fontFamily: 'monospace', marginBottom: 16, wordBreak: 'break-all' }}>
          cd server<br />npm run make:support -- ВАШ_EMAIL
        </div>
        <button className="btn btn-ghost btn-block" onClick={onLogout}>Выйти</button>
      </div>
    </div>
  );
}

/* ---- панель оператора ---- */
function OpPanel({ user, onLogout }) {
  const [chats, setChats] = useState([]);
  const [current, setCurrent] = useState(null);
  const [curInfo, setCurInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [viewing, setViewing] = useState(false);
  const socketRef = useRef();
  const bodyRef = useRef();
  const currentRef = useRef(null);

  const refreshChats = useCallback(async () => {
    try { setChats(await getChats()); } catch { /* пусто */ }
  }, []);

  useEffect(() => {
    refreshChats();
    const socket = makeSocket('operator');
    socketRef.current = socket;
    socket.on('chat:message', (m) => {
      if (m.chatId === currentRef.current) setMessages((p) => [...p, m]);
    });
    socket.on('chat:updated', refreshChats);
    return () => socket.disconnect();
  }, [refreshChats]);

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [messages]);

  const openChat = async (c) => {
    setCurrent(c.id); currentRef.current = c.id; setCurInfo(c); setViewing(true);
    socketRef.current?.emit('chat:join', { chatId: c.id });
    try { setMessages(await getMessages(c.id)); } catch { setMessages([]); }
  };

  const send = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || !current) return;
    socketRef.current?.emit('chat:send', { chatId: current, body: t });
    setText('');
  };

  return (
    <div className={'op' + (viewing ? ' viewing' : '')}>
      <aside className="op-side">
        <div className="op-head">
          <div><b>Обращения</b><small>{user.username}</small></div>
          <button className="logout-btn" onClick={onLogout}>Выйти</button>
        </div>
        <div className="op-list">
          {chats.length === 0 ? (
            <div className="op-empty">Пока нет обращений.<br />Как пользователь напишет в чат — оно появится здесь.</div>
          ) : chats.map((c) => (
            <div key={c.id} className={'op-item' + (c.id === current ? ' active' : '')} onClick={() => openChat(c)}>
              <span className="op-ava">{initial(c.username)}</span>
              <div className="op-main2">
                <div className="op-top">
                  <span className="op-name">{c.username || 'Гость'}</span>
                  <span className="op-time">{fmt(c.updated_at).split(',').pop().trim()}</span>
                </div>
                <div className="op-last">{c.last_message || 'нет сообщений'}</div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="op-conv">
        {current ? (
          <>
            <div className="op-conv-head">
              <button className="logout-btn" style={{ display: viewing ? '' : 'none' }} onClick={() => setViewing(false)}>‹</button>
              <span className="op-ava" style={{ width: 36, height: 36 }}>{initial(curInfo?.username)}</span>
              <div><b>{curInfo?.username || 'Гость'}</b><small style={{ color: 'var(--muted-2)', fontSize: 12 }}>{curInfo?.email}</small></div>
            </div>
            <div className="op-conv-body" ref={bodyRef}>
              {messages.length === 0 ? (
                <div className="op-conv-empty">Сообщений пока нет.</div>
              ) : messages.map((m) => (
                <div key={m.id} className={'msg ' + (m.sender === 'support' ? 'msg-support' : 'msg-user')}>
                  {m.body}
                  <span className="msg-time">{(() => { try { return new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } })()}</span>
                </div>
              ))}
            </div>
            <form className="chat-input" onSubmit={send}>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ваш ответ…" maxLength={4000} />
              <button className="btn btn-primary chat-send" type="submit" aria-label="Отправить"><SendIcon /></button>
            </form>
          </>
        ) : (
          <div className="op-conv-empty">Выберите обращение слева, чтобы ответить.</div>
        )}
      </section>
    </div>
  );
}
