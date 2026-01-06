import { Op } from 'sequelize';
import { Order } from '../models/index.js';
import { cancelDeposit } from './gateway/deposit.js';
import { bus, EVT } from './realtime/bus.js';
import { logger } from './realtime/logger.js';
import { logAudit } from './auditService.js';

export function startCleanupLoop() {
  setInterval(async () => {
    try {
      const now = new Date();
      const rows = await Order.findAll({
        where: {
          pay_status: 'pending',
          expires_at: { [Op.ne]: null, [Op.lt]: now }
        },
        limit: 50,
        order: [['expires_at', 'ASC']]
      });

      for (const o of rows) {
        if (o.provider_deposit_id) {
          try { await cancelDeposit({ id: o.provider_deposit_id }); } catch {}
        }
        await o.update({ pay_status: 'expired' });

        await logAudit({
          actor: 'system',
          action: 'INVOICE_EXPIRED',
          target: 'order',
          target_id: o.order_id,
          meta: { provider_id: o.provider_deposit_id },
          req: null
        });

        bus.emit(EVT.INVOICE_UPDATED, { invoice_token: o.invoice_token });
      }

      if (rows.length) {
        bus.emit(EVT.DASHBOARD_UPDATED, {});
        logger.warn('Auto-expired invoices', { count: rows.length });
      }
    } catch {}
  }, 30_000);
}
