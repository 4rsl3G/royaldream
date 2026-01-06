import { WebSocketServer } from 'ws';
import { bus, EVT } from './bus.js';
import { logger } from './logger.js';

let wss;

export function startWs(server) {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    ws.subs = { invoice: null, logs: false, dashboard: false, wa: false };

    ws.on('message', (buf) => {
      try {
        const msg = JSON.parse(buf.toString());
        if (msg.type === 'sub_invoice') ws.subs.invoice = msg.token || null;
        if (msg.type === 'sub_logs') ws.subs.logs = !!msg.on;
        if (msg.type === 'sub_dashboard') ws.subs.dashboard = !!msg.on;
        if (msg.type === 'sub_wa') ws.subs.wa = !!msg.on;
      } catch {}
    });
  });

  bus.on(EVT.INVOICE_UPDATED, ({ invoice_token }) => {
    broadcast((ws) => ws.subs.invoice === invoice_token, { type: 'invoice', token: invoice_token });
  });

  bus.on(EVT.DASHBOARD_UPDATED, () => {
    broadcast((ws) => ws.subs.dashboard, { type: 'dashboard' });
  });

  bus.on(EVT.WA_UPDATED, (payload) => {
    broadcast((ws) => ws.subs.wa, { type: 'wa', ...payload });
  });

  bus.on(EVT.LOG, (line) => {
    broadcast((ws) => ws.subs.logs, { type: 'log', line });
  });

  logger.info('WS started');
}

function broadcast(filter, payload) {
  if (!wss) return;
  const msg = JSON.stringify(payload);
  for (const ws of wss.clients) {
    if (ws.readyState !== 1) continue;
    if (!filter(ws)) continue;
    ws.send(msg);
  }
}
