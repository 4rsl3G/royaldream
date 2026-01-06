import { DataTypes, Model } from 'sequelize';

export default class AuditLog extends Model {
  static initModel(sequelize) {
    AuditLog.init({
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      actor: { type: DataTypes.ENUM('admin', 'system'), allowNull: false },
      actor_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      action: { type: DataTypes.STRING(120), allowNull: false },
      target: { type: DataTypes.STRING(120), allowNull: true },
      target_id: { type: DataTypes.STRING(120), allowNull: true },
      meta: { type: DataTypes.JSON, allowNull: true },
      ip: { type: DataTypes.STRING(45), allowNull: true },
      user_agent: { type: DataTypes.TEXT, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    }, {
      sequelize,
      tableName: 'audit_logs',
      timestamps: false,
      underscored: true
    });
  }
}
