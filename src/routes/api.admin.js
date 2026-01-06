// src/routes/api.admin.js
import express from 'express';
import bcrypt from 'bcrypt';

import { ENV } from '../db.js';
import { Admin, Product, ProductTier, Order, Withdraw, AuditLog } from '../models/index.js';

import { setSetting, setApiKey, getSiteUrl } from '../services/settingsService.js';
import { getProfile } from '../services/gateway/profile.js';
import { cekRekening, createTransfer, transferStatus } from '../services/gateway/transfer.js';

import { bus, EVT } from '../services/realtime/bus.js';
import { logAudit } from '../services/auditService.js';
import { withdrawId } from '../utils/id.js';
import { normalizeWhatsapp } from '../utils/phone.js';

import {
  sendToUser,
  sendToAdmin,
  genOtp,
  verifyOtp,
  getWaState,
  requestPairingCode,
  waLogout
} from '../services/wa/waService.js';

import { TPL } from '../services/wa/templates.js';

const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.session?.admin_id) return next();
  return res.json({ ok: false, message: 'Unauthorized', redirect: `/${ENV.ADMIN_PATH}?tab=login` });
}

// ===================== AUTH =====================
router.post('/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    const a = await Admin.findOne({ where: { username } });
    if (!a) return res.json({ ok: false, message: 'Login gagal' });

    const ok = await bcrypt.compare(password, a.password_hash);
    if (!ok) return res.json({ ok: false, message: 'Login gagal' });

    req.session.admin_id = a.id;

    await logAudit({
      actor: 'admin',
      actor_id: a.id,
      action: 'ADMIN_LOGIN',
      target: 'admin',
      target_id: String(a.id),
      req
    });

    return res.json({
      ok: true,
      redirect: `/${ENV.ADMIN_PATH}?tab=dashboard`,
      toast: { type: 'success', message: 'Login sukses' }
    });
  } catch (e) {
    return res.json({ ok: false, message: e.message || 'Server error' });
  }
});

router.post('/logout', requireAdmin, async (req, res) => {
  try {
    const id = req.session.admin_id;
    req.session.destroy(() => {});
    await logAudit({ actor: 'admin', actor_id: id, action: 'ADMIN_LOGOUT', target: 'admin', target_id: String(id), req });
    return res.json({ ok: true, redirect: `/${ENV.ADMIN_PATH}?tab=login` });
  } catch (e) {
    return res.json({ ok: false, message: e.message || 'Server error' });
  }
});

// reset password (OTP via WA admin)
router.post('/reset/request', async (req, res) => {
  try {
    const code = genOtp();
    await sendToAdmin(TPL.otp(code));
    return res.json({ ok: true, toast: { type: 'success', message: 'OTP dikirim ke WA admin' } });
  } catch (e) {
    return res.json({ ok: false, message: e.message || 'Gagal kirim OTP' });
  }
});

router.post('/reset/confirm', async (req, res) => {
  try {
    const otp = String(req.body.otp || '').trim();
    const new_password = String(req.body.new_password || '');

    if (!verifyOtp(otp)) return res.json({ ok: false, message: 'OTP invalid/expired' });
    if (new_password.length < 8) return res.json({ ok: false, message: 'Password minimal 8 karakter' });

    const a = await Admin.findOne({ where: { is_primary: 1 } });
    if (!a) return res.json({ ok: false, message: 'Admin utama tidak ditemukan' });

    const hash = await bcrypt.hash(new_password, 10);
    await a.update({ password_hash: hash });

    await logAudit({ actor: 'system', action: 'ADMIN_PASSWORD_RESET', target: 'admin', target_id: String(a.id), req });

    return res.json({ ok: true, toast: { type: 'success', message: 'Password admin berhasil direset' } });
  } catch (e) {
    return res.json({ ok: false, message: e.message || 'Server error' });
  }
});

// ===================== DASHBOARD =====================
router.get('/dashboard/json', requireAdmin, async (req, res) => {
  try {
    const [orders, paid, waiting] = await Promise.all([
      Order.count(),
      Order.count({ where: { pay_status: 'paid' } }),
      Order.count({ where: { fulfill_status: 'waiting' } })
    ]);
    return res.json({ ok: true, data: { orders, paid, waiting } });
  } catch (e) {
    return res.json({ ok: false, message: e.message || 'Server error' });
  }
});

