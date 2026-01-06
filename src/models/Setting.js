import { DataTypes, Model } from 'sequelize';

export default class Setting extends Model {
  static initModel(sequelize) {
    Setting.init({
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      key: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      value: { type: DataTypes.TEXT, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: true }
    }, {
      sequelize,
      tableName: 'settings',
      timestamps: false,
      underscored: true
    });
  }
}
