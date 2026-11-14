CREATE TABLE IF NOT EXISTS booking_reschedule_history (
 booking CHAR(20) NOT NULL,
 revision TINYINT UNSIGNED NOT NULL,
 request_hash CHAR(64) NOT NULL,
 before_state JSON NOT NULL,
 after_state JSON NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (booking,revision),
 FOREIGN KEY (booking) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB;