// ===================== PRODUCTS =====================
router.post('/products/create', requireAdmin, async (req, res) => {
  try {
    const sku = String(req.body.sku || '').trim();
    const name = String(req.body.name || '').trim();
    const image = String(req.body.image || '').trim() || null;
    const active = Number(req.body.active ?? 1) ? 1 : 0;
    const sort_order = Number(req.body.sort_order ?? 0);

    if (!sku || !name) return res.json({ ok: false, message: 'SKU dan Nama wajib' });

    const p = await Product.create({ sku, name, image, active, sort_order });

    await logAudit({
      actor: 'admin',
      actor_id: req.session.admin_id,
      action: 'PRODUCT_CREATE',
      target: 'product',
      target_id: String(p.id),
      meta: { sku, name },
      req
    });

    bus.emit(EVT.DASHBOARD_UPDATED, {});
    return res.json({ ok: true, toast: { type: 'success', message: 'Produk dibuat' } });
  } catch (e) {
    return res.json({ ok: false, message: e.message || 'Server error' });
  }
});

router.post('/products/delete', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.json({ ok: false, message: 'ID kosong' });

    await Product.destroy({ where: { id } });

    await logAudit({
      actor: 'admin',
      actor_id: req.session.admin_id,
      action: 'PRODUCT_DELETE',
      target: 'product',
      target_id: String(id),
      req
    });

    bus.emit(EVT.DASHBOARD_UPDATED, {});
    return res.json({ ok: true, toast: { type: 'success', message: 'Produk dihapus' } });
  } catch (e) {
    return res.json({ ok: false, message: e.message || 'Server error' });
  }
});

// ===================== TIERS =====================
router.post('/tiers/create', requireAdmin, async (req, res) => {
  try {
    const product_id = Number(req.body.product_id);
    const label = String(req.body.label || '').trim();
    const qty = Number(req.body.qty || 1);
    const price = Number(req.body.price || 0);

    if (!product_id || !label) return res.json({ ok: false, message: 'Produk & label wajib' });

    const t = await ProductTier.create({ product_id, label, qty, price, active: 1, sort_order: 0 });

    await logAudit({
      actor: 'admin',
      actor_id: req.session.admin_id,
      action: 'TIER_CREATE',
      target: 'tier',
      target_id: String(t.id),
      meta: { product_id, label, qty, price },
      req
    });

    bus.emit(EVT.DASHBOARD_UPDATED, {});
    return res.json({ ok: true, toast: { type: 'success', message: 'Tier dibuat' } });
  } catch (e) {
    return res.json({ ok: false, message: e.message || 'Server error' });
  }
});

router.post('/tiers/delete', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.json({ ok: false, message: 'ID kosong' });

    await ProductTier.destroy({ where: { id } });

    await logAudit({
      actor: 'admin',
      actor_id: req.session.admin_id,
      action: 'TIER_DELETE',
      target: 'tier',
      target_id: String(id),
      req
    });

    bus.emit(EVT.DASHBOARD_UPDATED, {});
    return res.json({ ok: true, toast: { type: 'success', message: 'Tier dihapus' } });
  } catch (e) {
    return res.json({ ok: false, message: e.message || 'Server error' });
  }
});

// ===================== ORDERS STATUS =====================
router.post('/order/:orderId/status', requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const action = String(req.body.action || '').trim();
    const note = String(req.body.note || '').trim();

    const o = await Order.findOne({ where: { order_id: orderId } });
    if (!o) return res.json({ ok: false, message: 'Order tidak ditemukan' });

    const siteUrl = await getSiteUrl();

    if (action === 'processing') {
      await o.update({ fulfill_status: 'processing', admin_note: note || null });
      await sendToUser(o.whatsapp, TPL.processing({ siteUrl, o, note }));
    } else if (action === 'done') {
      await o.update({ fulfill_status: 'done', admin_note: note || null });
      await sendToUser(o.whatsapp, TPL.done({ siteUrl, o, note }));
    } else if (action === 'rejected') {
      await o.update({ fulfill_status: 'rejected', admin_note: note || null });
      await sendToUser(o.whatsapp, TPL.rejected({ siteUrl, o, note }));
    } else {
      return res.json({ ok: false, message: 'Action invalid' });
    }

    await logAudit({
      actor: 'admin',
      actor_id: req.session.admin_id,
      action: 'ORDER_STATUS',
      target: 'order',
      target_id: o.order_id,
      meta: { action, note },
      req
    });

    bus.emit(EVT.DASHBOARD_UPDATED, {});
    bus.emit(EVT.INVOICE_UPDATED, { invoice_token: o.invoice_token });

    return res.json({ ok: true, toast: { type: 'success', message: 'Order diupdate' } });
  } catch (e) {
    return res.json({ ok: false, message: e.message || 'Server error' });
  }
});

