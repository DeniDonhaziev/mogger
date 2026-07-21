import React, { useEffect, useRef, useState, useCallback } from 'react';
import { register, login, getToken, setToken, decodeUser, makeSocket, getMessages } from './api.js';

/* ---------- маленькие SVG ---------- */
const Logo = ({ cls = 'logo' }) => (
  <svg className={cls} viewBox="0 0 48 48" fill="none">
    <path d="M24 3 42 13v22L24 45 6 35V13L24 3Z" stroke="#5b86ff" strokeWidth="2" fill="rgba(63,111,230,.12)" />
    <path d="M15 32V17l9 7 9-7v15" stroke="#5b86ff" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" fill="none" />
  </svg>
);
const Check = () => (
  <span className="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
);
const Eye = ({ onClick }) => (
  <button type="button" className="eye" onClick={onClick}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" /><circle cx="12" cy="12" r="3" /></svg></button>
);
const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const fmtTime = (ts) => { try { return ts ? new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''; } catch { return ''; } };

/* ============ APP ============ */
export default function App() {
  const [user, setUser] = useState(() => (getToken() ? decodeUser(getToken()) : null));
  const [toast, setToast] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const toastTimer = useRef();

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  }, []);

  const onAuthed = useCallback((token) => {
    setToken(token);
    setUser(decodeUser(token));
  }, []);

  const logout = () => {
    setToken(null);
    setUser(null);
    showToast('Вы вышли из аккаунта');
  };

  useBackgroundFx();

  return (
    <>
      <div className="progress" id="progress" />
      <canvas id="stars" />
      <div className="grid-fade" />
      <div className="noise" aria-hidden="true" />
      <div className="orb o1" /><div className="orb o2" /><div className="orb o3" />

      <Header user={user} onLogin={() => setLoginOpen(true)} onLogout={logout} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      <Hero />
      <Features />
      <Download showToast={showToast} />
      <Signup user={user} onAuthed={onAuthed} showToast={showToast} onLoginLink={() => setLoginOpen(true)} />
      <Support user={user} onLogin={() => setLoginOpen(true)} />
      <Footer />

      {loginOpen && (
        <LoginModal
          onClose={() => setLoginOpen(false)}
          onAuthed={(t) => { onAuthed(t); setLoginOpen(false); showToast('С возвращением 👋'); }}
        />
      )}

      <button className="totop" id="totop" aria-label="Наверх"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 15 6-6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
      <div className={'toast' + (toast ? ' show' : '')}>{toast}</div>
    </>
  );
}

/* ---------- header ---------- */
function Header({ user, onLogin, onLogout, menuOpen, setMenuOpen }) {
  return (
    <header id="hdr">
      <div className="container nav">
        <a href="#home" className="brand"><Logo /><span className="brand-name">MOGGER</span></a>
        <nav className={'nav-links' + (menuOpen ? ' open' : '')} onClick={() => setMenuOpen(false)}>
          <a href="#home" className="active">Главная</a>
          <a href="#features">Возможности</a>
          <a href="#download">Скачать</a>
          <a href="#support">Поддержка</a>
        </nav>
        <div className="nav-actions">
          {user ? (
            <span className="user-chip">
              <span className="user-ava">{(user.username || '?').charAt(0).toUpperCase()}</span>
              <span className="user-name">{user.username}</span>
              <button type="button" className="btn-logout" onClick={onLogout}>Выйти</button>
            </span>
          ) : (
            <span className="auth-actions">
              <button className="btn btn-ghost" onClick={onLogin}>Войти</button>
              <a href="#signup" className="btn btn-primary">Создать аккаунт</a>
            </span>
          )}
          <button className="burger" aria-label="Меню" onClick={() => setMenuOpen((v) => !v)}><span /><span /><span /></button>
        </div>
      </div>
    </header>
  );
}

