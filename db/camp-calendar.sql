CREATE TABLE IF NOT EXISTS camp_calendar (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind ENUM('closed','holiday','season') NOT NULL,
  label VARCHAR(120) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  solo_person_price INT UNSIGNED DEFAULT NULL,
  person_price INT UNSIGNED DEFAULT NULL,
  plot_price INT UNSIGNED DEFAULT NULL,
  INDEX camp_calendar_dates (start_date, end_date)
) ENGINE=InnoDB;
