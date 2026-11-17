import { readFile } from 'node:fs/promises'
import {customerExperienceSchema} from './customer-experience-schema.mjs'
import { createConnection } from 'mysql2/promise'
import { tentCodes } from '../lib/rentals.js'
import { wholeCampCode, wholeCampName } from '../lib/whole-camp.js'

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env.local first')

const connection = await createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true })
const checkoutOnly = process.argv.includes('--checkout-only')
const rescheduleOnly = process.argv.includes('--reschedule-only')
const pricingOnly = process.argv.includes('--pricing-only')
// Production upgrade: never re-add the demo plots/gear that an admin may have deleted.
const keepCatalog = process.argv.includes('--keep-catalog')

async function initBase() {
  let schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')
  if (keepCatalog) schema = schema.replace(/INSERT IGNORE INTO inventory[^;]*;/g, '')
  await connection.query(schema)
  await connection.query(await readFile(new URL('../db/storage.sql',import.meta.url),'utf8'))
  await ensureColumns([['zone_details','active','BOOLEAN NOT NULL DEFAULT TRUE']])
  await connection.query(await readFile(new URL('../db/plot-map-versions.sql',import.meta.url),'utf8'))
  await ensureColumns([['settings','reschedule_notice_days','SMALLINT UNSIGNED NOT NULL DEFAULT 3']])
  await ensureColumns([['settings','reschedule_limit','TINYINT UNSIGNED NOT NULL DEFAULT 3']])
  await connection.query(await readFile(new URL('../db/booking-amendments.sql',import.meta.url),'utf8'))
  await connection.query(await readFile(new URL('../db/slip-protection.sql',import.meta.url),'utf8'))
  // Date ranges (long weekends…) in which a booked stay cannot be rescheduled.
  await connection.query(`CREATE TABLE IF NOT EXISTS reschedule_blackouts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, label VARCHAR(120) NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL,
    INDEX reschedule_blackouts_dates (start_date,end_date))`)
  await ensureColumns([['inventory','tent_discount_tiers','TEXT NULL']])
  // Rooms: guests covered by the price, the most adults + seniors a room takes, and the nightly charge per extra one.
  await ensureColumns([
    ['inventory','room_base_guests','TINYINT UNSIGNED NOT NULL DEFAULT 2'],
    ['inventory','room_max_guests','TINYINT UNSIGNED NOT NULL DEFAULT 4'],
    ['inventory','room_extra_guest_price','INT UNSIGNED NOT NULL DEFAULT 150'],
    ['booking_lines','room_adults','TINYINT UNSIGNED NULL'],
    ['booking_lines','room_seniors','TINYINT UNSIGNED NULL'],
    ['booking_lines','room_children','TINYINT UNSIGNED NULL'],
  ])
  await ensureColumns([['settings','slip_duplicate_check','BOOLEAN NOT NULL DEFAULT TRUE']])
  // Free-text note the admin keeps on a booking (deposits taken, requests…); customers never see it.
  await ensureColumns([['bookings','admin_note','VARCHAR(1000) NULL']])
  // Manager sign-in (hashed password, changed by the admin in Settings).
  await connection.query(await readFile(new URL('../db/staff.sql',import.meta.url),'utf8'))
  // Check-in step between a confirmed booking and its check-out.
  await connection.query(await readFile(new URL('../db/checkin.sql',import.meta.url),'utf8'))
  // New tables take the database's default collation, which on an upgraded site differs from the older bookings table;
  // they are joined on the booking id, so they are given the same character set and collation as bookings.id.
  const [[bookingId]] = await connection.execute(
    "SELECT character_set_name AS charset,collation_name AS collation FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='bookings' AND column_name='id'")
  if (/^\w+$/.test(bookingId?.charset || '') && /^\w+$/.test(bookingId?.collation || ''))
    for (const table of ['booking_checkins','booking_checkin_items'])
      await connection.query(`ALTER TABLE ${table} CONVERT TO CHARACTER SET ${bookingId.charset} COLLATE ${bookingId.collation}`)
  await ensureColumns([['payment_config','bank_name','VARCHAR(120) NULL'],['payment_config','bank_account','VARCHAR(20) NULL']])
  const [[galleryCaption]] = await connection.execute(
    "SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='zone_details' AND column_name='gallery_caption'",
  )
  if (!galleryCaption) {
    await connection.query('ALTER TABLE zone_details ADD COLUMN gallery_caption TEXT NULL')
  }
  const [[mapShape]] = await connection.execute(
    "SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='plot_map_positions' AND column_name='shape_json'",
  )
  if (!mapShape) {
    await connection.query('ALTER TABLE plot_map_positions ADD COLUMN shape_json TEXT NULL')
  }
}

async function ensureColumns(columns) {
  for (const [table, column, definition] of columns) {
    const [[exists]] = await connection.execute(
      'SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?',
      [table,column],
    )
    if (exists) continue
    try {
      await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error
    }
  }
}