/* ---------- hero ---------- */
function Hero() {
  return (
    <section className="hero container" id="home">
      <div className="hero-lead reveal">
        <Logo />
        <div>
          <h3>MOGGER</h3>
          <p>Ваш интеллектуальный помощник по законодательству и правилам на сервере Majestic RP</p>
        </div>
      </div>
      <div className="hero-grid">
        <div className="reveal d1">
          <span className="hero-badge">✦ Majestic RP · New York</span>
          <h1>MOGGER — вся информация <span className="accent">в одном месте</span></h1>
          <p className="sub">Законодательство, правила сервера, внутренние уставы и документы всегда под рукой.</p>
          <ul className="checklist">
            <li><Check />Актуальная информация</li>
            <li><Check />Удобный поиск</li>
            <li><Check />ИИ ассистент</li>
            <li><Check />Быстрый доступ</li>
          </ul>
          <div className="hero-cta">
            <a href="#signup" className="btn btn-primary">Создать аккаунт</a>
            <a href="#support" className="btn btn-ghost">Написать в поддержку</a>
          </div>
        </div>
        <div className="reveal d2 kb-wrap">
          <div className="kb">
            <div className="kb-main" style={{ gridColumn: '1 / -1' }}>
              <div className="kb-mtitle" style={{ display: 'block' }}>🔍 Поиск по базе знаний</div>
              <div className="kb-search">
                <input placeholder="Введите статью, пункт или ключевое слово" />
                <button className="btn btn-primary">Найти</button>
              </div>
              <div className="kb-found">Найдено 6 результатов</div>
              <div className="kb-cards">
                <div className="kb-card">
                  <div className="kb-card-h"><span className="tag blue" />Законодательство</div>
                  <div className="kb-row"><div><b>Статья 7.2. Вооружённое ограбление</b><span>Наказание за вооружённое ограбление, сроки лишения свободы...</span></div><span className="chev">›</span></div>
                  <div className="kb-row"><div><b>Статья 7.3. Ограбление без применения оружия</b><span>Наказание за ограбление без применения оружия...</span></div><span className="chev">›</span></div>
                </div>
                <div className="kb-card">
                  <div className="kb-card-h"><span className="tag green" />Правила сервера</div>
                  <div className="kb-row"><div><b>Пункт 4.8. Ограбления</b><span>Правила проведения ограблений на территории штата...</span></div><span className="chev">›</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Stats />
    </section>
  );
}

/* ---------- анимированные счётчики ---------- */
function Stats() {
  const items = [
    { to: 1200, label: 'статей в базе' },
    { to: 350, label: 'правил сервера' },
    { to: 24, suf: '/7', label: 'ИИ-ассистент' },
    { to: 3, label: 'платформы' },
  ];
  return (
    <div className="stats">
      {items.map((it, i) => <Stat key={i} {...it} delay={i} />)}
    </div>
  );
}
function Stat({ to, suf = '', label, delay }) {
  const [n, setN] = useState(0);
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(el);
        let start;
        const tick = (t) => {
          if (!start) start = t;
          const p = Math.min(1, (t - start) / 1200);
          const eased = 1 - Math.pow(1 - p, 3);
          setN(Math.round(to * eased));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: .5 });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  return (
    <div className={'stat reveal' + (delay ? ' d' + delay : '')} ref={ref}>
      <b>{n}{suf}</b><span>{label}</span>
    </div>
  );
}

