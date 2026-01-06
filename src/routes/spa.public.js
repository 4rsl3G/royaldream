import express from 'express';
import { Product, ProductTier, Order } from '../models/index.js';
import { getSetting } from '../services/settingsService.js';

const router = express.Router();

function renderPartial(res, view, data) {
  return new Promise((resolve) => res.render(view, data, (e, html) => resolve(html)));
}

router.get('/', async (req, res) => {
  const html = await renderPartial(res, 'layouts/public-layout', {
    title: await getSetting('site_name', 'Royal Dreams Top Up'),
    assetVer: '1',
    body: ''
  });
  res.send(html);
});

router.get('/p/landing', async (req, res) => {
  const html = await renderPartial(res, 'public/landing-partial', {
    siteName: await getSetting('site_name', 'Royal Dreams Top Up')
  });
  res.json({ ok: true, title: 'Home', html });
});

router.get('/p/order', async (req, res) => {
  const products = await Product.findAll({ where: { active: 1 }, order: [['sort_order', 'ASC'], ['id', 'ASC']] });
  const tiers = await ProductTier.findAll({ where: { active: 1 }, order: [['sort_order', 'ASC'], ['id', 'ASC']] });
  const html = await renderPartial(res, 'public/order-partial', { products, tiers });
  res.json({ ok: true, title: 'Order', html });
});

router.get('/p/invoice', async (req, res) => {
  const token = String(req.query.token || '').trim();
  if (!token) {
    return res.status(404).json({
      ok: false,
      title: 'Not Found',
      html: await renderPartial(res, 'public/notfound-partial', { path: req.path })
    });
  }

  const order = await Order.findOne({ where: { invoice_token: token }, include: ['product', 'tier'] });
  if (!order) {
    return res.status(404).json({
      ok: false,
      title: 'Not Found',
      html: await renderPartial(res, 'public/notfound-partial', { path: req.path })
    });
  }

  const html = await renderPartial(res, 'public/invoice-partial', {
    order: {
      order_id: order.order_id,
      invoice_token: order.invoice_token,
      product_name: order.product?.name || '',
      gross_amount: order.gross_amount,
      qty: order.qty,
      pay_status: order.pay_status,
      fulfill_status: order.fulfill_status,
      admin_note: order.admin_note,
      game_id: order.game_id,
      nickname: order.nickname,
      whatsapp_raw: order.whatsapp_raw
    }
  });

  res.json({ ok: true, title: `Invoice ${order.order_id}`, html });
});

export default router;