// ===================== WITHDRAW =====================
router.post('/withdraw/create', requireAdmin, async (req, res) => {
  try {
    const bank_code = String(req.body.bank_code || '').trim();
    const bank_name = String(req.body.bank_name || '').trim() || null;
    const account_number = String(req.body.account_number || '').trim();
    const nominal = Number(req.body.nominal || 0);

    if (!bank_code || !account_number || nominal <= 0) {
      return res.json({ ok: false, message: 'Data withdraw tidak valid' });
    }

    const wd = await Withdraw.create({
      wd_id: withdrawId('WD'),
      ref_id: withdrawId('WDREF'),
      bank_code,
      bank_name,
      account_number,
      nominal,
      fee: 0,
      total_debit: nominal,
      status: 'draft',
      created_by: req.session.admin_id
    });

    await logAudit({
      actor: 'admin',
      actor_id: req.session.admin_id,
      action: 'WITHDRAW_DRAFT',
      target: 'withdraw',
      target_id: wd.wd_id,
      meta: { nominal: wd.nominal },
      req
    });

    bus.emit(EVT.DASHBOARD_UPDATED, {});
    return res.json({ ok: true, toast: { type: 'success', message: 'Draft withdraw dibuat' } });
  } catch (e) {
    return res.json({ ok: false, message: e.message || 'Server error' });
  }
});

router.post('/withdraw/:id/check', requireAdmin, async (req, res) => {
  try {
    const w = await Withdraw.findByPk(Number(req.params.id));
    if (!w) return res.json({ ok: false, message: 'Withdraw tidak ditemukan' });

    await w.update({ status: 'checking' });

    const r = await cekRekening({ bank_code: w.bank_code, account_number: w.account_number });
    if (String(r?.status) !== 'true') {
      await w.update({
        status: 'failed',
        last_error: r?.message || 'cek rekening gagal',
        finished_at: new Date(),
        res_snapshot: JSON.stringify(r).slice(0, 2500)
      });
      return res.json({ ok: false, message: w.last_error });
    }

    const accName =
      r?.data?.account_name ||
      r?.data?.nama ||
      r?.data?.name ||
      r?.data?.nama_pemilik ||
      '';

    await w.update({
      status: 'ready',
      account_name: String(accName || '').trim() || null,
      res_snapshot: JSON.stringify(r).slice(0, 2500)
    });

    await logAudit({
      actor: 'admin',
      actor_id: req.session.admin_id,
      action: 'WITHDRAW_CHECK_OK',
      target: 'withdraw',
      target_id: w.wd_id,
      meta: { account_name: w.account_name },
      req
    });

    bus.emit(EVT.DASHBOARD_UPDATED, {});
    return res.json({ ok: true, data: { account_name: w.account_name } });
  } catch (e) {
    return res.json({ ok: false, message: e.message || 'Server error' });
  }
});

router.post('/withdraw/:id/submit', requireAdmin, async (req, res) => {
  try {
    const w = await Withdraw.findByPk(Number(req.params.id));
    if (!w) return res.json({ ok: false, message: 'Withdraw tidak ditemukan' });

    if (w.status !== 'ready' && w.status !== 'draft') {
      return res.json({ ok: false, message: 'Withdraw belum siap disubmit' });
    }

    const payload = {
      ref_id: w.ref_id,
      kode_bank: w.bank_code,
      nomor_akun: w.account_number,
      nama_pemilik: w.account_name || '',
      nominal: String(w.nominal),
      email: '',
      phone: '',
      note: String(req.body.note || `Withdraw ${w.wd_id}`)
    };

    await w.update({
      status: 'submitted',
      approved_by: req.session.admin_id,
      approved_at: new Date(),
      req_snapshot: JSON.stringify(payload).slice(0, 2500)
    });

    const r = await createTransfer(payload);
    if (String(r?.status) !== 'true') {
      await w.update({
        status: 'failed',
        last_error: r?.message || 'submit transfer gagal',
        finished_at: new Date(),
        res_snapshot: JSON.stringify(r).slice(0, 2500)
      });
      return res.json({ ok: false, message: w.last_error });
    }

    const pid = r?.data?.id || r?.data?.transfer_id || null;
    const fee = Number(r?.data?.fee || 0);
    const providerStatus = String(r?.data?.status || 'submitted');

    await w.update({
      provider_transfer_id: pid ? String(pid) : null,
      provider_status: providerStatus,
      fee: fee > 0 ? fee : w.fee,
      total_debit: Number(w.nominal) + Number(fee || 0),
      res_snapshot: JSON.stringify(r).slice(0, 2500)
    });

    await logAudit({
      actor: 'admin',
      actor_id: req.session.admin_id,
      action: 'WITHDRAW_SUBMIT',
      target: 'withdraw',
      target_id: w.wd_id,
      meta: { provider_id: w.provider_transfer_id },
      req
    });

    bus.emit(EVT.DASHBOARD_UPDATED, {});
    return res.json({ ok: true, toast: { type: 'success', message: 'Withdraw disubmit' } });
  } catch (e) {
    return res.json({ ok: false, message: e.message || 'Server error' });
  }
});