/* ---------- features ---------- */
function Features() {
  const cards = [
    {
      t: 'Скачайте программу', p: 'Получите доступ ко всем функциям MOGGER на вашем устройстве — Windows и macOS.', b: 'Скачать', href: '#download',
      icon: <path d="M12 3v13m0 0 4-4m-4 4-4-4M4 21h16" strokeLinecap="round" strokeLinejoin="round" />,
    },
    {
      t: 'Создайте аккаунт', p: 'Создайте аккаунт для синхронизации данных и использования всех возможностей.', b: 'Создать аккаунт', href: '#signup',
      icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" /></>,
    },
    {
      t: 'Получите поддержку', p: 'Наша команда всегда готова помочь вам и ответить на ваши вопросы.', b: 'Обратиться', href: '#support',
      icon: <path d="M4 12a8 8 0 0 1 16 0v5a3 3 0 0 1-3 3h-1v-6h4M4 14v-2m0 0v6a1 1 0 0 0 1 1h2v-7H4Z" strokeLinecap="round" strokeLinejoin="round" />,
    },
  ];
  return (
    <section className="section container" id="features">
      <div className="sec-head reveal">
        <span className="eyebrow">Быстрый старт</span>
        <h2>Всё необходимое — в три шага</h2>
        <p>Скачайте приложение, создайте аккаунт и получите помощь от команды поддержки.</p>
      </div>
      <div className="trio">
        {cards.map((c, i) => (
          <div className={'fcard reveal' + (i ? ' d' + i : '')} key={c.t} style={{ '--i': i }}>
            <div className="ficon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{c.icon}</svg></div>
            <h4>{c.t}</h4>
            <p>{c.p}</p>
            <a href={c.href} className="btn btn-ghost btn-block">{c.b}</a>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- download ---------- */
function Download({ showToast }) {
  const os = [
    {
      name: 'Windows', note: 'Windows 10 и выше',
      icon: <svg viewBox="0 0 48 48"><path fill="#5b86ff" d="M6 8.5 22 6v16H6zM24 5.7 42 3v19H24zM6 24h16v16L6 37.5zM24 24h18v19l-18-2.7z" /></svg>,
    },
    {
      name: 'macOS', note: 'macOS 11 и выше',
      icon: <svg viewBox="0 0 24 24" fill="#e8ecf6"><path d="M17.05 12.5c0-2 1.6-3 1.7-3.05-.9-1.35-2.4-1.55-2.9-1.55-1.25-.13-2.4.72-3 .72s-1.6-.7-2.6-.68c-1.35.02-2.6.78-3.3 2-1.4 2.45-.35 6.1 1 8.1.66 1 1.45 2.1 2.5 2.06 1-.04 1.4-.65 2.6-.65s1.55.65 2.6.63c1.07-.02 1.75-1 2.4-2 .76-1.15 1.07-2.27 1.08-2.33-.02-.01-2.08-.8-2.08-3.02M15.1 6.3c.55-.67.92-1.6.82-2.53-.8.03-1.76.53-2.33 1.2-.5.6-.95 1.55-.83 2.46.88.07 1.78-.45 2.34-1.13" /></svg>,
    },
  ];
  return (
    <section className="section container" id="download">
      <div className="sec-head reveal">
        <div className="sec-meta"><span className="num">1.</span><span className="eyebrow">Скачать</span></div>
        <h2>Скачайте MOGGER</h2>
        <p>Выберите версию для вашей операционной системы.</p>
      </div>
      <div className="download reveal d1">
        <div className="os-grid two">
          {os.map((o) => (
            <div className="os" key={o.name}>
              <div className="os-ico">{o.icon}</div>
              <b>{o.name}</b><small>{o.note}</small>
              <span className="soon-badge">Скоро</span>
            </div>
          ))}
        </div>
        <div className="dl-note">Версия 1.0.0 · Последнее обновление: 05.01.2027</div>
      </div>
    </section>
  );
}

/* ---------- signup (реальная регистрация) ---------- */
function Signup({ user, onAuthed, showToast, onLoginLink }) {
  const [f, setF] = useState({ username: '', email: '', p1: '', p2: '' });
  const [err, setErr] = useState({});
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF((s) => ({ ...s, [k]: e.target.value })); setErr((s) => ({ ...s, [k]: '' })); };

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (f.username.trim().length < 2) er.username = 'Введите имя (минимум 2 символа)';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) er.email = 'Введите корректный email';
    if (f.p1.length < 6) er.p1 = 'Пароль должен быть не короче 6 символов';
    if (f.p2 !== f.p1) er.p2 = 'Пароли не совпадают';
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const { token } = await register(f.username.trim(), f.email.trim(), f.p1);
      onAuthed(token);
      setF({ username: '', email: '', p1: '', p2: '' });
      showToast('Аккаунт создан! Добро пожаловать 🎉');
    } catch (e2) {
      const msg = e2.message || 'Ошибка';
      if (/email/i.test(msg)) setErr({ email: msg }); else showToast(msg);
    } finally { setBusy(false); }
  };

  return (
    <section className="section container" id="signup">
      <div className="sec-head reveal">
        <div className="sec-meta"><span className="num">2.</span><span className="eyebrow">Регистрация</span></div>
        <h2>Создайте аккаунт</h2>
        <p>Регистрация через email и пароль, безопасное хранение данных.</p>
      </div>
      <div className="split">
        <div className="reveal">
          <div className="shield"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5z" /><path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
          <h3 className="split-h">Ваш аккаунт<br />— ваши данные</h3>
          <ul className="info-list">
            <li><Check />Синхронизация на всех устройствах</li>
            <li><Check />Доступ к премиум-функциям</li>
            <li><Check />История запросов и закладки</li>
          </ul>
        </div>
        <div className="form-card reveal d1">
          {user ? (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div className="user-ava" style={{ margin: '0 auto 14px', width: 54, height: 54, fontSize: 22 }}>{(user.username || '?').charAt(0).toUpperCase()}</div>
              <h3 style={{ marginBottom: 8 }}>Вы вошли как {user.username}</h3>
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>Аккаунт создан и активен. Можно писать в чат поддержки ниже.</p>
            </div>
          ) : (
            <>
              <h3>Данные для регистрации</h3>
              <form onSubmit={submit} noValidate>
                <div className={'field' + (err.username ? ' err' : '')}>
                  <label>Имя пользователя</label>
                  <input value={f.username} onChange={set('username')} placeholder="Введите имя пользователя" autoComplete="username" />
                  <small className="ferr">{err.username}</small>
                </div>
                <div className={'field' + (err.email ? ' err' : '')}>
                  <label>Email</label>
                  <input type="email" value={f.email} onChange={set('email')} placeholder="Введите ваш email" autoComplete="email" />
                  <small className="ferr">{err.email}</small>
                </div>
                <div className={'field' + (err.p1 ? ' err' : '')}>
                  <label>Пароль</label>
                  <div className="input-wrap">
                    <input type={show1 ? 'text' : 'password'} value={f.p1} onChange={set('p1')} placeholder="Придумайте пароль" autoComplete="new-password" />
                    <Eye onClick={() => setShow1((v) => !v)} />
                  </div>
                  <small className="ferr">{err.p1}</small>
                </div>
                <div className={'field' + (err.p2 ? ' err' : '')}>
                  <label>Подтвердите пароль</label>
                  <div className="input-wrap">
                    <input type={show2 ? 'text' : 'password'} value={f.p2} onChange={set('p2')} placeholder="Повторите пароль" autoComplete="new-password" />
                    <Eye onClick={() => setShow2((v) => !v)} />
                  </div>
                  <small className="ferr">{err.p2}</small>
                </div>
                <button className="btn btn-primary btn-block" type="submit" style={{ marginTop: 6 }} disabled={busy}>{busy ? 'Создаём…' : 'Создать аккаунт'}</button>
                <div className="form-foot">Уже есть аккаунт? <a href="#" onClick={(e) => { e.preventDefault(); onLoginLink(); }}>Войти</a></div>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- support (чат через socket.io) ---------- */
function Support({ user, onLogin }) {
  return (
    <section className="section container" id="support">
      <div className="sec-head reveal">
        <div className="sec-meta"><span className="num">3.</span><span className="eyebrow">Поддержка</span></div>
        <h2>Мы всегда на связи</h2>
        <p>Напишите в чат поддержки — оператор ответит прямо здесь.</p>
      </div>
      <div className="split">
        <div className="reveal">
          <h3 className="split-h">Каналы связи</h3>
          <div className="channels">
            {[['Онлайн-чат', 'Быстрые ответы на ваши вопросы в реальном времени.'], ['Email', 'support@mogger.app'], ['Discord-сервер', 'Присоединяйтесь к нашему сообществу.']].map(([b, p]) => (
              <div className="channel" key={b}><span className="cico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg></span><div><b>{b}</b><p>{p}</p></div></div>
            ))}
          </div>
        </div>
        <div className="form-card reveal d1" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ChatBox user={user} onLogin={onLogin} />
        </div>
      </div>
    </section>
  );
}

function ChatBox({ user, onLogin }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [status, setStatus] = useState('Подключение…');
  const bodyRef = useRef();
  const socketRef = useRef();
  const chatIdRef = useRef(null);

  useEffect(() => {
    if (!user) { setStatus('офлайн'); return; }
    const socket = makeSocket();
    socketRef.current = socket;
    socket.on('connect', () => setStatus('на связи'));
    socket.on('connect_error', () => setStatus('офлайн'));
    socket.on('chat:ready', async ({ chatId }) => {
      chatIdRef.current = chatId;
      try { setMessages(await getMessages(chatId)); } catch { /* пусто */ }
    });
    socket.on('chat:message', (m) => setMessages((prev) => [...prev, m]));
    return () => socket.disconnect();
  }, [user]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages]);

  const send = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || !socketRef.current) return;
    socketRef.current.emit('chat:send', { chatId: chatIdRef.current, body: t });
    setText('');
  };

  const online = status === 'на связи';

  return (
    <div className="chat-card" style={{ margin: 0, border: 0, flex: 1 }}>
      <div className="chat-head">
        <span className="chat-ava">M</span>
        <div className="chat-head-info"><b>Чат поддержки MOGGER</b><small className={'chat-status' + (online ? ' online' : '')}>{online ? 'на связи' : status}</small></div>
      </div>
      <div className="chat-body" ref={bodyRef}>
        {!user ? (
          <div className="chat-lock">Чтобы написать в поддержку, войдите или создайте аккаунт.<br /><button className="btn btn-primary" onClick={onLogin}>Войти</button></div>
        ) : messages.length === 0 ? (
          <div className="msg msg-support">👋 Здравствуйте! Опишите проблему или задайте вопрос — поддержка ответит здесь.</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={'msg ' + (m.sender === 'support' ? 'msg-support' : 'msg-user')}>
              {m.body}
              <span className="msg-time">{fmtTime(m.created_at)}</span>
            </div>
          ))
        )}
      </div>
      <form className="chat-input" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={user ? 'Опишите проблему…' : 'Войдите, чтобы писать'} disabled={!user} maxLength={4000} />
        <button className="btn btn-primary chat-send" type="submit" disabled={!user} aria-label="Отправить"><SendIcon /></button>
      </form>
    </div>
  );
}

