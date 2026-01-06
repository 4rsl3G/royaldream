export function onlyDigits(s) { return String(s || '').replace(/\D/g, ''); }

export function normalizeWhatsapp(input) {
  let d = onlyDigits(input);
  if (!d) return { wa_e164: null, wa_raw: null };

  if (d.startsWith('0')) d = '62' + d.slice(1);
  if (d.startsWith('8')) d = '62' + d;
  if (!d.startsWith('62')) d = '62' + d.replace(/^0+/, '');

  const raw = d.startsWith('62') ? '0' + d.slice(2) : d;
  return { wa_e164: d, wa_raw: raw };
}
