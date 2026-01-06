import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: Number(process.env.PORT || 8080),
  ADMIN_PATH: String(process.env.ADMIN_PATH || 'admin'),
  SESSION_SECRET: String(process.env.SESSION_SECRET || 'change_me'),
  DB: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    name: process.env.DB_NAME || 'royaltopup',
    user: process.env.DB_USER || 'root',
    pass: process.env.DB_PASS || ''
  }
};
