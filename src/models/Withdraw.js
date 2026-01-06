import { DataTypes, Model } from 'sequelize';

export default class Withdraw extends Model {
  static initModel(sequelize) {
    Withdraw.init({
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },

      wd_id: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      ref_id: { type: DataTypes.STRING(80), allowNull: false, unique: true },

      created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      approved_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      approved_at: { type: DataTypes.DATE, allowNull: true },
      admin_note: { type: DataTypes.TEXT, allowNull: true },

      bank_code: { type: DataTypes.STRING(32), allowNull: false },
      bank_name: { type: DataTypes.STRING(80), allowNull: true },
      account_number: { type: DataTypes.STRING(64), allowNull: false },
      account_name: { type: DataTypes.STRING(120), allowNull: true },

      nominal: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      fee: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      total_debit: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },

      provider_transfer_id: { type: DataTypes.STRING(80), allowNull: true },
      provider_status: { type: DataTypes.STRING(32), allowNull: true },
      status: { type: DataTypes.ENUM('draft', 'checking', 'ready', 'submitted', 'success', 'failed', 'canceled'), allowNull: false, defaultValue: 'draft' },

      req_snapshot: { type: DataTypes.TEXT, allowNull: true },
      res_snapshot: { type: DataTypes.TEXT, allowNull: true },
      last_error: { type: DataTypes.STRING(255), allowNull: true },

      finished_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: true }
    }, {
      sequelize,
      tableName: 'withdraws',
      timestamps: false,
      underscored: true
    });
  }
}
