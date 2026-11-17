import { database } from '../../lib/db'
import { defaultElectricity } from '../../lib/checkout-pricing'
import { lodgingLine } from './booking-items'
import { itemOrder } from '../../lib/rentals'
import { wholeCampCode } from '../../lib/whole-camp'

export const checkoutPageSize = 30
export const checkoutStatuses = { open:'ยังไม่ Check-out', done:'Check-out แล้ว', all:'ทุกสถานะ' }
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const cursorPattern = /^\d{4}-\d{2}-\d{2}\|[A-F0-9]{20}$/

function dateFilter(value) {
  if (typeof value !== 'string' || !datePattern.test(value) || value < '1000-01-01') return ''
  const parsed = new Date(value)
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0,10) === value ? value : ''
}

export function checkoutFilters(query) {
  return {
    from:dateFilter(query.from),
    to:dateFilter(query.to),
    plot:typeof query.plot==='string'&&/^[A-Z0-9-]{1,24}$/i.test(query.plot.trim())?query.plot.trim().toUpperCase():'',
    q:typeof query.q === 'string' ? query.q.trim().slice(0,120) : '',
    status:typeof query.status === 'string' && Object.hasOwn(checkoutStatuses,query.status) ? query.status : 'open',
  }
}

export function checkoutPosition(query) {
  if (typeof query.before === 'string' && cursorPattern.test(query.before)) return { before:query.before }
  if (typeof query.after === 'string' && cursorPattern.test(query.after)) return { after:query.after }
  return {}
}

export const checkoutCursor = row => row.departure + '|' + row.id
const checkoutColumns = `b.id,(SELECT reference FROM booking_references WHERE booking=b.id) AS reference,b.arrival,b.departure,b.guest,b.phone,b.total,
  ci.added_amount AS checkin_amount,ci.checked_in_at,ci.booked_adults,ci.booked_children,ci.booked_seniors,c.guest_amount,c.free_guests,
  c.version,c.units_milli,c.electricity_rate,c.free_units_per_guest,c.electricity_amount,c.damage_amount,c.other_amount,c.note,c.promptpay,c.completed_at`

// paying_guests: who paid the entry fee in the booking as it was made — its adults, or its seniors when no adult came
// (children are free). After check-in the booking row holds the actual guests, so the booked counts come from the check-in.
export const checkoutOccupancy = `b.adults + b.children + b.seniors AS guest_count,
  COALESCE((SELECT CASE WHEN booked.booked_adults > 0 THEN booked.booked_adults WHEN booked.booked_seniors > 0 THEN booked.booked_seniors
      ELSE booked.booked_adults + booked.booked_children + booked.booked_seniors END FROM booking_checkins booked WHERE booked.booking=b.id),
    CASE WHEN b.adults > 0 THEN b.adults WHEN b.seniors > 0 THEN b.seniors ELSE b.adults + b.children + b.seniors END) AS paying_guests,
  b.whole_camp_free_units,
  EXISTS (SELECT 1 FROM booking_lines l WHERE l.booking=b.id AND l.code='${wholeCampCode}') AS whole_camp,
  (SELECT COALESCE(SUM(l.quantity),0) FROM booking_lines l JOIN inventory i ON i.code=l.code
   WHERE l.booking=b.id AND i.kind='plot') AS plot_count`

export async function checkoutSettings(connection = database()) {
  const [[settings]] = await connection.query('SELECT electricity_rate,free_units_per_guest,promptpay FROM checkout_settings WHERE id=1')
  return settings || { ...defaultElectricity, promptpay:null }
}

export async function checkoutRows(filters, position = {}) {
  // Only stays that have checked in (older check-outs finished before check-in existed stay listed).
  const clauses = ["b.status='confirmed'",'(ci.booking IS NOT NULL OR c.completed_at IS NOT NULL)']
  const params = []
  if (filters.status !== 'all') clauses.push(filters.status === 'done' ? 'c.completed_at IS NOT NULL' : 'c.completed_at IS NULL')
  if (filters.from) {
    clauses.push('b.arrival >= ?')
    params.push(filters.from)
  }
  if (filters.to) {
    clauses.push('b.arrival <= ?')
    params.push(filters.to)
  }
  if(filters.plot){clauses.push('EXISTS(SELECT 1 FROM booking_lines pl WHERE pl.booking=b.id AND pl.code=?)');params.push(filters.plot)}
  if (filters.q) {
    const search = value => '%' + value.replace(/[!%_]/g,'!$&') + '%'
    const phone = filters.q.replace(/[ ()-]/g,'')
    clauses.push("(b.guest LIKE ? ESCAPE '!' OR b.phone LIKE ? ESCAPE '!' OR b.id = ? OR EXISTS(SELECT 1 FROM booking_references r WHERE r.booking=b.id AND r.reference=?))")
    params.push(search(filters.q),search(phone || filters.q),filters.q.toUpperCase(),filters.q.toUpperCase())
  }
  const direction = position.before ? 'DESC' : 'ASC'
  const value = position.before || position.after
  if (value) {
    const [date,id] = value.split('|')
    const operator = position.before ? '<' : '>'
    clauses.push(`(b.departure ${operator} ? OR (b.departure = ? AND b.id ${operator} ?))`)
    params.push(date,date,id)
  }
  const [rows] = await database().execute(
    `SELECT ${checkoutColumns}
     FROM bookings b LEFT JOIN booking_checkouts c ON c.booking=b.id LEFT JOIN booking_checkins ci ON ci.booking=b.id
     WHERE ${clauses.join(' AND ')} ORDER BY b.departure ${direction}, b.id ${direction} LIMIT ?`,[...params,checkoutPageSize+1])
  return rows
}

export async function checkoutDetail(id) {
  if (typeof id !== 'string' || !/^[A-F0-9]{20}$/.test(id)) return null
  const [[row]] = await database().execute(
    `SELECT ${checkoutColumns},c.lodging_charges,b.adults,b.children,b.seniors,b.tent_discount,${checkoutOccupancy}
     FROM bookings b LEFT JOIN booking_checkouts c ON c.booking=b.id LEFT JOIN booking_checkins ci ON ci.booking=b.id
     WHERE b.id=? AND b.status='confirmed' AND (ci.booking IS NOT NULL OR c.completed_at IS NOT NULL)`,[id])
  return row
}

export async function checkoutLodgingCodes(connection, id) {
  const [rows] = await connection.execute(
    `SELECT l.code FROM booking_lines l JOIN inventory i ON i.code=l.code
     WHERE l.booking=? AND ${lodgingLine} ORDER BY l.code`,[id])
  return rows.map(row => row.code)
}

export async function checkoutSummaries(rows) {
  if (!rows.length) return new Map()
  const ids = rows.map(row => row.id)
  const [items] = await database().execute(
    `SELECT l.booking,l.name,l.quantity,${lodgingLine} AS lodging
     FROM booking_lines l JOIN inventory i ON i.code=l.code
     WHERE l.booking IN (${ids.map(() => '?').join(',')}) ORDER BY ${itemOrder}`,ids)
  const byBooking = new Map(rows.map(row => [row.id,{ lodging:[], rentals:[] }]))
  for (const item of items) {
    byBooking.get(item.booking)[item.lodging ? 'lodging' : 'rentals'].push(
      item.quantity > 1 ? item.name + ' × ' + item.quantity : item.name)
  }
  return byBooking
}
