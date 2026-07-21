import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  login, registerAdmin, getToken, setToken, decodeUser, makeSocket,
  getChats, getMessages, markChatRead, getOperators, createOperator, changePassword,
} from './api.js';

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const initial = (s) => (String(s || '?').trim().charAt(0).toUpperCase() || '?');
const fmt = (ts) => { try { return new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
const isOperator = (role) => role === 'support' || role === 'admin';

export default function Admin({ page = 'login' }) {
  const [user, setUser] = useState(() => (getToken() ? decodeUser(getToken()) : null));
  const logout = () => { setToken(null); setUser(null); };

  if (!user) {
    if (page === 'register') return <OpRegisterPage onAuthed={(t) => { setToken(t); setUser(decodeUser(t)); }} />;
    return <OpLoginPage onAuthed={(t) => { setToken(t); setUser(decodeUser(t)); }} />;
  }
  if (!isOperator(user.role)) return <NotOperator user={user} onLogout={logout} />;
  return <OpPanel user={user} onLogout={logout} />;
}

/* ---- страница входа ---- */
function OpLoginPage({ onAuthed }) {
  return (
    <div className="op-login">
      <div className="form-card">
        <a href="/" className="brand"><span className="brand-name">MOGGER · Админ</span></a>
        <h3>Вход</h3>
        <p className="op-auth-hint">Для тех, у кого уже есть аккаунт администратора.</p>
        <OpLogin onAuthed={onAuthed} />
        <p className="op-auth-switch">Нет аккаунта? <a href="/admin/register">Зарегистрироваться</a></p>
      </div>
    </div>
  );
}

/* ---- страница регистрации ---- */
function OpRegisterPage({ onAuthed }) {
  return (
    <div className="op-login">
      <div className="form-card">
        <a href="/" className="brand"><span className="brand-name">MOGGER · Админ</span></a>
        <h3>Регистрация</h3>
        <p className="op-auth-hint">Создайте аккаунт администратора, если вы новый оператор.</p>
        <OpRegister onAuthed={onAuthed} />
        <p className="op-auth-switch">Уже есть аккаунт? <a href="/admin">Войти</a></p>
      </div>
    </div>
  );
}

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
    <form onSubmit={submit} noValidate>
      <div className={'field' + (err ? ' err' : '')}>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(''); }} placeholder="email@example.com" autoComplete="email" />
      </div>
      <div className={'field' + (err ? ' err' : '')}>
        <label>Пароль</label>
        <input type="password" value={pass} onChange={(e) => { setPass(e.target.value); setErr(''); }} placeholder="Пароль" autoComplete="current-password" />
        <small className="ferr" style={{ display: err ? 'block' : 'none' }}>{err}</small>
      </div>
      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Вход…' : 'Войти'}</button>
    </form>
  );
}

