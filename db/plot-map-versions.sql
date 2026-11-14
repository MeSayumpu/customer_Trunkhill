CREATE TABLE IF NOT EXISTS plot_map_versions (
  revision CHAR(36) PRIMARY KEY,
  elements JSON NOT NULL,
  mime VARCHAR(32) NULL,
  content MEDIUMBLOB NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS plot_map_state (
  id INT PRIMARY KEY,
  draft_revision CHAR(36) NULL,
  published_revision CHAR(36) NULL
) ENGINE=InnoDB;
INSERT IGNORE INTO plot_map_state (id) VALUES (1);
