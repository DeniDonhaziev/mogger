import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Admin from './Admin.jsx';
import './styles/landing.css';
import './styles/extra.css';
import './styles/polish.css';

const path = window.location.pathname.replace(/\/+$/, '');
const isAdmin = path === '/admin';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdmin ? <Admin /> : <App />}
  </React.StrictMode>
);