function OpRegister({ onAuthed }) {
  const [f, setF] = useState({ username: '', email: '', p1: '', p2: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF((s) => ({ ...s, [k]: e.target.value })); setErr(''); };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (f.p1.length < 6) { setErr('Пароль минимум 6 символов'); return; }
    if (f.p1 !== f.p2) { setErr('Пароли не совпадают'); return; }
    setBusy(true);
    try {
      const { token } = await registerAdmin(f.username.trim(), f.email.trim(), f.p1);
      onAuthed(token);
    } catch (e2) { setErr(e2.message || 'Ошибка регистрации'); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className={'field' + (err ? ' err' : '')}>
        <label>Имя</label>
        <input value={f.username} onChange={set('username')} placeholder="Ваше имя" autoComplete="name" />
      </div>
      <div className="field">
        <label>Email</label>
        <input type="email" value={f.email} onChange={set('email')} placeholder="email@example.com" autoComplete="email" />
      </div>
      <div className="field">
        <label>Пароль</label>
        <input type="password" value={f.p1} onChange={set('p1')} placeholder="Минимум 6 символов" autoComplete="new-password" />
      </div>
      <div className={'field' + (err ? ' err' : '')}>
        <label>Повторите пароль</label>
        <input type="password" value={f.p2} onChange={set('p2')} placeholder="Ещё раз" autoComplete="new-password" />
        <small className="ferr" style={{ display: err ? 'block' : 'none' }}>{err}</small>
      </div>
      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Регистрация…' : 'Зарегистрироваться'}</button>
    </form>
  );
}

/* ---- вошёл, но не оператор ---- */
function NotOperator({ user, onLogout }) {
  return (
    <div className="op-login">
      <div className="form-card">
        <h3>Нет доступа к панели</h3>
        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          Вы вошли как <b>{user.username}</b>, но это обычный аккаунт пользователя, не администратора.
          Зарегистрируйте админ-аккаунт или попросите главного админа добавить вас.
        </p>
        <a className="btn btn-primary btn-block" href="/admin/register" style={{ marginBottom: 10, display: 'block', textAlign: 'center', textDecoration: 'none' }}>Регистрация админа</a>
        <button className="btn btn-ghost btn-block" onClick={onLogout}>Выйти</button>
      </div>
    </div>
  );
}

/* ---- смена пароля ---- */
function PasswordForm() {
  const [cur, setCur] = useState('');
  const [n1, setN1] = useState('');
  const [n2, setN2] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setOk('');
    if (n1.length < 6) { setErr('Новый пароль минимум 6 символов'); return; }
    if (n1 !== n2) { setErr('Пароли не совпадают'); return; }
    setBusy(true);
    try {
      await changePassword(cur, n1);
      setOk('Пароль изменён');
      setCur(''); setN1(''); setN2('');
    } catch (e2) { setErr(e2.message || 'Ошибка'); }
    finally { setBusy(false); }
  };

  return (
    <form className="op-settings-form" onSubmit={submit}>
      <h4>Сменить пароль</h4>
      <div className="field"><label>Текущий пароль</label><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></div>
      <div className="field"><label>Новый пароль</label><input type="password" value={n1} onChange={(e) => setN1(e.target.value)} autoComplete="new-password" /></div>
      <div className="field"><label>Повторите пароль</label><input type="password" value={n2} onChange={(e) => setN2(e.target.value)} autoComplete="new-password" /></div>
      {err && <small className="ferr">{err}</small>}
      {ok && <small style={{ color: 'var(--ok, #4ade80)', display: 'block', marginBottom: 8 }}>{ok}</small>}
      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Сохранение…' : 'Сохранить пароль'}</button>
    </form>
  );
}

