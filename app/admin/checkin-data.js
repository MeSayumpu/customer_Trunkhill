import { database } from '../../lib/db'
import { today } from '../../lib/camp'
import { shiftDate } from '../../lib/booking-dates'
import { liveAllocation } from '../../lib/payment-rules'
import { itemOrder } from '../../lib/rentals'

export const checkinPageSize = 30
export const checkinStatuses = { open:'รอ Check-in', done:'Check-in แล้ว', all:'ทุกสถานะ' }
export const checkinNoteMax = 500
export const checkinGuestMax = 500
export const checkinItemMax = 99
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const cursorPattern = /^\d{4}-\d{2}-\d{2}\|[A-F0-9]{20}$/

function dateFilter(value) {
  if (typeof value !== 'string' || !datePattern.test(value) || value < '1000-01-01') return ''
  const parsed = new Date(value)
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0,10) === value ? value : ''
}

export function checkinFilters(query) {
  return {
    from:dateFilter(query.from),
    to:dateFilter(query.to),
    q:typeof query.q === 'string' ? query.q.trim().slice(0,120) : '',
    status:typeof query.status === 'string' && Object.hasOwn(checkinStatuses,query.status) ? query.status : 'open',
  }
}

export function checkinPosition(query) {
  if (typeof query.before === 'string' && cursorPattern.test(query.before)) return { before:query.before }
  if (typeof query.after === 'string' && cursorPattern.test(query.after)) return { after:query.after }
  return {}
}

export const checkinCursor = row => row.arrival + '|' + row.id
const columns = `b.id,(SELECT reference FROM booking_references WHERE booking=b.id) AS reference,b.arrival,b.departure,b.guest,b.phone,
  b.total,b.adults,b.children,b.seniors,ci.checked_in_at,ci.added_amount,ci.note AS checkin_note,
  ci.booked_adults,ci.booked_children,ci.booked_seniors,
  EXISTS (SELECT 1 FROM booking_checkouts c WHERE c.booking=b.id AND c.completed_at IS NOT NULL) AS checked_out`
const joins = 'FROM bookings b LEFT JOIN booking_checkins ci ON ci.booking=b.id'

// Confirmed bookings, soonest arrival first. "Waiting" leaves out stays that already ended without anyone arriving.
export async function checkinRows(filters, position = {}) {
  const clauses = ["b.status='confirmed'"]
  const params = []
  if (filters.status === 'open') {
    clauses.push('ci.booking IS NULL AND b.departure >= ? AND NOT EXISTS (SELECT 1 FROM booking_checkouts c WHERE c.booking=b.id AND c.completed_at IS NOT NULL)')
    params.push(today())
  }
  if (filters.status === 'done') clauses.push('ci.booking IS NOT NULL')
  if (filters.from) { clauses.push('b.arrival >= ?'); params.push(filters.from) }
  if (filters.to) { clauses.push('b.arrival <= ?'); params.push(filters.to) }
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
    clauses.push(`(b.arrival ${operator} ? OR (b.arrival = ? AND b.id ${operator} ?))`)
    params.push(date,date,id)
  }
  const [rows] = await database().execute(
    `SELECT ${columns} ${joins} WHERE ${clauses.join(' AND ')} ORDER BY b.arrival ${direction}, b.id ${direction} LIMIT ?`,
    [...params,checkinPageSize + 1])
  return rows
}

export async function checkinDetail(id) {
  if (typeof id !== 'string' || !/^[A-F0-9]{20}$/.test(id)) return null
  const [[row]] = await database().execute(`SELECT ${columns} ${joins} WHERE b.id=? AND b.status='confirmed'`,[id])
  return row
}

export async function checkinAdded(id, connection = database()) {
  const [rows] = await connection.execute(
    'SELECT code,name,quantity,unit_price,nights,amount,created_at FROM booking_checkin_items WHERE booking=? ORDER BY id',[id])
  return rows
}

// Nights equipment added now is charged and held for: from the later of the arrival day and today, to the night before
// departure — at least the last night, so something added on the final day still costs one night.
export function checkinNights(booking, date = today()) {
  const last = shiftDate(booking.departure,-1)
  let night = booking.arrival > date ? booking.arrival : date
  if (night > last) night = last
  const nights = []
  for (; night <= last; night = shiftDate(night,1)) nights.push(night)
  return nights
}

// Rental equipment with what is still free on every one of those nights.
export async function checkinGear(nights, connection = database(), codes = null) {
  if (codes && !codes.length) return []
  const [rows] = await connection.execute(
    `SELECT i.code,i.name,i.detail,i.price,i.stock,i.is_tent,GREATEST(0,i.stock - COALESCE(a.peak,0)) AS available
     FROM inventory i LEFT JOIN (
       SELECT code,MAX(used) AS peak FROM (
         SELECT a.code,a.night,SUM(a.quantity) AS used FROM allocations a
         WHERE a.night >= ? AND a.night <= ? AND ${liveAllocation} GROUP BY a.code,a.night
       ) nightly GROUP BY code
     ) a ON a.code=i.code
     WHERE i.kind='gear' AND i.active=1 ${codes ? `AND i.code IN (${codes.map(() => '?').join(',')})` : ''}
     ORDER BY ${itemOrder}`,
    [nights[0],nights.at(-1),...(codes || [])])
  return rows.map(row => ({ ...row, available:Number(row.available) }))
}
