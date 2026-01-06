import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

import { ENV } from './db.js';

import spaPublic from './routes/spa.public.js';
import spaAdmin from './routes/spa.admin.js';
import apiPublic from './routes/api.public.js';
import apiAdmin from './routes/api.admin.js';

const app = express();

app.set('view engine', 'ejs');
app.set('views', new URL('./views', import.meta.url).pathname);
app.set('trust proxy', 1);

app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

app.use(rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false
}));

app.use(helmet({
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
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(session({
  name: 'rd.sid',
  secret: ENV.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false
  }
}));

app.use('/assets', express.static(new URL('../public/assets', import.meta.url).pathname, {
  maxAge: '7d',
  etag: true
}));

app.use('/', spaPublic);
app.use('/', spaAdmin);

app.use('/api', apiPublic);
app.use('/api', apiAdmin);

// 404
app.use(async (req, res) => {
  const wantsJson = req.path.startsWith('/p/') || req.path.includes('/p/');
  if (wantsJson) {
    return res.status(404).json({
      ok: false,
      title: 'Not Found',
      html: await new Promise((resolve) =>
        res.render('public/notfound.partial', { path: req.path }, (e, html) => resolve(html))
      )
    });
  }
  return res.status(404).render('errors/404', { path: req.path });
});

// 500
// eslint-disable-next-line no-unused-vars
app.use(async (err, req, res, next) => {
  const wantsJson = req.path.startsWith('/p/') || req.path.includes('/p/');
  const status = err?.statusCode || err?.status || 500;

  if (wantsJson) {
    return res.status(status).json({
      ok: false,
      title: 'Error',
      html: await new Promise((resolve) =>
        res.render('errors/500.partial', { status, message: err?.message || 'Server error' }, (e, html) => resolve(html))
      )
    });
  }
  return res.status(status).render('errors/500', { status, message: err?.message || 'Server error' });
});

export default app;
