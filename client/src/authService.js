import { getStoredUser, setStoredUser } from './authStorage.js';

const AUTO_REPLY = 'Спасибо за обращение! Техническая поддержка ответит вам в течение 24 часов.';

let fbPromise;

function loadFb() {
  if (!fbPromise) {
    fbPromise = Promise.all([
      import('./firebase.js'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ]).then(([{ auth, db }, authMod, fsMod]) => ({ auth, db, ...authMod, ...fsMod }));
  }
  return fbPromise;
}

async function profile(uid) {
  const { db, getDoc, doc } = await loadFb();
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
    const {
      auth, db, createUserWithEmailAndPassword,
      updateProfile, doc, setDoc, serverTimestamp,
    } = await loadFb();
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
    const { auth, signInWithEmailAndPassword } = await loadFb();
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return packUser(cred.user);
  } catch (e) { fbErr(e); }
}

export async function logoutUser() {
  const { auth, signOut } = await loadFb();
  await signOut(auth);
  setStoredUser(null, null);
}

export async function registerAdmin(username, email, password) {
  try {
    const {
      auth, db, createUserWithEmailAndPassword, updateProfile,
      getDocs, query, collection, where, doc, setDoc, serverTimestamp,
    } = await loadFb();
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
  const { db, getDocs, query, collection, where } = await loadFb();
  const snap = await getDocs(query(collection(db, 'users'), where('role', 'in', ['admin', 'support'])));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createOperator(username, email, password) {
  const {
    auth, db, createUserWithEmailAndPassword, updateProfile,
    doc, setDoc, serverTimestamp,
  } = await loadFb();
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
  let unsub;
  loadFb().then(({ db, collection, query, orderBy, onSnapshot }) => {
    const q = query(collection(db, 'chats', userId, 'messages'), orderBy('createdAt', 'asc'));
    unsub = onSnapshot(q, (snap) => {
      cb(snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        created_at: d.data().createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
      })));
    });
  });
  return () => { if (unsub) unsub(); };
}

export async function sendUserMessage(userId, username, email, text) {
  const {
    db, doc, collection, addDoc, updateDoc, setDoc, getDocs, query, where, limit, serverTimestamp,
  } = await loadFb();
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
  const { db, doc, collection, addDoc, updateDoc, serverTimestamp } = await loadFb();
  const msgRef = collection(db, 'chats', userId, 'messages');
  await addDoc(msgRef, { sender: 'support', body: text, createdAt: serverTimestamp() });
  await updateDoc(doc(db, 'chats', userId), {
    lastMessage: 'Поддержка: ' + text,
    updatedAt: serverTimestamp(),
  });
}

export function listenChats(cb) {
  let unsub;
  loadFb().then(({ db, collection, query, orderBy, onSnapshot, getDocs, where, limit }) => {
    const q = query(collection(db, 'chats'), orderBy('updatedAt', 'desc'));
    unsub = onSnapshot(q, async (snap) => {
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
  });
  return () => { if (unsub) unsub(); };
}

export async function markChatRead(userId) {
  const { db, doc, updateDoc, serverTimestamp } = await loadFb();
  await updateDoc(doc(db, 'chats', userId), { supportReadAt: serverTimestamp() });
}

export async function changePassword(_current, newPassword) {
  const { auth, updatePassword } = await loadFb();
  const user = auth.currentUser;
  if (!user) throw new Error('Требуется вход');
  await updatePassword(user, newPassword);
}

export async function wakeApi() {}