/* ---------- login modal ---------- */
function LoginModal({ onClose, onAuthed }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const { token } = await login(email.trim(), pass);
      onAuthed(token);
    } catch (e2) { setErr(e2.message || 'Ошибка входа'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <button className="modal-close" onClick={onClose} aria-label="Закрыть">×</button>
        <h3>Вход в аккаунт</h3>
        <form onSubmit={submit} noValidate>
          <div className={'field' + (err ? ' err' : '')}>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(''); }} placeholder="Ваш email" autoComplete="email" />
          </div>
          <div className={'field' + (err ? ' err' : '')}>
            <label>Пароль</label>
            <div className="input-wrap">
              <input type={show ? 'text' : 'password'} value={pass} onChange={(e) => { setPass(e.target.value); setErr(''); }} placeholder="Ваш пароль" autoComplete="current-password" />
              <Eye onClick={() => setShow((v) => !v)} />
            </div>
            <small className="ferr" style={{ display: err ? 'block' : 'none' }}>{err}</small>
          </div>
          <button className="btn btn-primary btn-block" type="submit" style={{ marginTop: 6 }} disabled={busy}>{busy ? 'Вход…' : 'Войти'}</button>
        </form>
      </div>
    </div>
  );
}

/* ---------- footer ---------- */
function Footer() {
  return (
    <footer>
      <div className="container">
        <div className="foot-grid">
          <div className="foot-brand">
            <a href="#home" className="brand"><Logo /><span className="brand-name">MOGGER</span></a>
            <p>Интеллектуальный помощник по законодательству и правилам на сервере Majestic RP.</p>
          </div>
          <div className="foot-col"><h5>Продукт</h5><a href="#features">Возможности</a><a href="#download">Скачать</a><a href="#signup">Создать аккаунт</a></div>
          <div className="foot-col"><h5>Поддержка</h5><a href="#support">Связаться</a><a href="#">База знаний</a><a href="#">Discord</a></div>
          <div className="foot-col"><h5>Правовое</h5><a href="#">Условия использования</a><a href="#">Конфиденциальность</a></div>
        </div>
        <div className="foot-bottom">
          <span>© 2027 MOGGER. Не является официальным продуктом Majestic RP.</span>
          <span>Сделано для игроков Majestic RP</span>
        </div>
      </div>
    </footer>
  );
}

