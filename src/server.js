import http from 'http';
import bcrypt from 'bcrypt';
import app from './app.js';
import { ENV } from './db.js';
import { sequelize, Admin, Setting, Product, ProductTier, Order, Withdraw, AuditLog } from './models/index.js';
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
    const first = await Admin.findOne({ order: [['id', 'ASC']] });
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

async function startBootstrap() {
  try {
    await sequelize.authenticate();
    logger.info('Database Connected');

    // 🔥 Wajib sync sebelum query biar tabel kebentuk
    await sequelize.sync({ alter: true });

    await bootstrapPrimaryAdmin();
    await enforceSingleAdmin();
    await ensureSettings();

    // Start realtime WS & cleanup
    startWs(server);
    startCleanupLoop();

    // Start WhatsApp bot service (daemon)
    await startWaService();

    // Jalankan server di port VPS
    server.listen(ENV.PORT, () => {
      logger.info('Server Running', { port: ENV.PORT, admin_panel: `/${ENV.ADMIN_PATH}` });
    });

  } catch (err) {
    logger.error('Bootstrap Error', { message: err.message, stack: err.stack });
    process.exit(1);
  }
}

// Tangkap error yang tidak ke-handle
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection', { message: err.message, stack: err.stack });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { message: err.message, stack: err.stack });
});

// Start bootstrap
startBootstrap();