/* ---- добавление оператора (главный админ) ---- */
function AddOperatorForm({ onAdded }) {
  const [f, setF] = useState({ username: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setOk('');
    setBusy(true);
    try {
      await createOperator(f.username.trim(), f.email.trim(), f.password);
      setOk('Оператор добавлен');
      setF({ username: '', email: '', password: '' });
      onAdded?.();
    } catch (e2) { setErr(e2.message || 'Ошибка'); }
    finally { setBusy(false); }
  };

  return (
    <form className="op-settings-form" onSubmit={submit}>
      <h4>Добавить оператора</h4>
      <div className="field"><label>Имя</label><input value={f.username} onChange={(e) => setF((s) => ({ ...s, username: e.target.value }))} placeholder="Имя оператора" /></div>
      <div className="field"><label>Email</label><input type="email" value={f.email} onChange={(e) => setF((s) => ({ ...s, email: e.target.value }))} placeholder="email@example.com" /></div>
      <div className="field"><label>Пароль</label><input type="password" value={f.password} onChange={(e) => setF((s) => ({ ...s, password: e.target.value }))} placeholder="Минимум 6 символов" autoComplete="new-password" /></div>
      {err && <small className="ferr">{err}</small>}
      {ok && <small style={{ color: 'var(--ok, #4ade80)', display: 'block', marginBottom: 8 }}>{ok}</small>}
      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Добавление…' : 'Добавить'}</button>
    </form>
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
  const [settings, setSettings] = useState(false);
  const [operators, setOperators] = useState([]);
  const socketRef = useRef();
  const bodyRef = useRef();
  const currentRef = useRef(null);

  const totalUnread = chats.reduce((n, c) => n + (Number(c.unread_count) || 0), 0);

  const refreshChats = useCallback(async () => {
    try { setChats(await getChats()); } catch { /* пусто */ }
  }, []);

  const refreshOperators = useCallback(async () => {
    if (user.role !== 'admin') return;
    try { setOperators(await getOperators()); } catch { /* пусто */ }
  }, [user.role]);

  useEffect(() => {
    refreshChats();
    refreshOperators();
    const socket = makeSocket('operator');
    socketRef.current = socket;
    socket.on('chat:message', (m) => {
      if (m.chatId === currentRef.current) setMessages((p) => [...p, m]);
    });
    socket.on('chat:updated', refreshChats);
    return () => socket.disconnect();
  }, [refreshChats, refreshOperators]);

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [messages]);

  const openChat = async (c) => {
    setCurrent(c.id); currentRef.current = c.id; setCurInfo(c); setViewing(true); setSettings(false);
    socketRef.current?.emit('chat:join', { chatId: c.id });
    try {
      setMessages(await getMessages(c.id));
      await markChatRead(c.id);
      setChats((prev) => prev.map((x) => (x.id === c.id ? { ...x, unread_count: 0 } : x)));
    } catch { setMessages([]); }
  };

  const send = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || !current) return;
    socketRef.current?.emit('chat:send', { chatId: current, body: t });
    setText('');
  };

  return (
    <div className={'op' + (viewing || settings ? ' viewing' : '')}>
      <aside className="op-side">
        <div className="op-head">
          <div>
            <b>Обращения{totalUnread > 0 ? ` · ${totalUnread}` : ''}</b>
            <small>{user.username}{user.role === 'admin' ? ' · админ' : ''}</small>
          </div>
          <div className="op-head-actions">
            <button className="op-icon-btn" type="button" title="Настройки" onClick={() => { setSettings(true); setViewing(false); }}>
              ⚙
            </button>
            <button className="logout-btn" onClick={onLogout}>Выйти</button>
          </div>
        </div>
        <div className="op-list">
          {chats.length === 0 ? (
            <div className="op-empty">Пока нет сообщений.<br />Когда пользователь напишет в чат — он появится здесь.</div>
          ) : chats.map((c) => (
            <div key={c.id} className={'op-item' + (c.id === current ? ' active' : '') + (c.unread_count > 0 ? ' unread' : '')} onClick={() => openChat(c)}>
              <span className="op-ava">{initial(c.username)}</span>
              <div className="op-main2">
                <div className="op-top">
                  <span className="op-name">{c.username || 'Гость'}</span>
                  <span className="op-time">{fmt(c.updated_at).split(',').pop().trim()}</span>
                </div>
                <div className="op-last">{c.last_message || 'нет сообщений'}</div>
              </div>
              {c.unread_count > 0 && <span className="op-badge">{c.unread_count > 99 ? '99+' : c.unread_count}</span>}
            </div>
          ))}
        </div>
      </aside>

      <section className="op-conv">
        {settings ? (
          <div className="op-settings">
            <div className="op-conv-head">
              <button className="logout-btn" onClick={() => setSettings(false)}>‹</button>
              <div><b>Настройки</b></div>
            </div>
            <div className="op-settings-body">
              <PasswordForm />
              {user.role === 'admin' && (
                <>
                  <AddOperatorForm onAdded={refreshOperators} />
                  {operators.length > 0 && (
                    <div className="op-operators-list">
                      <h4>Операторы</h4>
                      {operators.map((o) => (
                        <div key={o.id} className="op-operator-row">
                          <span>{o.username}</span>
                          <small>{o.email}{o.role === 'admin' ? ' · главный' : ''}</small>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : current ? (
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
