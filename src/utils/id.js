import crypto from 'crypto';

export function randHex(n = 10) {
  return crypto.randomBytes(Math.ceil(n / 2)).toString('hex').slice(0, n);
}

export function orderId() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `RD${y}${m}${day}${randHex(10).toUpperCase()}`;
}

export function token() {
  return crypto.randomBytes(18).toString('hex');
}

export function withdrawId(prefix = 'WD') {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${prefix}-${y}${m}${day}-${randHex(10)}`;
}
