import crypto from 'crypto';
import { ENV } from '../db.js';

function keyFromSecret() {
  return crypto.createHash('sha256').update(ENV.SESSION_SECRET).digest();
}

export function encryptText(plain) {
  const iv = crypto.randomBytes(12);
  const key = keyFromSecret();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptText(b64) {
  if (!b64) return '';
  const buf = Buffer.from(String(b64), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const key = keyFromSecret();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}
