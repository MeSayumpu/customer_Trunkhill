-- Extra photos for a room (Trunkbox etc.). The main photo stays in inventory_photos and is shown first.
CREATE TABLE IF NOT EXISTS inventory_gallery (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(24) NOT NULL,
  mime VARCHAR(32) NOT NULL,
  content MEDIUMBLOB NOT NULL,
  sort INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX inventory_gallery_code (code, sort, id),
  FOREIGN KEY (code) REFERENCES inventory(code) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;