async function initCheckout() {
  const checkoutSchema = await readFile(new URL('../db/checkout.sql', import.meta.url), 'utf8')
  await connection.query(checkoutSchema)
  await ensureColumns([
    ['checkout_settings','free_units_per_guest','INT UNSIGNED NOT NULL DEFAULT 1000'],
    ['booking_checkouts','free_units_per_guest','INT UNSIGNED NOT NULL DEFAULT 0'],
    ['booking_checkouts','lodging_charges','TEXT NULL'],
    // Charge the admin types in for guests who came on top of the booking (satang).
    ['booking_checkouts','guest_amount','INT UNSIGNED NOT NULL DEFAULT 0'],
  ])
  const indexes = [['bookings', 'bookings_status_departure', 'status, departure, id']]
  if (!checkoutOnly) indexes.push(
    ['inventory', 'inventory_kind_code', 'kind, code'],
    ['inventory', 'inventory_kind_zone_code', 'kind, zone, code'],
    ['bookings', 'bookings_status_created', 'status, created_at, id'],
    ['bookings', 'bookings_phone', 'phone'],
    ['bookings', 'bookings_guest', 'guest'],
  )
  await ensureIndexes(indexes)
}

async function ensureIndexes(indexes) {
  for (const [table, name, columns] of indexes) {
    const [[existing]] = await connection.execute(
      'SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND index_name=? LIMIT 1',
      [table, name],
    )
    if (existing) continue
    try {
      await connection.query(`CREATE INDEX ${name} ON ${table} (${columns})`)
    } catch (error) {
      if (error.code !== 'ER_DUP_KEYNAME') throw error
    }
  }
}

try {
  if (pricingOnly || (!checkoutOnly && !rescheduleOnly)) {
    if (!pricingOnly) await initBase()
    await ensureColumns([
      ['settings','solo_person_price','INT UNSIGNED NOT NULL DEFAULT 200'],
      ['settings','holiday_solo_price','INT UNSIGNED DEFAULT NULL'],
      ['settings','holiday_person_price','INT UNSIGNED DEFAULT NULL'],
      ['settings','holiday_plot_price','INT UNSIGNED DEFAULT NULL'],
      ['settings','weekday_person_rates','JSON DEFAULT NULL'],
      ['settings','whole_camp_rates','JSON DEFAULT NULL'],
      ['settings','tent_discount_per_guest','INT UNSIGNED NOT NULL DEFAULT 150'],
      ['settings','tent_discount_guest_limit','INT UNSIGNED NOT NULL DEFAULT 2'],
      ['bookings','tent_discount','INT UNSIGNED NOT NULL DEFAULT 0'],
      ['bookings','whole_camp_free_units','INT UNSIGNED DEFAULT NULL'],
      ['inventory','is_tent','BOOLEAN NOT NULL DEFAULT FALSE'],
      ['inventory','tent_discount_per_guest','INT UNSIGNED DEFAULT NULL'],
      ['inventory','tent_discount_guest_limit','TINYINT UNSIGNED DEFAULT NULL'],
    ])
    // Save inherited discounts on each existing model before the app stops using the old defaults.
    await connection.execute(
      `UPDATE inventory i JOIN settings s ON s.id=1
       SET i.is_tent=TRUE,
           i.tent_discount_per_guest=COALESCE(i.tent_discount_per_guest,s.tent_discount_per_guest),
           i.tent_discount_guest_limit=COALESCE(i.tent_discount_guest_limit,s.tent_discount_guest_limit)
       WHERE i.kind='gear' AND i.code IN (${tentCodes.map(() => '?').join(',')})
         AND (i.is_tent=FALSE OR i.tent_discount_per_guest IS NULL OR i.tent_discount_guest_limit IS NULL)`,
      tentCodes,
    )
    await connection.query(await readFile(new URL('../db/camp-calendar.sql', import.meta.url), 'utf8'))
    // The exclusive package has its own booking line, outside the regular inventory catalog.
    await connection.execute(
      "INSERT IGNORE INTO inventory (code,kind,zone,name,detail,price,stock,active) VALUES (?,'plot','ALL',?,'',0,1,FALSE)",
      [wholeCampCode,wholeCampName],
    )
    await ensureIndexes([['allocations','allocations_night','night']])
  }
  if (!checkoutOnly && !pricingOnly) await ensureColumns([['bookings','reschedule_count','TINYINT UNSIGNED NOT NULL DEFAULT 0']])
  if (!checkoutOnly && !pricingOnly) await connection.query(await readFile(new URL('../db/booking-reschedule-history.sql',import.meta.url),'utf8'))
  if (!rescheduleOnly && !pricingOnly) await initCheckout()
  if (!checkoutOnly && !rescheduleOnly && !pricingOnly) await customerExperienceSchema(connection)
  await connection.query(await readFile(new URL('../db/admin-feedback.sql',import.meta.url),'utf8'))
  await connection.query(await readFile(new URL('../db/facility-media.sql',import.meta.url),'utf8'))
  await ensureColumns([['zone_details','features','LONGTEXT NULL']])
  // Which of its zone's highlights/facilities a plot has; NULL = all of them.
  await ensureColumns([['inventory','plot_features','LONGTEXT NULL']])
  // Admin-chosen display order of rental items; 0 = not arranged yet (falls back to code order).
  await ensureColumns([['inventory','sort_order','INT NOT NULL DEFAULT 0']])
  await connection.query(await readFile(new URL('../db/inventory-gallery.sql',import.meta.url),'utf8'))
  console.log(pricingOnly ? 'Trunkhill pricing schema is ready.' : rescheduleOnly ? 'Trunkhill reschedule schema is ready.' :
    checkoutOnly ? 'Trunkhill checkout schema is ready.' : 'Trunkhill schema and demo catalog are ready.')
} finally {
  await connection.end()
}
