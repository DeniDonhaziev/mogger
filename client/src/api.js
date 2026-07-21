import { io } from 'socket.io-client';

// адрес бэкенда (Node-сервер). Для локалки — localhost:4000.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const TOKEN_KEY = 'mogger_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function req(path, body) {
  const res = await fetch(API_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
  return data;
}

export const register = (username, email, password) => req('/api/register', { username, email, password });
export const login = (email, password) => req('/api/login', { email, password });
export const registerAdmin = (username, email, password) => req('/api/admin/register', { username, email, password });

export async function getMessages(chatId) {
  const res = await fetch(`${API_URL}/api/chats/${chatId}/messages`, {
    headers: { Authorization: 'Bearer ' + getToken() },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data.messages;
}

export async function getChats() {
  const res = await fetch(`${API_URL}/api/chats`, {
    headers: { Authorization: 'Bearer ' + getToken() },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data.chats;
}

export async function markChatRead(chatId) {
  const res = await fetch(`${API_URL}/api/chats/${chatId}/read`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + getToken() },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

export async function getOperators() {
  const res = await fetch(`${API_URL}/api/admin/operators`, {
    headers: { Authorization: 'Bearer ' + getToken() },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data.operators;
}

export async function createOperator(username, email, password) {
  const res = await fetch(`${API_URL}/api/admin/operators`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
    body: JSON.stringify({ username, email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data.operator;
}

export async function changePassword(currentPassword, newPassword) {
  const res = await fetch(`${API_URL}/api/me/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

// декодируем payload JWT (с корректной раскодировкой UTF-8 — чтобы кириллица не билась)
export function decodeUser(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const json = new TextDecoder('utf-8').decode(bytes);
    const p = JSON.parse(json);
    return { id: p.id, username: p.username, role: p.role };
  } catch {
    return null;
  }
}

// создаём socket-подключение с токеном. mode: 'user' (сайт) | 'operator' (панель /admin)
export function makeSocket(mode = 'user') {
  return io(API_URL, { auth: { token: getToken(), mode }, autoConnect: true });
}
