import { DataTypes, Model } from 'sequelize';

export default class Order extends Model {
  static initModel(sequelize) {
    Order.init({
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      order_id: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      invoice_token: { type: DataTypes.STRING(64), allowNull: false, unique: true },

      product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      tier_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },

      game_id: { type: DataTypes.STRING(120), allowNull: true },
      nickname: { type: DataTypes.STRING(120), allowNull: true },
      whatsapp: { type: DataTypes.STRING(32), allowNull: true },
      whatsapp_raw: { type: DataTypes.STRING(32), allowNull: true },
      email: { type: DataTypes.STRING(120), allowNull: true },

      qty: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      unit_price: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      gross_amount: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },

      pay_status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'pending' },
      fulfill_status: { type: DataTypes.ENUM('waiting', 'processing', 'done', 'rejected'), allowNull: false, defaultValue: 'waiting' },

      admin_note: { type: DataTypes.TEXT, allowNull: true },

      provider_deposit_id: { type: DataTypes.STRING(120), allowNull: true },
      provider_payload: { type: DataTypes.TEXT, allowNull: true },

      expires_at: { type: DataTypes.DATE, allowNull: true },

      confirmed_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      confirmed_at: { type: DataTypes.DATE, allowNull: true },
      whatsapp_done_sent_at: { type: DataTypes.DATE, allowNull: true },

      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: true }
    }, {
      sequelize,
      tableName: 'orders',
      timestamps: false,
      underscored: true
    });
  }
}
