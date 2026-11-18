import { database } from '../../lib/db'
import { purgeUnpaidBookings } from '../../lib/booking-cleanup'
import { effectiveStatus } from '../../lib/payment-rules'
import { isCalendarDate, shiftDate, stayNights } from '../../lib/booking-dates'
import { wholeCampCode } from '../../lib/whole-camp'

export function dashboardFilters(query, current) {
  const from = isCalendarDate(query.from) ? query.from : ''
  const to = isCalendarDate(query.to) ? query.to : ''
  const day = isCalendarDate(query.day) ? query.day : from || current
  const mode = ['month','week','day'].includes(query.mode) ? query.mode : 'week'
  const start = mode === 'month' ? day.slice(0,7)+'-01' : day
  const length = mode === 'month' ? new Date(Date.UTC(+day.slice(0,4),+day.slice(5,7),0)).getUTCDate() : mode === 'week' ? 7 : 1
  return {from,to,day,mode,start,length,error:from && from > (to || current) ? 'วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด (หากเว้นว่างจะใช้วันนี้)' : ''}
}

// Years of bookings pile up, and by default the dashboard sums all of them. Three rules keep that quick:
// totals of bookings alone are read from the (status, arrival) index, child rows are added up per item code before
// they meet the inventory, and where child rows need their booking the smaller side is the one looked up.
export async function dashboardData(filters, current) {
  await purgeUnpaidBookings()
  const db = database()
  const [[first]] = await db.query('SELECT MIN(arrival) AS first FROM bookings')
  const to = filters.to || current
  const from = filters.from || (first.first && first.first < to ? first.first : to)
  const start = filters.start, end = shiftDate(start,filters.length-1)
  const range = [from,to]
  const joins = 'FROM bookings b LEFT JOIN booking_payments p ON p.booking=b.id'
  const [[closures],[[confirmed]],[[everConfirmed]]] = await Promise.all([
    db.execute("SELECT start_date,end_date,label FROM camp_calendar WHERE kind='closed' AND start_date<=? AND end_date>=?",[to > end ? to : end,from < start ? from : start]),
    db.execute("SELECT COUNT(*) AS total,COALESCE(SUM(b.tent_discount),0) AS discount FROM bookings b WHERE b.status='confirmed' AND b.arrival BETWEEN ? AND ?",range),
    db.query("SELECT COUNT(*) AS total FROM bookings WHERE status='confirmed'"),
  ])
  // Nights the camp was closed, as separate date ranges inside the period: usage leaves them out.
  const merged=[]
  for(const interval of closures.map(c=>[c.start_date > from ? c.start_date : from,c.end_date < to ? c.end_date : to]).filter(([a,b])=>a<=b).sort((a,b)=>a[0].localeCompare(b[0]))) {
    const last=merged.at(-1)
    if(last && interval[0]<=last[1]) last[1]=last[1]>interval[1]?last[1]:interval[1]
    else merged.push([...interval])
  }
  const open = merged.length ? ' AND NOT (' + merged.map(()=>'a.night BETWEEN ? AND ?').join(' OR ') + ')' : '', closedNights = merged.flat()
  // Expand a whole-camp allocation to physical lodging units, never count the virtual SKU.
  const units = `JOIN inventory i ON (i.code=u.code OR (u.code='${wholeCampCode}' AND i.kind IN ('plot','room')))
    WHERE i.code<>'${wholeCampCode}' AND i.active=TRUE`
  // Most confirmed bookings fall inside the period (the usual case: no dates chosen): add up every child row and take
  // away those of the few bookings left out. Otherwise read the children of the bookings inside it.
  const wide = Number(confirmed.total) * 2 > Number(everConfirmed.total)
  const leftOut = `(SELECT id FROM bookings WHERE status<>'confirmed' UNION ALL SELECT id FROM bookings WHERE status='confirmed' AND arrival<?
    UNION ALL SELECT id FROM bookings WHERE status='confirmed' AND arrival>?) x`
  const inside = "WHERE b.status='confirmed' AND b.arrival BETWEEN ? AND ?"
  const lineTotals = wide
    ? `SELECT code,SUM(amount) AS amount,COUNT(*) AS n FROM booking_lines GROUP BY code
       UNION ALL SELECT l.code,-SUM(l.amount),-COUNT(*) FROM ${leftOut} STRAIGHT_JOIN booking_lines l ON l.booking=x.id GROUP BY l.code`
    : `SELECT l.code,SUM(l.amount) AS amount,COUNT(*) AS n FROM bookings b STRAIGHT_JOIN booking_lines l ON l.booking=b.id ${inside} GROUP BY l.code`
  const charges = sign => [['electricity_amount','electricity'],['damage_amount+c.other_amount','other'],['guest_amount','guest'],['discount_amount','discount']]
    .map(([column,name]) => `${sign}COALESCE(SUM(c.${column}),0) AS ${name}`).join(',')
  const checkoutTotals = wide
    ? `SELECT ${charges('')} FROM booking_checkouts c WHERE c.completed_at IS NOT NULL
       UNION ALL SELECT ${charges('-')} FROM ${leftOut} STRAIGHT_JOIN booking_checkouts c ON c.booking=x.id WHERE c.completed_at IS NOT NULL`
    : `SELECT ${charges('')} FROM bookings b STRAIGHT_JOIN booking_checkouts c ON c.booking=b.id ${inside} AND c.completed_at IS NOT NULL`
  const trendFrom = from > shiftDate(to,-29) ? from : shiftDate(to,-29)
  const [[pending],[recent],[inventory],[calendar],[usage],[trend],[revenue],[extras],[reports],[todayRows]] = await Promise.all([
    db.execute(`SELECT COUNT(*) AS total ${joins} WHERE b.status='pending' AND b.arrival BETWEEN ? AND ? AND (${effectiveStatus})='pending'`,range),
    db.execute(`SELECT b.id,b.guest,b.arrival,b.departure,b.total,${effectiveStatus} AS status,
      (SELECT GROUP_CONCAT(l.name ORDER BY l.code SEPARATOR ', ') FROM booking_lines l JOIN inventory i ON i.code=l.code WHERE l.booking=b.id AND i.kind<>'gear') AS lodging
      ${joins} WHERE b.arrival BETWEEN ? AND ? AND (${effectiveStatus})<>'cancelled' ORDER BY b.created_at DESC,b.id DESC LIMIT 6`,range),
    db.query(`SELECT code,name,kind,zone,stock,active,is_tent FROM inventory WHERE kind IN ('plot','room') AND code<>'${wholeCampCode}' ORDER BY zone,code`),
    db.execute(`SELECT i.code,a.night,CASE WHEN a.code='${wholeCampCode}' THEN i.stock ELSE a.quantity END AS quantity,b.id,b.guest,b.arrival,b.departure,${effectiveStatus} AS status,c.completed_at
      FROM allocations a JOIN bookings b ON b.id=a.booking LEFT JOIN booking_payments p ON p.booking=b.id
      LEFT JOIN booking_checkouts c ON c.booking=b.id
      JOIN inventory i ON (i.code=a.code OR (a.code='${wholeCampCode}' AND i.kind IN ('plot','room')))
      WHERE i.kind IN ('plot','room') AND i.code<>'${wholeCampCode}' AND a.night BETWEEN ? AND ? AND (${effectiveStatus})<>'cancelled'
      ORDER BY a.night,b.id`,[start,end]),
    // Unit-nights used by confirmed bookings: every allocation in the period, less those of bookings not confirmed.
    db.execute(`SELECT i.kind,i.zone,i.is_tent,i.code,i.name,SUM(CASE WHEN u.code='${wholeCampCode}' THEN i.stock*u.nights ELSE u.used END) AS used
      FROM (SELECT t.code,SUM(t.used) AS used,SUM(t.nights) AS nights FROM (
        SELECT a.code,SUM(a.quantity) AS used,COUNT(*) AS nights FROM allocations a WHERE a.night BETWEEN ? AND ?${open} GROUP BY a.code
        UNION ALL SELECT a.code,-SUM(a.quantity),-COUNT(*) FROM bookings b STRAIGHT_JOIN allocations a ON a.booking=b.id
          WHERE b.status<>'confirmed' AND a.night BETWEEN ? AND ?${open} GROUP BY a.code) t GROUP BY t.code) u
      ${units} GROUP BY i.kind,i.zone,i.is_tent,i.code,i.name HAVING used>0`,[...range,...closedNights,...range,...closedNights]),
    db.execute(`SELECT u.night,SUM(CASE WHEN u.code='${wholeCampCode}' THEN i.stock ELSE u.quantity END) AS used
      FROM (SELECT a.night,a.code,a.quantity FROM allocations a JOIN bookings b ON b.id=a.booking
        WHERE b.status='confirmed' AND a.night BETWEEN ? AND ?${open}) u
      ${units} AND i.kind IN ('plot','room') GROUP BY u.night`,[trendFrom,to,...closedNights]),
    db.execute(`SELECT i.kind,i.is_tent,COALESCE(SUM(t.amount),0) AS amount FROM (SELECT code,SUM(amount) AS amount FROM (${lineTotals}) parts GROUP BY code HAVING SUM(n)>0) t
      JOIN inventory i ON i.code=t.code GROUP BY i.kind,i.is_tent`,range),
    db.execute(`SELECT COALESCE(SUM(electricity),0) AS electricity,COALESCE(SUM(other),0) AS other,COALESCE(SUM(guest),0) AS guest,COALESCE(SUM(discount),0) AS discount FROM (${checkoutTotals}) parts`,range),
    db.execute(`SELECT b.arrival AS day,COUNT(*) AS bookings,SUM(b.total) AS amount FROM bookings b
      WHERE b.status='confirmed' AND b.arrival BETWEEN ? AND ? GROUP BY b.arrival ORDER BY b.arrival DESC`,range),
    db.execute(`SELECT
      (SELECT COUNT(*) FROM bookings b WHERE b.status='confirmed' AND b.arrival=?) AS arrivals,
      (SELECT COUNT(*) FROM bookings b LEFT JOIN booking_checkouts c ON c.booking=b.id WHERE b.status='confirmed' AND b.departure=? AND c.completed_at IS NULL) AS departures,
      (SELECT COALESCE(SUM(b.adults+b.children+b.seniors),0) FROM bookings b WHERE b.status='confirmed' AND b.arrival=?) AS guests`,[current,current,current]),
  ])
  const stats = {total:Number(confirmed.total)+Number(pending[0].total),confirmed:Number(confirmed.total),pending:Number(pending[0].total),discount:confirmed.discount}
  const capacity = inventory.filter(i=>i.active).reduce((sum,i)=>sum+Number(i.stock),0)
  const openNights=Math.max(0,stayNights(from,to)+1-merged.reduce((sum,[a,b])=>sum+stayNights(a,b)+1,0))
  const used=usage.filter(i=>i.kind!=='gear').reduce((sum,i)=>sum+Number(i.used),0)
  return {from,to,stats,recent,inventory,calendar,closures,usage,trend,revenue,extras:extras[0],reports,today:todayRows[0],capacity,openNights,used,
    occupancy:capacity*openNights ? used/(capacity*openNights)*100 : 0}
}
