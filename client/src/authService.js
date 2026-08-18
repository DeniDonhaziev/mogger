import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, limit,
} from 'firebase/firestore';
import { auth, db } from './firebase.js';

const USER_KEY = 'mogger_user';
const TOKEN_KEY = 'mogger_token';
const AUTO_REPLY = 'Спасибо за обращение! Техническая поддержка ответит вам в течение 24 часов.';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export function getStoredUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
}

export function setStoredUser(user, token) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
  setToken(token);
}

export function decodeUser() {
  return getStoredUser();
}

async function profile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.data() || {};
}

async function packUser(fbUser, overrides = {}) {
  let p = {};
  try { p = await profile(fbUser.uid); } catch { /* offline / rules */ }
  const token = await fbUser.getIdToken();
  const user = {
    id: fbUser.uid,
    username: overrides.username || p.username || fbUser.displayName || 'Пользователь',
    role: overrides.role || p.role || 'user',
    email: fbUser.email,
  };
  setStoredUser(user, token);
  return { user, token };
}

function fbErr(e) {
  const map = {
    'auth/email-already-in-use': 'Этот email уже зарегистрирован',
    'auth/invalid-email': 'Некорректный email',
    'auth/weak-password': 'Пароль минимум 6 символов',
    'auth/invalid-credential': 'Неверный email или пароль',
    'auth/wrong-password': 'Неверный пароль',
    'auth/network-request-failed': 'Нет связи с Firebase. Проверьте интернет.',
    'auth/unauthorized-domain': 'Домен сайта не авторизован в Firebase',
  };
  const msg = e?.message || '';
  if (/failed to fetch|network error|load failed/i.test(msg)) {
    throw new Error('Нет связи с Firebase. Проверьте интернет или VPN.');
  }
  throw new Error(map[e.code] || msg || 'Ошибка');
}

export async function register(username, email, password) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: username.trim() });
    await setDoc(doc(db, 'users', cred.user.uid), {
      username: username.trim(),
      email: email.toLowerCase(),
      role: 'user',
      createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'chats', cred.user.uid), {
      userId: cred.user.uid,
      username: username.trim(),
      email: email.toLowerCase(),
      updatedAt: serverTimestamp(),
    });
    return packUser(cred.user, { username: username.trim(), role: 'user' });
  } catch (e) { fbErr(e); }
}

export async function login(email, password) {
  try {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return packUser(cred.user);
  } catch (e) { fbErr(e); }
}

export async function logoutUser() {
  await signOut(auth);
  setStoredUser(null, null);
}

export async function registerAdmin(username, email, password) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: username.trim() });
    const admins = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
    const role = admins.empty ? 'admin' : 'support';
    await setDoc(doc(db, 'users', cred.user.uid), {
      username: username.trim(),
      email: email.toLowerCase(),
      role,
      createdAt: serverTimestamp(),
    });
    return packUser(cred.user, { username: username.trim(), role });
  } catch (e) { fbErr(e); }
}

export async function getOperators() {
  const snap = await getDocs(query(collection(db, 'users'), where('role', 'in', ['admin', 'support'])));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createOperator(username, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(cred.user, { displayName: username.trim() });
  await setDoc(doc(db, 'users', cred.user.uid), {
    username: username.trim(),
    email: email.toLowerCase(),
    role: 'support',
    createdAt: serverTimestamp(),
  });
  return { id: cred.user.uid, username: username.trim(), email: email.toLowerCase(), role: 'support' };
}

export function listenMessages(userId, cb) {
  const q = query(collection(db, 'chats', userId, 'messages'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      created_at: d.data().createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
    })));
  });
}

export async function sendUserMessage(userId, username, email, text) {
  const chatRef = doc(db, 'chats', userId);
  const msgRef = collection(db, 'chats', userId, 'messages');
  await addDoc(msgRef, { sender: 'user', body: text, createdAt: serverTimestamp() });
  try {
    await updateDoc(chatRef, { userId, username, email, lastMessage: text, updatedAt: serverTimestamp() });
  } catch {
    await setDoc(chatRef, { userId, username, email, lastMessage: text, updatedAt: serverTimestamp() });
  }
  const prev = await getDocs(query(msgRef, where('sender', '==', 'user'), limit(2)));
  if (prev.size <= 1) {
    await addDoc(msgRef, { sender: 'support', body: AUTO_REPLY, createdAt: serverTimestamp() });
    await updateDoc(chatRef, { lastMessage: 'Поддержка: ' + AUTO_REPLY, updatedAt: serverTimestamp() });
  }
}

export async function sendSupportMessage(userId, text) {
  const msgRef = collection(db, 'chats', userId, 'messages');
  await addDoc(msgRef, { sender: 'support', body: text, createdAt: serverTimestamp() });
  await updateDoc(doc(db, 'chats', userId), {
    lastMessage: 'Поддержка: ' + text,
    updatedAt: serverTimestamp(),
  });
}

export function listenChats(cb) {
  const q = query(collection(db, 'chats'), orderBy('updatedAt', 'desc'));
  return onSnapshot(q, async (snap) => {
    const chats = [];
    for (const d of snap.docs) {
      const data = d.data();
      const userMsgs = await getDocs(query(collection(db, 'chats', d.id, 'messages'), where('sender', '==', 'user'), limit(1)));
      if (userMsgs.empty) continue;
      const allUser = await getDocs(query(collection(db, 'chats', d.id, 'messages'), where('sender', '==', 'user')));
      const readAt = data.supportReadAt?.toDate?.() || new Date(0);
      let unreadCount = 0;
      allUser.forEach((m) => {
        const t = m.data().createdAt?.toDate?.() || new Date(0);
        if (t > readAt) unreadCount++;
      });
      chats.push({
        id: d.id,
        username: data.username,
        email: data.email,
        last_message: data.lastMessage,
        updated_at: data.updatedAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
        unread_count: unreadCount,
      });
    }
    cb(chats);
  });
}

export async function markChatRead(userId) {
  await updateDoc(doc(db, 'chats', userId), { supportReadAt: serverTimestamp() });
}

export async function getMessages(userId) {
  const snap = await getDocs(query(collection(db, 'chats', userId, 'messages'), orderBy('createdAt', 'asc')));
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    created_at: d.data().createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
  }));
}

export async function changePassword(_current, newPassword) {
  const { updatePassword } = await import('firebase/auth');
  const user = auth.currentUser;
  if (!user) throw new Error('Требуется вход');
  await updatePassword(user, newPassword);
}

export async function wakeApi() {}
