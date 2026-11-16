import {addMonths} from '../../lib/booking-window'
import { purgeUnpaidBookings } from '../../lib/booking-cleanup'
import { database } from '../../lib/db'
import { effectiveStatus } from '../../lib/payment-rules'
import { isCalendarDate } from '../../lib/booking-dates'
import { lodgingLine } from './booking-items'
import { itemOrder } from '../../lib/rentals'

export const bookingSorts = { newest:'ล่าสุด', oldest:'เก่าสุด', arrival:'วันเช็กอินใกล้สุด', total:'ยอดรวมมากที่สุด' }
const orders = { newest:'b.created_at DESC,b.id DESC', oldest:'b.created_at ASC,b.id ASC', arrival:'b.arrival ASC,b.id ASC', total:'b.total DESC,b.id DESC' }
export function bookingFilters(query) {
  const pending=['pending','review'].includes(query.status)
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'}).format(new Date())
  const defaults=query.from===undefined&&query.to===undefined&&!pending
  return {
    q:typeof query.q === 'string' ? query.q.trim().slice(0,120) : '',
    status:['pending','review','confirmed','cancelled'].includes(query.status) ? query.status : '',
    from:pending?'':isCalendarDate(query.from)?query.from:defaults?today:'', to:pending?'':isCalendarDate(query.to)?query.to:defaults?addMonths(today,3):'',
    // Day the booking was made (= when the customer was shown the QR to transfer), in Thai time.
    madeFrom:isCalendarDate(query.madeFrom)?query.madeFrom:'', madeTo:isCalendarDate(query.madeTo)?query.madeTo:'',
    kind:['lodging','rental'].includes(query.kind) ? query.kind : '',
    sort:Object.hasOwn(orders,query.sort) ? query.sort : 'newest',
    size:[10,20,50,100].includes(Number(query.size)) ? Number(query.size) : 20,
  }
}
const joins='FROM bookings b LEFT JOIN booking_payments p ON p.booking=b.id LEFT JOIN booking_references br ON br.booking=b.id'
function where(filters) {
  const clauses=[],values=[]
  const {q,status,from,to,kind,madeFrom,madeTo}=filters
  if(q) {
    const escaped=q.replace(/[!%_]/g,'!$&')+'%'
    const phone=q.replace(/[ ()-]/g,'')
    clauses.push("(b.guest LIKE ? ESCAPE '!' OR b.id LIKE ? ESCAPE '!' OR b.phone LIKE ? ESCAPE '!' OR br.reference LIKE ? ESCAPE '!')")
    values.push(escaped,escaped,/^\+?\d+$/.test(phone) ? phone+'%' : escaped,escaped)
  }
  if(status==='review') clauses.push(`(${effectiveStatus})='pending' AND p.submitted_at IS NOT NULL`)
  else if(status) {clauses.push(`(${effectiveStatus})=?`);values.push(status)}
  if(from) {clauses.push('b.arrival>=?');values.push(from)}
  if(to) {clauses.push('b.arrival<=?');values.push(to)}
  // created_at is stored in UTC; Thai days start 7 hours earlier.
  if(madeFrom) {clauses.push('b.created_at>=DATE_SUB(?,INTERVAL 7 HOUR)');values.push(madeFrom+' 00:00:00')}
  if(madeTo) {clauses.push('b.created_at<DATE_ADD(DATE_SUB(?,INTERVAL 7 HOUR),INTERVAL 1 DAY)');values.push(madeTo+' 00:00:00')}
  if(kind) clauses.push(`EXISTS (SELECT 1 FROM booking_lines l JOIN inventory i ON i.code=l.code WHERE l.booking=b.id AND ${kind==='rental'?'NOT ':''}${lodgingLine})`)
  return {sql:clauses.length?' WHERE '+clauses.join(' AND '):'',values}
}
export async function bookingStats(filters) {
  // Unpaid bookings past their payment window are deleted before the list is counted or shown.
  await purgeUnpaidBookings()
  const {sql,values}=where(filters)
  const [[row]]=await database().execute(`SELECT COUNT(*) AS total,
    COALESCE(SUM((${effectiveStatus})='pending' AND p.submitted_at IS NOT NULL),0) AS review,
    COALESCE(SUM((${effectiveStatus})='confirmed'),0) AS confirmed,
    COALESCE(SUM(CASE WHEN (${effectiveStatus})='confirmed' THEN b.total ELSE 0 END),0) AS revenue ${joins}${sql}`,values)
  return row
}
export async function bookingRows(filters,offset=0,limit=filters.size) {
  const {sql,values}=where(filters)
  const [rows]=await database().execute(`SELECT b.id,br.reference,b.guest,b.phone,b.arrival,b.departure,b.total,b.tent_discount,b.reschedule_count,b.created_at,
    ${effectiveStatus} AS status,p.submitted_at,p.mime AS slip_mime,(p.booking IS NOT NULL) AS payment_required,(p.slip IS NOT NULL) AS has_slip,
    EXISTS (SELECT 1 FROM booking_checkouts c WHERE c.booking=b.id AND c.completed_at IS NOT NULL) AS checked_out,
    (SELECT COUNT(*) FROM booking_lines l WHERE l.booking=b.id) AS item_count,
    (SELECT COUNT(*) FROM booking_lines l JOIN inventory i ON i.code=l.code WHERE l.booking=b.id AND ${lodgingLine}) AS lodging_count
    ${joins}${sql} ORDER BY ${orders[filters.sort]} LIMIT ? OFFSET ?`,[...values,limit,offset])
  return rows
}
export async function bookingExpansion(ids) {
  const result=new Map(ids.map(id=>[id,{items:[],history:[]}]))
  if(!ids.length) return result
  const placeholders=ids.map(()=>'?').join(',')
  const [[items],[history]]=await Promise.all([
    database().execute(`SELECT l.booking,l.code,l.name,l.quantity,l.amount,${lodgingLine} AS lodging FROM booking_lines l JOIN inventory i ON i.code=l.code WHERE l.booking IN (${placeholders}) ORDER BY ${itemOrder}`,ids),
    database().execute(`SELECT booking,revision,before_state,after_state,created_at FROM booking_reschedule_history WHERE booking IN (${placeholders}) ORDER BY revision DESC`,ids),
  ])
  for(const item of items) result.get(item.booking).items.push(item)
  for(const row of history) result.get(row.booking).history.push(row)
  return result
}
