import { DataTypes, Model } from 'sequelize';

export default class Admin extends Model {
  static initModel(sequelize) {
    Admin.init({
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      username: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      email: { type: DataTypes.STRING(120), allowNull: true },
      password_hash: { type: DataTypes.STRING(255), allowNull: false },
      whatsapp: { type: DataTypes.STRING(32), allowNull: true },
      is_primary: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 1 },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    }, {
      sequelize,
      tableName: 'admins',
      timestamps: false,
      underscored: true
    });
  }
}
