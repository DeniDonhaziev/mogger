# MOGGER — новый стек

Переезжаем с Firebase на собственный стек:

```
[ React (Vite) ]  — фронтенд, дизайн, регистрация, чат
       │  REST (fetch) + WebSocket (socket.io)
       ▼
[ Node + Express + socket.io ]  — сервер, API, realtime
       │  SQL (pg)
       ▼
[ PostgreSQL ]  — база (пользователи, чаты, сообщения)
```

- **Firebase Hosting** остаётся только для отдачи собранного React (статики).
- **Node-сервер** и **PostgreSQL** живут на отдельном хостинге (Firebase их не запускает).

## Этапы
1. ✅ **Бэкенд** (папка `server/`) — регистрация, вход (JWT + bcrypt), realtime-чат поддержки.
2. ⏳ **Фронтенд** (папка `client/`, React + Vite) — перенос дизайна, экраны, подключение к API/сокету.
3. ⏳ **Деплой** — React на Firebase Hosting, сервер на Railway/Render, база на Neon.

---

## Запуск бэкенда локально

### 1. База данных (без установки — облачный Postgres)
1. Зарегистрируйся на **https://neon.tech** (бесплатно).
2. Создай проект → скопируй **Connection string** (вида `postgresql://...:...@...neon.tech/...?sslmode=require`).

### 2. Настройка
```bash
cd server
copy .env.example .env        # Windows (или cp на Unix)
```
Открой `server/.env` и вставь:
- `DATABASE_URL` — строку подключения из Neon;
- `JWT_SECRET` — любую длинную случайную строку.

### 3. Установка и запуск
```bash
cd server
npm install
npm run db:init      # создаёт таблицы в базе
npm run dev          # запускает сервер на http://localhost:4000
```

### 4. Проверка
```bash
# регистрация
curl -X POST http://localhost:4000/api/register -H "Content-Type: application/json" ^
  -d "{\"username\":\"Тест\",\"email\":\"t@t.com\",\"password\":\"secret1\"}"
```
Должен вернуться `token` и `user`.

---

## Что дальше
Скажи «делаем фронт» — создам React-приложение (Vite) в `client/`, перенесу дизайн (тёмная тема, экраны из макета), подключу регистрацию/вход и чат через socket.io.
