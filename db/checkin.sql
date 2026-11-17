-- Check-in at the camp: confirmed booking → check-in → check-out.
-- No foreign keys here: on an upgraded site the database default collation differs from the older bookings table, which
-- makes MariaDB refuse them. scripts/init-db.mjs converts these tables to the collation of bookings.id after creating them.
-- booking_checkins keeps when the guests arrived, the guest counts the booking had before the admin entered the actual
-- ones, a short note, and added_amount: the baht of equipment added at (or after) check-in, which is not paid yet and is
-- collected with the check-out bill. Times are UTC, like the other times in this database.
CREATE TABLE IF NOT EXISTS booking_checkins (
  booking CHAR(20) PRIMARY KEY,
  booked_adults SMALLINT UNSIGNED NOT NULL,
  booked_children SMALLINT UNSIGNED NOT NULL,
  booked_seniors SMALLINT UNSIGNED NOT NULL,
  note VARCHAR(500) NOT NULL DEFAULT '',
  added_amount INT UNSIGNED NOT NULL DEFAULT 0,
  checked_in_at DATETIME NOT NULL
) ENGINE=InnoDB;

-- One row per piece of equipment added at check-in. The same quantities are also on the booking's own lines and stock
-- allocations, so availability and the customer's booking page count them; this table says what was added and when.
CREATE TABLE IF NOT EXISTS booking_checkin_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking CHAR(20) NOT NULL,
  code VARCHAR(24) NOT NULL,
  name VARCHAR(120) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price INT UNSIGNED NOT NULL,
  nights SMALLINT UNSIGNED NOT NULL,
  amount INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  INDEX booking_checkin_items_booking (booking)
) ENGINE=InnoDB;
