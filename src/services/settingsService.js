import { Setting } from '../models/index.js';
import { encryptText, decryptText } from '../utils/crypto.js';

export async function getSetting(key, fallback = '') {
  const s = await Setting.findOne({ where: { key } });
  return s?.value ?? fallback;
}
export async function setSetting(key, value) {
  const s = await Setting.findOne({ where: { key } });
  if (!s) return Setting.create({ key, value: String(value ?? '') });
  return s.update({ value: String(value ?? '') });
}

export async function getGatewayConfig() {
  const api_url = (await getSetting('api_url', 'https://atlantich2h.com')).trim();
  const api_key_enc = await getSetting('api_key_enc', '');
  const api_key = decryptText(api_key_enc || '');
  return { api_url, api_key };
}
export async function setApiKey(plain) {
  await setSetting('api_key_enc', encryptText(plain));
}

export async function getWebhookSecret() {
  return (await getSetting('webhook_secret', '')).trim();
}

export async function getAdminWa() {
  return (await getSetting('wa_admin', '')).trim();
}

export async function getSiteUrl() {
  return (await getSetting('site_url', '')).trim();
}
