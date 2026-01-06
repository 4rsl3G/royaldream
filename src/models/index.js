import { Sequelize } from 'sequelize';
import { ENV } from '../db.js';

import Admin from './Admin.js';
import Setting from './Setting.js';
import Product from './Product.js';
import ProductTier from './ProductTier.js';
import Order from './Order.js';
import Withdraw from './Withdraw.js';
import AuditLog from './AuditLog.js';

export const sequelize = new Sequelize(ENV.DB.name, ENV.DB.user, ENV.DB.pass, {
  host: ENV.DB.host,
  port: ENV.DB.port,
  dialect: 'mysql',
  logging: false,
  timezone: '+07:00'
});

Admin.initModel(sequelize);
Setting.initModel(sequelize);
Product.initModel(sequelize);
ProductTier.initModel(sequelize);
Order.initModel(sequelize);
Withdraw.initModel(sequelize);
AuditLog.initModel(sequelize);

Product.hasMany(ProductTier, { foreignKey: 'product_id', as: 'tiers' });
ProductTier.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Product.hasMany(Order, { foreignKey: 'product_id', as: 'orders' });
Order.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

ProductTier.hasMany(Order, { foreignKey: 'tier_id', as: 'orders' });
Order.belongsTo(ProductTier, { foreignKey: 'tier_id', as: 'tier' });

export { Admin, Setting, Product, ProductTier, Order, Withdraw, AuditLog };
