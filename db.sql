CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  email VARCHAR(120) NULL,
  password_hash VARCHAR(255) NOT NULL,
  whatsapp VARCHAR(32) NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(id),
  UNIQUE KEY uk_admin_username(username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(120) NOT NULL,
  `value` TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(id),
  UNIQUE KEY uk_settings_key(`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sku VARCHAR(64) NOT NULL,
  name VARCHAR(180) NOT NULL,
  game_name VARCHAR(120) NOT NULL DEFAULT 'Royal Dreams',
  image VARCHAR(255) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(id),
  UNIQUE KEY uk_products_sku (sku),
  KEY idx_products_active_sort (active, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS product_tiers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  label VARCHAR(64) NOT NULL,
  qty INT UNSIGNED NOT NULL DEFAULT 1,
  price BIGINT UNSIGNED NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(id),
  KEY idx_tiers_product_active (product_id, active, sort_order, id),
  CONSTRAINT fk_tiers_products FOREIGN KEY(product_id) REFERENCES products(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id VARCHAR(80) NOT NULL,
  invoice_token VARCHAR(64) NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  tier_id BIGINT UNSIGNED NOT NULL,

  game_id VARCHAR(120) NULL,
  nickname VARCHAR(120) NULL,
  whatsapp VARCHAR(32) NULL,
  whatsapp_raw VARCHAR(32) NULL,
  email VARCHAR(120) NULL,

  qty INT UNSIGNED NOT NULL DEFAULT 1,
  unit_price BIGINT UNSIGNED NOT NULL DEFAULT 0,
  gross_amount BIGINT UNSIGNED NOT NULL DEFAULT 0,

  pay_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  fulfill_status ENUM('waiting','processing','done','rejected') NOT NULL DEFAULT 'waiting',
  admin_note TEXT NULL,

  provider_deposit_id VARCHAR(120) NULL,
  provider_payload TEXT NULL,

  expires_at DATETIME NULL,
  confirmed_by INT UNSIGNED NULL,
  confirmed_at DATETIME NULL,
  whatsapp_done_sent_at DATETIME NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY(id),
  UNIQUE KEY uk_orders_order_id(order_id),
  UNIQUE KEY uk_orders_invoice(invoice_token),
  KEY idx_orders_created(created_at),
  KEY idx_orders_pay_fulfill(pay_status, fulfill_status, created_at),
  KEY idx_orders_exp(expires_at),
  CONSTRAINT fk_orders_products FOREIGN KEY(product_id) REFERENCES products(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_orders_tiers FOREIGN KEY(tier_id) REFERENCES product_tiers(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS withdraws (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  wd_id VARCHAR(80) NOT NULL,
  ref_id VARCHAR(80) NOT NULL,

  created_by INT UNSIGNED NULL,
  approved_by INT UNSIGNED NULL,
  approved_at DATETIME NULL,
  admin_note TEXT NULL,

  bank_code VARCHAR(32) NOT NULL,
  bank_name VARCHAR(80) NULL,
  account_number VARCHAR(64) NOT NULL,
  account_name VARCHAR(120) NULL,

  nominal BIGINT UNSIGNED NOT NULL DEFAULT 0,
  fee BIGINT UNSIGNED NOT NULL DEFAULT 0,
  total_debit BIGINT UNSIGNED NOT NULL DEFAULT 0,

  provider_transfer_id VARCHAR(80) NULL,
  provider_status VARCHAR(32) NULL,
  status ENUM('draft','checking','ready','submitted','success','failed','canceled') NOT NULL DEFAULT 'draft',

  req_snapshot TEXT NULL,
  res_snapshot TEXT NULL,
  last_error VARCHAR(255) NULL,

  finished_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY(id),
  UNIQUE KEY uk_wd_id(wd_id),
  UNIQUE KEY uk_ref_id(ref_id),
  KEY idx_wd_status_created(status, created_at),
  KEY idx_wd_provider(provider_transfer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor ENUM('admin','system') NOT NULL,
  actor_id INT UNSIGNED NULL,
  action VARCHAR(120) NOT NULL,
  target VARCHAR(120) NULL,
  target_id VARCHAR(120) NULL,
  meta JSON NULL,
  ip VARCHAR(45) NULL,
  user_agent TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_actor(actor, actor_id),
  KEY idx_action(action),
  KEY idx_created(created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
