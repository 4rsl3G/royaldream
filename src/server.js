import http from 'http';
import bcrypt from 'bcrypt';

import app from './app.js';
import { ENV } from './db.js';
import { sequelize, Admin, Setting } from './models/index.js';
import { startWs } from './services/realtime/ws.js';
import { startCleanupLoop } from './services/cleanupService.js';
import { startWaService } from './services/wa/waService.js';
import { logger } from './services/realtime/logger.js';

const server = http.createServer(app);

async function bootstrapPrimaryAdmin() {
  const count = await Admin.count();
  if (count === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await Admin.create({
      username: 'admin',
      email: 'admin@local',
      password_hash: hash,
      whatsapp: null,
      is_primary: 1
    });
    logger.warn('BOOTSTRAP', { msg: 'Admin dibuat otomatis: admin / admin123' });
  }
}

async function enforceSingleAdmin() {
  const primary = await Admin.findOne({ where: { is_primary: 1 } });
  if (!primary) {
    const first = await Admin.findOne();
    if (first) await first.update({ is_primary: 1 });
  }
  await Admin.destroy({ where: { is_primary: 0 } });
}

async function ensureSettings() {
  const keys = [
    'site_name',
    'site_url',
    'api_url',
    'api_key_enc',
    'wa_admin',
    'webhook_secret',
    'invoice_exp_minutes'
  ];
  for (const k of keys) {
    const exists = await Setting.findOne({ where: { key: k } });
    if (!exists) await Setting.create({ key: k, value: '' });
  }
}

(async () => {
  try {
    await sequelize.authenticate();
    logger.info('DB connected', { db: ENV.DB.name });

    await bootstrapPrimaryAdmin();
    await enforceSingleAdmin();
    await ensureSettings();

    startWs(server);
    startCleanupLoop();

    await startWaService(); // WA daemon, stays alive even admin logout

    server.listen(ENV.PORT, () => {
      logger.info('Server up', { port: ENV.PORT, admin: `/${ENV.ADMIN_PATH}` });
    });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
