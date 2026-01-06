import express from 'express';
import { ENV } from '../db.js';
import { Product, ProductTier, Order, Withdraw, AuditLog } from '../models/index.js';

const router = express.Router();

function renderPartial(res, view, data) {
  return new Promise((resolve) => res.render(view, data, (e, html) => resolve(html)));
}

function requireAdminPage(req, res, next) {
  if (req.session?.admin_id) return next();
  return res.redirect(`/${ENV.ADMIN_PATH}?tab=login`);
}

router.get(`/${ENV.ADMIN_PATH}`, async (req, res) => {
  const html = await renderPartial(res, 'shell/admin.shell', {
    title: 'Admin',
    assetVer: '1',
    adminPath: ENV.ADMIN_PATH,
    body: ''
  });
  res.send(html);
});

router.get(`/${ENV.ADMIN_PATH}/p/login`, async (req, res) => {
  const html = await renderPartial(res, 'admin/login.partial', { adminPath: ENV.ADMIN_PATH });
  res.json({ ok: true, title: 'Login', html });
});

router.get(`/${ENV.ADMIN_PATH}/p/dashboard`, requireAdminPage, async (req, res) => {
  const html = await renderPartial(res, 'admin/dashboard.partial', {});
  res.json({ ok: true, title: 'Dashboard', html });
});

router.get(`/${ENV.ADMIN_PATH}/p/orders`, requireAdminPage, async (req, res) => {
  const orders = await Order.findAll({ include: ['product'], order: [['created_at', 'DESC']], limit: 200 });
  const html = await renderPartial(res, 'admin/orders.partial', {
    orders: orders.map(o => ({
      order_id: o.order_id,
      product_name: o.product?.name || '',
      game_id: o.game_id,
      nickname: o.nickname,
      whatsapp_raw: o.whatsapp_raw,
      gross_amount: o.gross_amount,
      pay_status: o.pay_status,
      fulfill_status: o.fulfill_status
    }))
  });
  res.json({ ok: true, title: 'Orders', html });
});

router.get(`/${ENV.ADMIN_PATH}/p/products`, requireAdminPage, async (req, res) => {
  const products = await Product.findAll({ order: [['sort_order', 'ASC'], ['id', 'ASC']] });
  const tiers = await ProductTier.findAll({ order: [['sort_order', 'ASC'], ['id', 'ASC']] });
  const html = await renderPartial(res, 'admin/products.partial', { adminPath: ENV.ADMIN_PATH, products, tiers });
  res.json({ ok: true, title: 'Products', html });
});

router.get(`/${ENV.ADMIN_PATH}/p/withdraw`, requireAdminPage, async (req, res) => {
  const rows = await Withdraw.findAll({ order: [['created_at', 'DESC']], limit: 200 });
  const html = await renderPartial(res, 'admin/withdraw.partial', { adminPath: ENV.ADMIN_PATH, rows });
  res.json({ ok: true, title: 'Withdraw', html });
});

router.get(`/${ENV.ADMIN_PATH}/p/settings`, requireAdminPage, async (req, res) => {
  const html = await renderPartial(res, 'admin/settings.partial', { adminPath: ENV.ADMIN_PATH });
  res.json({ ok: true, title: 'Settings', html });
});

router.get(`/${ENV.ADMIN_PATH}/p/whatsapp`, requireAdminPage, async (req, res) => {
  const html = await renderPartial(res, 'admin/whatsapp.partial', {});
  res.json({ ok: true, title: 'WhatsApp', html });
});

router.get(`/${ENV.ADMIN_PATH}/p/logs`, requireAdminPage, async (req, res) => {
  const html = await renderPartial(res, 'admin/logs.partial', {});
  res.json({ ok: true, title: 'Logs', html });
});

router.get(`/${ENV.ADMIN_PATH}/p/audit`, requireAdminPage, async (req, res) => {
  const rows = await AuditLog.findAll({ order: [['created_at', 'DESC']], limit: 200 });
  const html = await renderPartial(res, 'admin/audit.partial', { rows });
  res.json({ ok: true, title: 'Audit', html });
});

export default router;
