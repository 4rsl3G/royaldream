import { bus, EVT } from './bus.js';

function emit(level, msg, meta) {
  const line = { ts: new Date().toISOString(), level, msg, meta: meta || null };
  bus.emit(EVT.LOG, line);
  // eslint-disable-next-line no-console
  console.log(`[${level}]`, msg, meta || '');
}

export const logger = {
  info: (m, meta) => emit('info', m, meta),
  warn: (m, meta) => emit('warn', m, meta),
  error: (m, meta) => emit('error', m, meta),
  debug: (m, meta) => emit('debug', m, meta)
};
