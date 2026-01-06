import express from 'express';

import { Product, ProductTier, Order } from '../models/index.js';
import { createDeposit, cancelDeposit } from '../services/gateway/deposit.js';
import { normalizeWhatsapp } from '../utils/phone.js';
import { orderId, token } from '../utils/id.js';

import { getSetting, getWebhookSecret, getSiteUrl } from '../services/settingsService.js';
import { bus, EVT } from '../services/realtime/bus.js';
import { logger } from '../services/realtime/logger.js';
import { sendToUser, sendToAdmin } from '../services/wa/waService.js';
import { TPL } from '../services/wa/templates.js';
import { logAudit } from '../services/auditService.js';

const router = express.Router();

router.post('/public/order', async (req, res) => {
  try {
    const { product_id, tier_id, game_id, nickname, whatsapp, email } = req.body;

    const prod = await Product.findOne({ where: { id: Number(product_id), active: 1 } });
    if (!prod) return res.json({ ok: false, message: 'Produk tidak valid' });

    const tier = await ProductTier.findOne({ where: { id: Number(tier_id), product_id: prod.id, active: 1 } });
    if (!tier) return res.json({ ok: false, message: 'Nominal tidak valid' });

    const { wa_e164, wa_raw } = normalizeWhatsapp(whatsapp);
    if (!wa_e164) return res.json({ ok: false, message: 'WhatsApp tidak valid' });

    const oid = orderId();
    const inv = token();

    const expMin = Number(await getSetting('invoice_exp_minutes', '20')) || 20;
    const expires_at = new Date(Date.now() + expMin * 60 * 1000);

    const order = await Order.create({
      order_id: oid,
      invoice_token: inv,
      product_id: prod.id,
      tier_id: tier.id,
      game_id: String(game_id || '').trim(),
      nickname: String(nickname || '').trim(),
      whatsapp: wa_e164,
      whatsapp_raw: wa_raw,
      email: email ? String(email).trim() : null,
      qty: 1,
      unit_price: Number(tier.price),
      gross_amount: Number(tier.price),
      pay_status: 'pending',
      fulfill_status: 'waiting',
      expires_at
    });

    const dep = await createDeposit({
      reff_id: oid,
      nominal: order.gross_amount,
      type: 'ewallet',
      metode: 'qris'
    });

    if (String(dep?.status) !== 'true') {
      await order.update({ pay_status: 'failed', admin_note: `Deposit error: ${dep?.message || 'unknown'}` });
      return res.json({ ok: false, message: dep?.message || 'Gagal buat invoice' });
    }

    const providerId = dep?.data?.id || dep?.data?.trx_id || dep?.data?.transaction_id || null;

    await order.update({
      provider_deposit_id: providerId ? String(providerId) : null,
      provider_payload: JSON.stringify(dep).slice(0, 2500)
    });

    const siteUrl = await getSiteUrl();

    await logAudit({ actor: 'system', action: 'ORDER_CREATED', target: 'order', target_id: oid, meta: { amount: order.gross_amount }, req });
    await sendToAdmin(`📥 Order masuk\nOrder: ${oid}\nNominal: Rp ${order.gross_amount.toLocaleString('id-ID')}\nWA: ${wa_raw}`);

    // pesan ke user: invoice dibuat + link
    await sendToUser(order.whatsapp, TPL.invoiceCreated({ siteUrl, o: order }));

    bus.emit(EVT.DASHBOARD_UPDATED, {});
    bus.emit(EVT.INVOICE_UPDATED, { invoice_token: inv });

    return res.json({
      ok: true,
      toast: { type: 'success', message: 'Invoice dibuat. Silakan bayar QRIS.' },
      data: { invoice_url: `/p/invoice?token=${encodeURIComponent(inv)}` }
    });
  } catch (e) {
    return res.json({ ok: false, message: e.message || 'Server error' });
  }
});

// webhook deposit (header x-webhook-secret)
router.post('/public/webhook/deposit', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    const secret = await getWebhookSecret();
    if (!secret) return res.status(403).json({ ok: false });

    const got = String(req.headers['x-webhook-secret'] || '');
    if (got !== secret) return res.status(403).json({ ok: false });

    const { status, data } = req.body || {};
    const reff = String(data?.reff_id || '').trim();
    if (!reff) return res.json({ ok: true });

    const order = await Order.findOne({ where: { order_id: reff } });
    if (!order) return res.json({ ok: true });

    const st = String(status || '').toLowerCase();
    const paidLike = ['paid', 'success', 'sukses', 'completed'];

    if (paidLike.includes(st) && order.pay_status !== 'paid') {
      await order.update({ pay_status: 'paid' });

      const siteUrl = await getSiteUrl();
      await sendToUser(order.whatsapp, TPL.paid({ siteUrl, o: order }));
      await sendToAdmin(`✅ Pembayaran sukses\nOrder: ${order.order_id}\nNominal: Rp ${order.gross_amount.toLocaleString('id-ID')}`);

      await logAudit({
        actor: 'system',
        action: 'PAYMENT_PAID',
        target: 'order',
        target_id: order.order_id,
        meta: { provider_id: order.provider_deposit_id },
        req
      });

      bus.emit(EVT.DASHBOARD_UPDATED, {});
      bus.emit(EVT.INVOICE_UPDATED, { invoice_token: order.invoice_token });
    }

    return res.json({ ok: true });
  } catch (e) {
    logger.error('webhook error', { err: e.message });
    return res.json({ ok: false });
  }
});

// cancel invoice (optional)
router.post('/public/invoice/cancel', async (req, res) => {
  try {
    const inv = String(req.body.token || '').trim();
    if (!inv) return res.json({ ok: false, message: 'Token kosong' });

    const order = await Order.findOne({ where: { invoice_token: inv } });
    if (!order) return res.json({ ok: false, message: 'Invoice tidak ditemukan' });
    if (order.pay_status === 'paid') return res.json({ ok: false, message: 'Sudah paid' });

    if (order.provider_deposit_id) {
      try { await cancelDeposit({ id: order.provider_deposit_id }); } catch {}
    }

    await order.update({ pay_status: 'canceled' });

    bus.emit(EVT.DASHBOARD_UPDATED, {});
    bus.emit(EVT.INVOICE_UPDATED, { invoice_token: order.invoice_token });

    return res.json({ ok: true, toast: { type: 'success', message: 'Invoice dibatalkan' } });
  } catch (e) {
    return res.json({ ok: false, message: e.message });
  }
});

export default router;
