import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Admin from './Admin.jsx';
import './styles/landing.css';
import './styles/extra.css';
import './styles/polish.css';

const path = window.location.pathname.replace(/\/+$/, '') || '/';
const adminPage = path === '/admin/register' ? 'register' : path === '/admin' ? 'login' : null;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {adminPage ? <Admin page={adminPage} /> : <App />}
  </React.StrictMode>
);
