// src/app.js
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import { ENV } from './db.js';

import spaPublic from './routes/spa.public.js';
import spaAdmin from './routes/spa.admin.js';
import apiPublic from './routes/api.public.js';
import apiAdmin from './routes/api.admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProd = ENV.NODE_ENV === 'production';

// ---------- view engine (ESM safe for Windows/VPS) ----------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // src/views
app.set('trust proxy', 1);

// ---------- body / cookies / logs ----------
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan(isProd ? 'combined' : 'dev'));

// ---------- rate limit ----------
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);

// ---------- helmet / CSP ----------
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'", "https:", "data:"],
        "script-src": ["'self'", "https:", "'unsafe-inline'", "'unsafe-eval'"],
        "style-src": ["'self'", "https:", "'unsafe-inline'"],
        "img-src": ["'self'", "https:", "data:", "blob:"],
        "font-src": ["'self'", "https:", "data:"],
        "connect-src": ["'self'", "https:", "wss:", "ws:"],
        "frame-src": ["'self'", "https:"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ---------- session ----------
app.use(
  session({
    name: 'rd.sid',
    secret: ENV.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd // true kalau di belakang HTTPS reverse-proxy
    }
  })
);

// ---------- static assets ----------
app.use(
  '/assets',
  express.static(path.join(__dirname, '../public/assets'), {
    maxAge: '7d',
    etag: true
  })
);

// ---------- helpers ----------
const ADMIN_PATH = String(ENV.ADMIN_PATH || 'admin').replace(/^\/+|\/+$/g, '');

function wantsSpaJson(req) {
  // SPA JSON endpoints:
  // - public partial: /p/...
  // - admin partial:  /<ADMIN_PATH>/p/...
  const p = req.path || '';
  return p.startsWith('/p/') || p.startsWith(`/${ADMIN_PATH}/p/`) || p.includes('/p/');
}

function renderToString(res, view, data = {}) {
  return new Promise((resolve) => {
    res.render(view, data, (err, html) => {
      if (err) {
        const msg = isProd ? 'Server error' : (err?.stack || err?.message || String(err));
        return resolve(`
          <div class="card card-pad">
            <div class="badge"><i class="ri-error-warning-line"></i> Render Error</div>
            <div class="h2 mt-2">Template tidak ditemukan / error</div>
            <div class="muted text-sm mt-2"><pre style="white-space:pre-wrap">${msg}</pre></div>
          </div>
        `);
      }
      resolve(html);
    });
  });
}

// ---------- routes ----------
// ✅ PUBLIC hanya di root
app.use('/', spaPublic);
app.use('/api', apiPublic);

// ✅ ADMIN dipisah total: tidak lagi app.use('/', spaAdmin)
app.use(`/${ADMIN_PATH}`, spaAdmin);
app.use(`/api/${ADMIN_PATH}`, apiAdmin);

// ---------- 404 ----------
app.use(async (req, res) => {
  if (wantsSpaJson(req)) {
    // sesuaikan nama file partial kamu (kalau sudah rename jadi -partial)
    const html = await renderToString(res, 'public/notfound.partial', { path: req.originalUrl });
    return res.status(404).json({ ok: false, title: 'Not Found', html });
  }
  return res.status(404).render('errors/404', { path: req.originalUrl });
});

// ---------- 500 ----------
// eslint-disable-next-line no-unused-vars
app.use(async (err, req, res, next) => {
  const status = err?.statusCode || err?.status || 500;

  if (wantsSpaJson(req)) {
    // sesuaikan nama file partial kamu (kalau sudah rename jadi -partial)
    const html = await renderToString(res, 'errors/500.partial', {
      status,
      message: err?.message || 'Server error'
    });
    return res.status(status).json({ ok: false, title: 'Error', html });
  }

  return res.status(status).render('errors/500', {
    status,
    message: isProd ? 'Server error' : (err?.stack || err?.message || 'Server error')
  });
});

export default app;