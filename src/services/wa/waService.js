import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import QRCode from 'qrcode';

import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} from 'baileys';

import { getAdminWa, getSiteUrl } from '../settingsService.js';
import { logger } from '../realtime/logger.js';
import { normalizeWhatsapp } from '../../utils/phone.js';
import { TPL } from './templates.js';
import { Order } from '../../models/index.js';
import { bus, EVT } from '../realtime/bus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTH_DIR = process.env.WA_AUTH_DIR
  ? (path.isAbsolute(process.env.WA_AUTH_DIR)
      ? process.env.WA_AUTH_DIR
      : path.resolve(process.cwd(), process.env.WA_AUTH_DIR))
  : path.resolve(__dirname, '../../../storage/wa_auth');

let sock = null;
let auth = null;

const waState = {
  connection: 'idle',
  last_qr_png: null,
  pairing_code: null,
  last_error: null,
  me: null,
  updated_at: Date.now()
};

async function ensureDir() {
  await fsp.mkdir(AUTH_DIR, { recursive: true });
}

function safeState() {
  return {
    connection: waState.connection,
    last_qr_png: waState.last_qr_png,
    pairing_code: waState.pairing_code,
    last_error: waState.last_error,
    me: waState.me,
    updated_at: waState.updated_at
  };
}

function emitState(extra = {}) {
  Object.assign(waState, extra, { updated_at: Date.now() });
  bus.emit(EVT.WA_UPDATED, { state: safeState() });
}

export function getWaState() {
  return safeState();
}

export async function startWaService() {
  await ensureDir();
  auth = await useMultiFileAuthState(AUTH_DIR);

  const { version } = await fetchLatestBaileysVersion();

  waState.connection = 'connecting';
  waState.last_error = null;
  emitState();

  sock = makeWASocket({
    version,
    auth: auth.state,
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', auth.saveCreds);

  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;

    if (qr) {
      try {
        waState.last_qr_png = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
      } catch {
        waState.last_qr_png = null;
      }
      waState.pairing_code = null;
      emitState({ connection: 'connecting' });
      logger.info('WA QR updated');
    }

    if (connection === 'open') {
      emitState({
        connection: 'open',
        last_qr_png: null,
        pairing_code: null,
        last_error: null,
        me: sock?.user || null
      });
      logger.info('WA connected', { user: waState.me });
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;

      emitState({
        connection: 'close',
        me: null,
        last_error: `WA disconnected: ${code || 'unknown'}`
      });

      logger.warn('WA disconnected', { code, shouldReconnect });

      sock = null;
      if (shouldReconnect) setTimeout(() => startWaService().catch(() => {}), 1500);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg?.message) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      '';

    if (!text) return;

    const adminWa = await getAdminWa();
    const normAdmin = normalizeWhatsapp(adminWa).wa_e164;
    const fromNum = (from || '').split('@')[0];

    // Admin commands:
    // done ORDERID catatan...
    // reject ORDERID catatan...
    if (normAdmin && fromNum === normAdmin) {
      const t = text.trim();
      const parts = t.split(' ');
      const cmd = (parts[0] || '').toLowerCase();
      const orderId = parts[1] || '';
      const note = parts.slice(2).join(' ').trim();

      if (cmd === 'done' || cmd === 'reject') {
        const o = await Order.findOne({ where: { order_id: orderId } });
        if (!o) return;

        const siteUrl = await getSiteUrl();

        if (cmd === 'done') {
          await o.update({ fulfill_status: 'done', admin_note: note || null });
          await sendToUser(o.whatsapp, TPL.done({ siteUrl, o, note }));
        } else {
          await o.update({ fulfill_status: 'rejected', admin_note: note || null });
          await sendToUser(o.whatsapp, TPL.rejected({ siteUrl, o, note }));
        }

        bus.emit(EVT.DASHBOARD_UPDATED, {});
        bus.emit(EVT.INVOICE_UPDATED, { invoice_token: o.invoice_token });
      }
    }
  });

  logger.info('WA service started');
}

export async function sendToUser(waE164, text) {
  if (!sock) return;
  if (!waE164) return;
  const jid = `${waE164}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
}

export async function sendToAdmin(text) {
  const adminWa = await getAdminWa();
  const wa = normalizeWhatsapp(adminWa).wa_e164;
  if (!wa) return;
  return sendToUser(wa, text);
}

export async function requestPairingCode(phoneE164, customCode) {
  if (!sock) throw new Error('WA socket belum siap');
  const code = await sock.requestPairingCode(String(phoneE164), customCode || undefined);
  emitState({ pairing_code: code, last_qr_png: null });
  return code;
}

export async function waLogout() {
  try { if (sock) await sock.logout(); } catch {}
  sock = null;
  try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}

  emitState({
    connection: 'idle',
    last_qr_png: null,
    pairing_code: null,
    me: null,
    last_error: null
  });

  setTimeout(() => startWaService().catch(() => {}), 1200);
}

// OTP reset password
const otpStore = new Map();

export function genOtp() {
  const code = crypto.randomInt(100000, 999999).toString();
  otpStore.set(code, { exp: Date.now() + 5 * 60 * 1000 });
  return code;
}

export function verifyOtp(code) {
  const o = otpStore.get(code);
  if (!o) return false;
  if (Date.now() > o.exp) { otpStore.delete(code); return false; }
  otpStore.delete(code);
  return true;
}
