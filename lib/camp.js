import {campOptions,campZones} from './camp-options'
import {bookingWindowEnd} from './booking-window'
import {shiftDate} from './booking-dates'
import { createHash, randomBytes } from 'node:crypto'
import {assignReference} from './booking-reference'
import { lockPhoneGuard } from './phone-guard'
import { database, transaction } from './db'
import { publishedMap, applyMap } from './plot-map-store'
import { stayPricing } from './pricing'
import { isRentalStay, itemOrder } from './rentals'
import { effectiveStatus, liveAllocation } from './payment-rules'
import { rescheduleReason, rescheduleNotice, rescheduleLimit } from './booking-dates'
import { rescheduleBlackout, blackoutReason, blackoutRange } from './reschedule-blackout'
import { calendarPeriods, closureDates, firstClosure, nightlyRates } from './camp-calendar'
import { weekdayRules } from './weekday-pricing'
import { wholeCampCode, wholeCampPrice, wholeCampTier, wholeCampTiers } from './whole-camp'
import { normalizeZoneFeatures, plotFeatures } from './zone-features'
import { purgeUnpaidBookings } from './booking-cleanup'

export class CampError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

const day = 86400000
const dateFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok' })
export const today = () => dateFormat.format(new Date())

export function dates(arrival, departure) {
  const parse = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN
    const time = Date.parse(value)
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN
  }
  const start = parse(arrival)
  const nights = (parse(departure) - start) / day
  if (arrival < today() || !(nights >= 1 && nights <= 30)) {
    throw new CampError('เลือกวันที่ปัจจุบันหรือวันถัดไป และจองได้ครั้งละ 1–30 คืน')
  }
  return Array.from({ length: nights }, (_, i) => new Date(start + i * day).toISOString().slice(0, 10))
}

export const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max
export const codePattern = /^[A-Z0-9][A-Z0-9-]{0,23}$/
export const phoneNumber = value => typeof value === 'string' ? value.replace(/[ ()-]/g, '') : ''

export async function openCalendar(connection, nights) {
  const periods = await calendarPeriods(connection, nights)
  // The whole closed period is named, so the customer can pick dates outside it in one go.
  const closure = firstClosure(nights, periods)
  if (closure) throw new CampError(`แคมป์ปิดให้บริการชั่วคราววันที่ ${closureDates(closure)} กรุณาเลือกวันที่เข้าพักใหม่`, 409)
  return periods
}

export async function assertStock(connection, rows, arrival, departure, ignoreBooking) {
  for (const row of rows) {
    const [[closedZone]] = await connection.execute('SELECT z.zone FROM inventory i JOIN zone_details z ON z.zone=i.zone WHERE i.code=? AND z.active=0',[row.code])
    if(closedZone)throw new CampError(`โซน ${closedZone.zone} ปิดรับจอง กรุณาเลือกรายการใหม่`,409)
    const [[{ peak }]] = await connection.execute(
      `SELECT COALESCE(MAX(used),0) AS peak FROM (
         SELECT SUM(quantity) AS used FROM allocations a WHERE code = ? AND night >= ? AND night < ?
           ${ignoreBooking ? 'AND booking <> ?' : ''} AND ${liveAllocation} GROUP BY night
       ) nightly`, [row.code,arrival,departure,...(ignoreBooking ? [ignoreBooking] : [])])
    if (Number(peak) + row.quantity > row.stock) {
      throw new CampError(`${row.name} ไม่ว่างหรือสต๊อกไม่พอในวันที่เลือก ต้องการ ${row.quantity} เหลือ ${Math.max(0,row.stock-Number(peak))} ${ignoreBooking ? 'กรุณาเลือกวันหรือล็อกใหม่' : 'กรุณาเลือกรายการใหม่'}`,409)
    }
  }
}

async function stayOccupancy(connection, arrival, departure, ignoreBooking, wholeCampOnly = false) {
  const [[occupancy]] = await connection.execute(
    `SELECT COUNT(*) > 0 AS booked, COALESCE(MAX(a.code = ?),0) AS wholeCamp
     FROM allocations a WHERE a.night >= ? AND a.night < ? AND ${liveAllocation}
       ${ignoreBooking ? 'AND a.booking <> ?' : ''} ${wholeCampOnly ? 'AND a.code = ?' : ''}`,
    [wholeCampCode, arrival, departure, ...(ignoreBooking ? [ignoreBooking] : []), ...(wholeCampOnly ? [wholeCampCode] : [])],
  )
  return occupancy
}

