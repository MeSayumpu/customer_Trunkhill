CREATE TABLE IF NOT EXISTS payment_file_claims (
  file_hash CHAR(64) PRIMARY KEY,
  booking CHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS booking_phone_guards (
  phone VARCHAR(20) PRIMARY KEY,
  duplicate_count INT UNSIGNED NOT NULL DEFAULT 0,
  blocked_at DATETIME NULL,
  unlocked_at DATETIME NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS duplicate_slip_events (
  booking CHAR(20) PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  file_hash CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX duplicate_phone (phone,created_at),
  FOREIGN KEY (booking) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB;
INSERT IGNORE INTO payment_file_claims (file_hash,booking)
SELECT SHA2(slip,256),MIN(booking) FROM booking_payments WHERE slip IS NOT NULL GROUP BY SHA2(slip,256);