/* ---------- фоновые эффекты: звёзды, прогресс, reveal, кнопка наверх ---------- */
function useBackgroundFx() {
  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

    // starfield
    const cv = document.getElementById('stars');
    let raf, running = true, stars = [], W, H, DPR = Math.min(window.devicePixelRatio || 1, 2), tick = 0;
    const cx = cv && cv.getContext('2d');
    function resize() {
      if (!cv) return;
      W = cv.width = innerWidth * DPR; H = cv.height = innerHeight * DPR;
      cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
      const per = innerWidth < 640 ? 28 : 20;
      const n = Math.min(70, Math.floor(innerWidth / per));
      stars = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, r: (Math.random() * 1.4 + .3) * DPR, v: (Math.random() * .25 + .05) * DPR, a: Math.random() * .6 + .2, tw: Math.random() * .02 + .005 }));
    }
    function draw() {
      if (!running || !cx) return;
      cx.clearRect(0, 0, W, H); tick++;
      for (const s of stars) {
        s.y -= s.v; if (s.y < -2) { s.y = H + 2; s.x = Math.random() * W; }
        const al = s.a + Math.sin(tick * s.tw) * .25;
        cx.beginPath(); cx.arc(s.x, s.y, s.r, 0, 7);
        cx.fillStyle = 'rgba(150,180,255,' + Math.max(0, al) + ')'; cx.fill();
      }
      raf = requestAnimationFrame(draw);
    }
    if (cv) {
      if (reduce) cv.style.display = 'none';
      else { resize(); addEventListener('resize', resize); draw(); }
    }

    // reveal on scroll
    const revs = document.querySelectorAll('.reveal');
    let io;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
      revs.forEach((el) => io.observe(el));
      setTimeout(() => revs.forEach((el) => el.classList.add('in')), 4000);
    } else revs.forEach((el) => el.classList.add('in'));

    // scroll: header, progress, to-top
    const hdr = document.getElementById('hdr'), prog = document.getElementById('progress'), totop = document.getElementById('totop');
    const onScroll = () => {
      const y = scrollY;
      hdr && hdr.classList.toggle('scrolled', y > 10);
      totop && totop.classList.toggle('show', y > 500);
      const h = document.documentElement.scrollHeight - innerHeight;
      if (prog) prog.style.width = (y / h * 100) + '%';
    };
    addEventListener('scroll', onScroll);
    const toTopClick = () => scrollTo({ top: 0, behavior: 'smooth' });
    totop && totop.addEventListener('click', toTopClick);

    return () => {
      cancelAnimationFrame(raf); running = false;
      removeEventListener('resize', resize); removeEventListener('scroll', onScroll);
      totop && totop.removeEventListener('click', toTopClick);
      io && io.disconnect();
    };
  }, []);
}
