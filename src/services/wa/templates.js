function rupiah(n) {
  return `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
}

export function invoiceLink(siteUrl, invoiceToken) {
  const base = String(siteUrl || '').replace(/\/$/, '');
  if (!base) return '(Link invoice belum diset admin)';
  return `${base}/p/invoice?token=${encodeURIComponent(invoiceToken)}`;
}

export const TPL = {
  invoiceCreated: ({ siteUrl, o }) => (
`🧾 *INVOICE DIBUAT*
━━━━━━━━━━━━━━━━━━
🧾 *Order* : ${o.order_id}
🎮 *Game*  : ${o.game_id || '-'} (${o.nickname || '-'})
💳 *Total* : ${rupiah(o.gross_amount)}
⏰ *Expired*: ${o.expires_at ? new Date(o.expires_at).toLocaleString('id-ID') : '-'}

Silakan lakukan pembayaran QRIS.
Pantau status invoice:
🔗 ${invoiceLink(siteUrl, o.invoice_token)}

Setelah paid, admin akan proses manual. Terima kasih 🙏`
  ),

  paid: ({ siteUrl, o }) => (
`✅ *PEMBAYARAN BERHASIL*
━━━━━━━━━━━━━━━━━━
🧾 *Order* : ${o.order_id}
💳 *Total* : ${rupiah(o.gross_amount)}
📌 *Status*: *PAID*

⏳ Admin akan memproses top up secara *manual*.
Cek status invoice kapan saja:
🔗 ${invoiceLink(siteUrl, o.invoice_token)}

Terima kasih sudah order 🙏`
  ),

  processing: ({ siteUrl, o, note }) => (
`⏳ *ORDER DIPROSES*
━━━━━━━━━━━━━━━━━━
🧾 *Order* : ${o.order_id}
💳 *Total* : ${rupiah(o.gross_amount)}
📌 *Status*: *PROCESSING*

📝 Catatan Admin:
${note ? `_${note}_` : '_Tidak ada catatan_'}

Pantau invoice:
🔗 ${invoiceLink(siteUrl, o.invoice_token)}

Mohon tunggu ya 🙏`
  ),

  done: ({ siteUrl, o, note }) => (
`✅ *ORDER SELESAI*
━━━━━━━━━━━━━━━━━━
🧾 *Order* : ${o.order_id}
💳 *Total* : ${rupiah(o.gross_amount)}
📌 *Status*: *DONE*

📝 Catatan:
${note ? `_${note}_` : '_Terima kasih_'}

Invoice:
🔗 ${invoiceLink(siteUrl, o.invoice_token)}

Terima kasih! Kalau cocok, order lagi ya ✨`
  ),

  rejected: ({ siteUrl, o, note }) => (
`❌ *ORDER DITOLAK*
━━━━━━━━━━━━━━━━━━
🧾 *Order* : ${o.order_id}
💳 *Total* : ${rupiah(o.gross_amount)}
📌 *Status*: *REJECTED*

📝 Alasan:
${note ? `_${note}_` : '_Tidak ada alasan_'}

Cek invoice:
🔗 ${invoiceLink(siteUrl, o.invoice_token)}

Jika butuh bantuan, balas pesan ini ya.`
  ),

  otp: (code) => (
`🔐 *OTP RESET PASSWORD ADMIN*
━━━━━━━━━━━━━━━━━━
Kode OTP: *${code}*
Berlaku: *5 menit*

Jika kamu tidak meminta ini, abaikan pesan ini.`
  )
};
