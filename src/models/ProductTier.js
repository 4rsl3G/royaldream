import { DataTypes, Model } from 'sequelize';

export default class ProductTier extends Model {
  static initModel(sequelize) {
    ProductTier.init({
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      label: { type: DataTypes.STRING(64), allowNull: false },
      qty: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      price: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      active: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 1 },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: true }
    }, {
      sequelize,
      tableName: 'product_tiers',
      timestamps: false,
      underscored: true
    });
  }
}
