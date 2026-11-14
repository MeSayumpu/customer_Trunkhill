CREATE TABLE IF NOT EXISTS booking_reference_counters (
  base VARCHAR(40) PRIMARY KEY,
  sequence INT UNSIGNED NOT NULL
);
CREATE TABLE IF NOT EXISTS booking_references (
  booking CHAR(20) PRIMARY KEY,
  reference VARCHAR(64) NOT NULL UNIQUE,
  FOREIGN KEY (booking) REFERENCES bookings(id) ON DELETE CASCADE
);
