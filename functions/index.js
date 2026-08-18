import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

const BACKEND = process.env.RENDER_API_URL || 'https://mogger-api.onrender.com';

/** Прокси /api/* с Firebase на бэкенд (Render). Сайт ходит на свой домен — без Failed to fetch. */
export const apiProxy = onRequest(
  { cors: true, timeoutSeconds: 120, memory: '256MiB' },
  async (req, res) => {
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const path = req.path.startsWith('/api') ? req.path : `/api${req.path}`;
    const url = `${BACKEND}${path}${qs}`;

    const headers = {};
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
    if (req.headers.authorization) headers.authorization = req.headers.authorization;

    const opts = { method: req.method, headers };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      opts.body = req.body != null && typeof req.body === 'object'
        ? JSON.stringify(req.body)
        : req.body;
    }

    try {
      const r = await fetch(url, opts);
      const text = await r.text();
      res.status(r.status);
      const ct = r.headers.get('content-type');
      if (ct) res.set('Content-Type', ct);
      res.send(text);
    } catch {
      res.status(502).json({ error: 'Сервер временно недоступен. Попробуйте через минуту.' });
    }
  }
);