router.post('/withdraw/:id/status', requireAdmin, async (req, res) => {
  try {
    const w = await Withdraw.findByPk(Number(req.params.id));
    if (!w || !w.provider_transfer_id) return res.json({ ok: false, message: 'Provider ID kosong' });

    const r = await transferStatus({ id: w.provider_transfer_id });
    if (String(r?.status) !== 'true') return res.json({ ok: false, message: r?.message || 'cek status gagal' });

    const st = String(r?.data?.status || '').toLowerCase();
    let next = w.status;

    if (st === 'success' || st === 'sukses') next = 'success';
    else if (st === 'failed' || st === 'gagal') next = 'failed';

    await w.update({
      provider_status: st,
      status: next,
      finished_at: (next === 'success' || next === 'failed') ? new Date() : w.finished_at,
      res_snapshot: JSON.stringify(r).slice(0, 2500)
    });

    await logAudit({
      actor: 'admin',
      actor_id: req.session.admin_id,
      action: 'WITHDRAW_STATUS',
      target: 'withdraw',
      target_id: w.wd_id,
      meta: { status: next, provider_status: st },
      req
    });

    bus.emit(EVT.DASHBOARD_UPDATED, {});
    return res.json({ ok: true, toast: { type: 'success', message: 'Status withdraw diupdate' } });
  } catch (e) {
    return res.json({ ok: false, message: e.message || 'Server error' });
  }
});

// ===================== SETTINGS =====================
router.post('/settings/save', requireAdmin, async (req, res) => {
  try {
    const { site_name, site_url, api_url, api_key, wa_admin, webhook_secret } = req.body;

    if (site_name !== undefined) await setSetting('site_name', site_name);
    if (site_url !== undefined) await setSetting('site_url', site_url);
    if (api_url !== undefined) await setSetting('api_url', api_url);
    if (wa_admin !== undefined) await setSetting('wa_admin', wa_admin);
    if (webhook_secret !== undefined) await setSetting('webhook_secret', webhook_secret);
    if (api_key) await setApiKey(api_key);

    await logAudit({ actor: 'admin', actor_id: req.session.admin_id, action: 'SETTINGS_SAVE', target: 'settings', target_id: '*', req });
    bus.emit(EVT.DASHBOARD_UPDATED, {});
    return res.json({ ok: true, toast: { type: 'success', message: 'Settings disimpan' } });
  } catch (e) {
    return res.json({ ok: false, message: e.message || 'Server error' });
  }
});

router.post('/settings/test', requireAdmin, async (req, res) => {
  try {
    const p = await getProfile();
    return res.json({ ok: true, data: p, toast: { type: 'success', message: 'Koneksi gateway OK' } });
  } catch (e) {
    return res.json({ ok: false, message: e.message || 'Test gagal' });
  }
});

// ===================== WHATSAPP =====================
router.get('/wa/status', requireAdmin, async (req, res) => {
  return res.json({ ok: true, data: getWaState() });
});

router.post('/wa/pair', requireAdmin, async (req, res) => {
  try {
    const phone = String(req.body.phone || '').trim();
    const custom = String(req.body.custom || '').trim();
    const n = normalizeWhatsapp(phone).wa_e164;
    if (!n) return res.json({ ok: false, message: 'Nomor tidak valid' });

    const code = await requestPairingCode(n, custom || undefined);
    return res.json({ ok: true, data: { code }, toast: { type: 'success', message: `Pairing code: ${code}` } });
  } catch (e) {
    return res.json({ ok: false, message: e.message || 'Gagal request pairing code' });
  }
});

router.post('/wa/logout', requireAdmin, async (req, res) => {
  await waLogout();
  await logAudit({ actor: 'admin', actor_id: req.session.admin_id, action: 'WA_LOGOUT_RESET', target: 'wa', target_id: '*', req });
  return res.json({ ok: true, toast: { type: 'success', message: 'WA session direset. Silakan connect ulang.' } });
});

// ===================== AUDIT =====================
router.get('/audit/json', requireAdmin, async (req, res) => {
  const rows = await AuditLog.findAll({ order: [['created_at', 'DESC']], limit: 200 });
  return res.json({ ok: true, data: rows });
});

export default router;