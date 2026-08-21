import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Admin from './Admin.jsx';
import './styles/landing.css';
import './styles/extra.css';
import './styles/polish.css';

const path = window.location.pathname.replace(/\/+$/, '') || '/';
const adminPage = path === '/admin/register' ? 'register' : path === '/admin' ? 'login' : null;

const rootEl = document.getElementById('root');
if (!rootEl) {
  document.body.innerHTML = '<p style="font-family:sans-serif;padding:24px">Ошибка: не найден #root</p>';
} else {
  try {
    createRoot(rootEl).render(
      <React.StrictMode>
        {adminPage ? <Admin page={adminPage} /> : <App />}
      </React.StrictMode>
    );
  } catch (e) {
    rootEl.innerHTML = `<p style="font-family:sans-serif;padding:24px;color:#c00">Ошибка загрузки: ${e?.message || e}</p>`;
  }
}