export async function lockStaySettings(connection, wholeCamp) {
  // Regular bookings can run concurrently. An exclusive booking must check all inventory before either can commit.
  const [[settings]] = await connection.query(
    'SELECT * FROM settings WHERE id=1 ' + (wholeCamp ? 'FOR UPDATE' : 'LOCK IN SHARE MODE'),
  )
  return settings
}

export async function assertStayAvailable(connection, arrival, departure, wholeCamp, ignoreBooking) {
  const {window}=await campOptions(connection)
  const last=bookingWindowEnd(today(),window)
  if(arrival>last||departure>shiftDate(last,1))throw new CampError("วันเข้าพักอยู่นอกระยะจองล่วงหน้าที่แคมป์เปิดรับ",400)
  const { booked } = await stayOccupancy(connection, arrival, departure, ignoreBooking, !wholeCamp)
  if (booked) throw new CampError(wholeCamp
    ? 'เหมาลานไม่ได้ เพราะมีรายการจองในช่วงวันที่เลือก'
    : 'ช่วงวันที่เลือกมีผู้เหมาลานแล้ว กรุณาเลือกวันใหม่', 409)
}

export async function catalog(arrival, departure, ignoreBooking) {
  const nights = arrival || departure ? dates(arrival, departure) : []
  const connection = await database().getConnection()
  try {
    const [[{ weekday_person_rates, whole_camp_rates, ...settings }]] = await connection.query(
      `SELECT mode, person_price, solo_person_price, reschedule_limit, reschedule_notice_days,
       welcome_title,welcome_subtitle,welcome_title_enabled,welcome_subtitle_enabled,welcome_title_en,welcome_subtitle_en,
       holiday_solo_price, holiday_person_price, holiday_plot_price, weekday_person_rates, whole_camp_rates,
       (SELECT revision FROM plot_map_background WHERE id=1) AS map_version FROM settings WHERE id=1`)
    const options=await campOptions(connection)
    const last=bookingWindowEnd(today(),options.window)
    if(nights.length&&(arrival>last||departure>shiftDate(last,1)))throw new CampError("วันเข้าพักอยู่นอกระยะจองล่วงหน้าที่แคมป์เปิดรับ",400)
    settings.booking_window=options.window;settings.booking_until=last
    settings.zones=await campZones(connection,true)
    // Lets the booking pages warn that a stay in a no-reschedule period cannot be moved later.
    const blackout = nights.length ? await rescheduleBlackout(connection,arrival,departure) : null
    settings.reschedule_blackout = blackout && { label:blackout.label, range:blackoutRange(blackout) }
    const rates = nights.length ? nightlyRates(nights, { ...settings, weekday_person_rates }, await openCalendar(connection, nights)) : []
    const [inventory] = nights.length
      ? await connection.execute(`SELECT i.*, m.x AS map_x, m.y AS map_y, m.shape_json AS map_shape,
          GREATEST(0, i.stock - COALESCE(a.peak,0)) AS available,
          EXISTS(SELECT 1 FROM inventory_photos p WHERE p.code=i.code) AS has_photo,
          (SELECT GROUP_CONCAT(g.id ORDER BY g.sort,g.id) FROM inventory_gallery g WHERE g.code=i.code) AS gallery
          FROM inventory i LEFT JOIN plot_map_positions m ON m.code=i.code LEFT JOIN (
            SELECT code, MAX(used) AS peak FROM (
              SELECT code, night, SUM(quantity) AS used FROM allocations a
              WHERE night >= ? AND night < ? ${ignoreBooking ? 'AND booking <> ?' : ''} AND ${liveAllocation} GROUP BY code, night
            ) nightly GROUP BY code
          ) a ON a.code = i.code WHERE i.active = 1 AND NOT EXISTS(SELECT 1 FROM zone_details z WHERE z.zone=i.zone AND z.active=0) ORDER BY ${itemOrder}`, [arrival, departure,...(ignoreBooking?[ignoreBooking]:[])])
      : await connection.query(`SELECT i.*, m.x AS map_x, m.y AS map_y, m.shape_json AS map_shape, stock AS available,
          EXISTS(SELECT 1 FROM inventory_photos p WHERE p.code=i.code) AS has_photo,
          (SELECT GROUP_CONCAT(g.id ORDER BY g.sort,g.id) FROM inventory_gallery g WHERE g.code=i.code) AS gallery
          FROM inventory i LEFT JOIN plot_map_positions m ON m.code=i.code WHERE i.active = 1 AND NOT EXISTS(SELECT 1 FROM zone_details z WHERE z.zone=i.zone AND z.active=0) ORDER BY ${itemOrder}`)
    const published = await publishedMap(connection)
    // Each plot carries the highlights and facilities picked for it (all of its zone's when never customised).
    const [zoneRows] = await connection.query('SELECT zone,features FROM zone_details')
    const zoneFeatures = new Map(zoneRows.map(row => [row.zone,normalizeZoneFeatures(row.features)]))
    const mappedInventory = applyMap(inventory,published).map(({plot_features,...item}) =>
      item.kind !== 'gear' && item.code !== wholeCampCode ? {...item, features:plotFeatures(zoneFeatures.get(item.zone),plot_features)} : item)
    if (published) settings.map_version = published.mime ? published.revision : null
    const occupancy = nights.length ? await stayOccupancy(connection, arrival, departure, ignoreBooking) : null
    const tiers = wholeCampTiers(whole_camp_rates)
    return {
      settings: { ...settings, hasWeekdayRates: weekdayRules({ weekday_person_rates }).length > 0 },
      inventory: occupancy?.wholeCamp ? mappedInventory.map(item => ({ ...item, available:0 })) : mappedInventory,
      rates,
      wholeCampAvailable: !!occupancy && !occupancy.booked,
      wholeCampBooked: !!occupancy?.wholeCamp,
      wholeCampTiers: tiers,
      wholeCampPrices: Object.fromEntries(tiers.map(tier => [tier.maxGuests, wholeCampPrice(nights,tier)])),
    }
  } finally {
    connection.release()
  }
}

