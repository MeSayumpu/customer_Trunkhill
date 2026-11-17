-- Sign-in accounts other than the admin (whose password is in the server configuration).
-- updated_at is UTC, like the other times in this database.
-- The manager starts with the password the owner chose; the admin changes it in Settings. Only the hash is stored.
CREATE TABLE IF NOT EXISTS staff_accounts (
  role VARCHAR(20) PRIMARY KEY,
  password_hash VARCHAR(200) NOT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB;

INSERT IGNORE INTO staff_accounts (role,password_hash,updated_at) VALUES ('manager','scrypt$cfc4111566ed67df8265da2b20d74048$4746fe650c7759b762bce0d9e11e8ce6114902c53c6d640dc815c4c49542f9e5',UTC_TIMESTAMP());