export async function reserve(body) {
  await purgeUnpaidBookings()
  const { arrival, departure, adults, children, seniors, items, requestKey } = body
  const guest = typeof body.guest === 'string' ? body.guest.trim() : ''
  const phone = phoneNumber(body.phone)
  const paymentToken = body.paymentToken
  if (typeof paymentToken !== 'string' || !/^[a-f0-9]{64}$/.test(paymentToken)) {
    throw new CampError('รหัสชำระเงินไม่ถูกต้อง')
  }
  if (!guest || guest.length > 120 || !/^\+?\d{8,15}$/.test(phone)) throw new CampError('กรอกชื่อและเบอร์โทรให้ถูกต้อง')
  if (![adults, children, seniors].every(value => integer(value, 0, 100))) throw new CampError('จำนวนผู้เข้าพักไม่ถูกต้อง')
  if (!Array.isArray(items) || !items.length || items.length > 40 ||
      !items.every(item => item && typeof item.code === 'string' && codePattern.test(item.code) && integer(item.quantity, 1, 100) &&
        (item.guests === undefined || (item.guests && ['adults','seniors','children'].every(key => integer(item.guests[key], 0, 100)))))) {
    throw new CampError('เลือกลาน ห้องพัก หรืออุปกรณ์อย่างน้อยหนึ่งรายการ')
  }
  if (typeof requestKey !== 'string' || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/.test(requestKey)) {
    throw new CampError('รหัสคำขอไม่ถูกต้อง')
  }
  // Room items carry their own guests; they are part of the request identity.
  const ordered = items.map(({ code, quantity, guests }) => guests
    ? { code, quantity, guests:{ adults:guests.adults, seniors:guests.seniors, children:guests.children } } : { code, quantity }).sort((a, b) => a.code < b.code ? -1 : 1)
  if (new Set(ordered.map(item => item.code)).size !== ordered.length) throw new CampError('พบรายการซ้ำ')
  const wholeCamp = ordered.some(item => item.code === wholeCampCode)
  const guestCount = adults + children + seniors
  const rentals = body.rentalLines ?? []
  if (!Array.isArray(rentals) || rentals.length > 1600 || !rentals.every(line =>
    line && typeof line.host === 'string' && codePattern.test(line.host) &&
    typeof line.code === 'string' && codePattern.test(line.code) && integer(line.quantity, 1, 100))) {
    throw new CampError('ข้อมูลอุปกรณ์ประจำล็อกไม่ถูกต้อง')
  }
  const rentalLines = rentals.map(({ host, code, quantity }) => ({ host, code, quantity }))
    .sort((a, b) => a.host.localeCompare(b.host) || a.code.localeCompare(b.code))
  if (new Set(rentalLines.map(line => line.host + ':' + line.code)).size !== rentalLines.length) {
    throw new CampError('พบอุปกรณ์ซ้ำในล็อกเดียวกัน')
  }
  const identity = [arrival, departure, adults, children, seniors, ordered, guest, phone]
  if (rentalLines.length) identity.push(rentalLines)
  identity.push(paymentToken)
  const hash = createHash('sha256').update(JSON.stringify(identity)).digest('hex')
  const existing = async connection => {
    const [[booking]] = await connection.execute('SELECT id, total, status, request_hash FROM bookings WHERE request_key = ?', [requestKey])
    if (!booking) return null
    if (booking.request_hash !== hash) throw new CampError('คำขอนี้ถูกใช้แล้ว กรุณาเริ่มรายการใหม่', 409)
    return { id: booking.id, total: booking.total, status: booking.status }
  }

  try {
    return await transaction(async connection => {
      const previous = await existing(connection)
      if (previous) return previous
      const guard = await lockPhoneGuard(connection,phone)
      if (guard.blocked_at) throw new CampError('เบอร์โทรนี้ถูกระงับการจองจากการส่งสลิปซ้ำ กรุณาติดต่อแคมป์เพื่อปลดล็อก',403)
      const nights = dates(arrival, departure)
      const settings = await lockStaySettings(connection, wholeCamp)
      const tiers = wholeCamp ? wholeCampTiers(settings.whole_camp_rates) : null
      // Whole-camp tiers count adults only; children and seniors stay free.
      const tier = wholeCamp ? wholeCampTier(adults,tiers) : null
      if (wholeCamp && !tier) throw new CampError(`เหมาลานได้สำหรับผู้ใหญ่ 1–${tiers.at(-1).maxGuests} คน`)
      // Everyone counts towards the largest group, children and seniors included.
      if (wholeCamp && adults + children + seniors > tiers.at(-1).maxGuests) throw new CampError(`เหมาลานได้สำหรับผู้เข้าพัก 1–${tiers.at(-1).maxGuests} คน`)
      const rows = []
      for (const item of ordered) {
        const [[row]] = await connection.execute('SELECT * FROM inventory WHERE code = ? FOR UPDATE', [item.code])
        if (row) rows.push({ ...row, quantity: item.quantity, ...(item.guests && row.kind === 'room' ? { guests:item.guests } : {}) })
      }

      const retry = await existing(connection)
      if (retry) return retry
      if (rows.length !== ordered.length || rows.some(row =>
        (!row.active && row.code !== wholeCampCode) || (row.kind !== 'gear' && row.quantity !== 1))) {
        throw new CampError('รายการที่เลือกเปิดให้จองไม่ครบแล้ว', 409)
      }
      if (wholeCamp && rows.some(row => row.code !== wholeCampCode && row.kind !== 'gear')) {
        throw new CampError('การเหมาลานเลือกอุปกรณ์เช่าเพิ่มได้')
      }
      // Every room states who stays in it: at least one adult or senior, and no more of them than the room takes.
      const rooms = rows.filter(row => row.kind === 'room')
      for (const room of rooms) {
        const paying = room.guests ? room.guests.adults + room.guests.seniors : 0
        if (!paying) throw new CampError('กรุณาระบุจำนวนผู้เข้าพักของห้องพัก')
        // Children count towards the room's limit too.
        if (paying + room.guests.children > room.room_max_guests) throw new CampError(`${room.name} รับผู้เข้าพักได้สูงสุด ${room.room_max_guests} คน`)
      }
      if (['adults','seniors','children'].some(key => rooms.reduce((sum, room) => sum + room.guests[key], 0) > { adults, seniors, children }[key])) {
        throw new CampError('จำนวนผู้เข้าพักไม่ถูกต้อง')
      }
      // A plot needs an adult or a senior of its own; children alone cannot book one.
      if (!wholeCamp && rows.some(row => row.kind === 'plot') &&
          adults + seniors - rooms.reduce((sum, room) => sum + room.guests.adults + room.guests.seniors, 0) < 1) {
        throw new CampError('การจองล็อกต้องมีผู้ใหญ่หรือผู้สูงอายุอย่างน้อย 1 คน')
      }
      const inventory = new Map(rows.map(row => [row.code, row]))
      const attachedRooms = new Set(rentalLines.filter(line => inventory.get(line.code)?.kind === 'room').map(line => line.code))
      const assigned = new Map()
      for (const { host, code, quantity } of rentalLines) {
        const owner = inventory.get(host)
        const rental = inventory.get(code)
        if (!owner || owner.kind === 'gear' || attachedRooms.has(host) || !rental || rental.kind === 'plot') {
          throw new CampError('อุปกรณ์ต้องอยู่ในล็อกหรือห้องพักที่เลือก')
        }
        const assignedQuantity = (assigned.get(code) || 0) + quantity
        if (assignedQuantity > rental.quantity) throw new CampError('จำนวนอุปกรณ์ประจำล็อกเกินยอดจอง')
        // A plot may hold several tents (and several of the same model); stock is checked per night below.
        assigned.set(code, assignedQuantity)
      }
      if (rows.some(row => row.kind === 'gear' && isRentalStay(row) && row.quantity > (assigned.get(row.code) || 0)) &&
          rows.filter(isRentalStay).reduce((sum, row) => sum + row.quantity - (assigned.get(row.code) || 0), 0) > 1) {
        throw new CampError('ระบุล็อกสำหรับเต็นท์หรือบ้านพักที่เช่าเพิ่ม')
      }
      if (rows.some(row => row.kind !== 'gear') && adults + children + seniors < 1) {
        throw new CampError('ระบุจำนวนผู้เข้าพักอย่างน้อย 1 คน')
      }

      const rates = nightlyRates(nights, settings, await openCalendar(connection, nights))
      await assertStayAvailable(connection, arrival, departure, wholeCamp)
      await assertStock(connection,rows,arrival,departure)

      const { total, discount, plotAmounts, roomAmounts } = stayPricing(rows, settings, adults, rates, tier ? wholeCampPrice(nights, tier) : null, seniors)
      if (body.expectedTotal !== total) throw new CampError('ราคาเปลี่ยน กรุณาตรวจสอบยอดรวมแล้วส่งคำขออีกครั้ง', 409)
      if (tier && (body.expectedWholeCampFreeUnits ?? wholeCampTier(adults)?.freeUnits) !== tier.freeUnits) {
        throw new CampError('สิทธิ์ไฟฟรีเปลี่ยน กรุณาตรวจสอบรายละเอียดแล้วส่งคำขออีกครั้ง', 409)
      }
      const id = randomBytes(10).toString('hex').toUpperCase()
      await connection.execute(
        `INSERT INTO bookings (id,request_key,request_hash,guest,phone,arrival,departure,adults,children,seniors,total,tent_discount,whole_camp_free_units)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, requestKey, hash, guest, phone, arrival, departure, adults, children, seniors, total, discount, tier?.freeUnits ?? null])
      await connection.execute(
        `INSERT INTO booking_payments (booking,token_hash,expires_at,submitted_at)
         VALUES (?,?,UTC_TIMESTAMP() + INTERVAL 5 MINUTE,IF(?=0,UTC_TIMESTAMP(),NULL))`,
        [id,createHash('sha256').update(paymentToken).digest('hex'),total],
      )
      await connection.query('INSERT INTO booking_lines (booking,code,name,quantity,amount,room_adults,room_seniors,room_children) VALUES ?', [rows.map(row =>
        [id, row.code, row.name, row.quantity,
          plotAmounts.get(row.code) ?? roomAmounts.get(row.code) ?? row.price * row.quantity * nights.length,
          row.guests?.adults ?? null, row.guests?.seniors ?? null, row.guests?.children ?? null])])
      if (rentalLines.length) {
        await connection.query('INSERT INTO booking_rentals (booking,host,code,quantity) VALUES ?',
          [rentalLines.map(line => [id, line.host, line.code, line.quantity])])
      }
      await connection.query('INSERT INTO allocations (code,night,booking,quantity) VALUES ?', [
        rows.flatMap(row => nights.map(night => [row.code, night, id, row.quantity])),
      ])
      const firstHost=items.find(item=>inventory.get(item.code)?.kind!=='gear'&&!attachedRooms.has(item.code))
      // A whole-camp (private camp) booking is not tied to one plot, so its reference ends in PV instead of a plot code.
      // Trunkbox rooms end in TB and the room number: TRUNKBOX → TB1, TRUNKBOX2 → TB2.
      const hostCode=firstHost?.code||rows[0].code
      const referenceCode=wholeCamp?'PV':inventory.get(hostCode)?.kind==='room'?'TB'+(Number(hostCode.match(/\d+$/)?.[0])||1):hostCode
      const reference=await assignReference(connection,id,arrival,referenceCode)
      return { id, reference, total, status: 'pending' }
    })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      const retry = await existing(database())
      if (retry) return retry
    }
    if (['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) throw new CampError('ระบบกำลังประมวลผล กรุณาลองส่งคำขอเดิมอีกครั้ง', 503)
    throw error
  }
}

export function bookingIdentity(id, phone) {
  if (typeof id !== 'string' || !/^[A-Fa-f0-9]{20}$/.test(id) || !/^\+?\d{8,15}$/.test(phone)) throw new CampError('กรอกรหัสจองและเบอร์โทรให้ถูกต้อง')
  return [id.toUpperCase(),phone]
}

export async function lookup(id, phone) {
  if(typeof id==='string' && /^[A-Z0-9-]{7,64}$/i.test(id)){
    const [[reference]]=await database().execute('SELECT r.booking FROM booking_references r JOIN bookings b ON b.id=r.booking WHERE r.reference=? AND b.phone=?',[id.toUpperCase(),phone])
    if(reference)id=reference.booking
  }
  const identity = bookingIdentity(id,phone)
  const [[booking]] = await database().execute(
    `SELECT b.id,(SELECT reference FROM booking_references WHERE booking=b.id) AS reference,b.guest,b.phone,b.created_at,b.arrival,b.departure,b.adults,b.children,b.seniors,b.total,b.tent_discount,b.reschedule_count,
       ${effectiveStatus} AS status,(c.completed_at IS NOT NULL) AS checked_out,
       (p.booking IS NOT NULL) AS payment_required,(p.submitted_at IS NOT NULL) AS payment_submitted
     FROM bookings b LEFT JOIN booking_payments p ON p.booking=b.id LEFT JOIN booking_checkouts c ON c.booking=b.id
     WHERE b.id = ? AND b.phone = ?`, identity)
  if (!booking) throw new CampError('ไม่พบรายการจอง', 404)
  const [lines] = await database().execute(
    `SELECT l.code,l.name,l.quantity,l.amount,l.room_adults,l.room_seniors,l.room_children,i.kind,i.zone,m.x AS map_x,m.y AS map_y,m.shape_json AS map_shape
     FROM booking_lines l JOIN inventory i ON i.code=l.code LEFT JOIN plot_map_positions m ON m.code=l.code
     WHERE l.booking=? ORDER BY ${itemOrder}`,[booking.id])
  const [rentalLines] = await database().execute(
    `SELECT r.host AS host_code,r.code,host.name AS host,rental.name,r.quantity FROM booking_rentals r
     JOIN booking_lines host ON host.booking = r.booking AND host.code = r.host
     JOIN booking_lines rental ON rental.booking = r.booking AND rental.code = r.code
     WHERE r.booking = ? ORDER BY r.host, r.code`, [booking.id])
  const [[map]] = await database().query('SELECT revision FROM plot_map_background WHERE id=1')
  const published = await publishedMap()
  const date = today()
  const [history] = await database().execute('SELECT revision,before_state,after_state,created_at FROM booking_reschedule_history WHERE booking=? ORDER BY revision DESC',[booking.id])
  const [[policy]]=await database().query('SELECT reschedule_notice_days,reschedule_limit FROM settings WHERE id=1')
  const notice=policy.reschedule_notice_days??rescheduleNotice
  const limit=policy.reschedule_limit??rescheduleLimit
  const blackout=await rescheduleBlackout(database(),booking.arrival,booking.departure)
  return { ...booking, lines:applyMap(lines,published), rentalLines, history, map_version:published ? (published.mime ? published.revision : null) : map?.revision, today:date, reschedule_limit:limit, reschedule_notice_days:notice, reschedule_block:rescheduleReason(booking,date,notice,limit) || (blackout ? blackoutReason(blackout) : '') }
}

