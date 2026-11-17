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

export async function dashboardData(filters, current) {
  await purgeUnpaidBookings()
  const db = database()
  const [[first]] = await db.query('SELECT MIN(arrival) AS first FROM bookings')
  const to = filters.to || current
  const from = filters.from || (first.first && first.first < to ? first.first : to)
  const start = filters.start, end = shiftDate(start,filters.length-1)
  const range = [from,to]
  const joins = 'FROM bookings b LEFT JOIN booking_payments p ON p.booking=b.id'
  // Expand a whole-camp allocation to physical lodging units, never count the virtual SKU.
  const allocationJoin = `FROM allocations a JOIN bookings b ON b.id=a.booking
    LEFT JOIN booking_payments p ON p.booking=b.id
    JOIN inventory i ON (i.code=a.code OR (a.code='${wholeCampCode}' AND i.kind IN ('plot','room')))
    WHERE i.code<>'${wholeCampCode}' AND i.active=TRUE`
  const [[stats],[recent],[inventory],[calendar],[closures],[usage],[trend],[revenue],[extras],[reports],[todayRows]] = await Promise.all([
    db.execute(`SELECT COUNT(*) AS total, COALESCE(SUM((${effectiveStatus})='confirmed'),0) AS confirmed,
      COALESCE(SUM((${effectiveStatus})='pending'),0) AS pending,
      COALESCE(SUM(CASE WHEN b.status='confirmed' THEN b.tent_discount ELSE 0 END),0) AS discount
      ${joins} WHERE b.arrival BETWEEN ? AND ? AND (${effectiveStatus})<>'cancelled'`,range),
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
    db.execute("SELECT start_date,end_date,label FROM camp_calendar WHERE kind='closed' AND start_date<=? AND end_date>=?",[to > end ? to : end,from < start ? from : start]),
    db.execute(`SELECT i.kind,i.zone,i.is_tent,i.code,i.name,SUM(CASE WHEN a.code='${wholeCampCode}' THEN i.stock ELSE a.quantity END) AS used
      ${allocationJoin} AND b.status='confirmed' AND a.night BETWEEN ? AND ?
      AND NOT EXISTS (SELECT 1 FROM camp_calendar cc WHERE cc.kind='closed' AND a.night BETWEEN cc.start_date AND cc.end_date)
      GROUP BY i.kind,i.zone,i.is_tent,i.code,i.name`,range),
    db.execute(`SELECT a.night,SUM(CASE WHEN a.code='${wholeCampCode}' THEN i.stock ELSE a.quantity END) AS used
      ${allocationJoin} AND i.kind IN ('plot','room') AND b.status='confirmed' AND a.night BETWEEN ? AND ?
      AND NOT EXISTS (SELECT 1 FROM camp_calendar cc WHERE cc.kind='closed' AND a.night BETWEEN cc.start_date AND cc.end_date)
      GROUP BY a.night`,[from > shiftDate(to,-29) ? from : shiftDate(to,-29),to]),
    db.execute(`SELECT i.kind,i.is_tent,COALESCE(SUM(l.amount),0) AS amount FROM booking_lines l JOIN inventory i ON i.code=l.code
      JOIN bookings b ON b.id=l.booking WHERE b.status='confirmed' AND b.arrival BETWEEN ? AND ? GROUP BY i.kind,i.is_tent`,range),
    db.execute(`SELECT COALESCE(SUM(c.electricity_amount),0) AS electricity,COALESCE(SUM(c.damage_amount+c.other_amount),0) AS other,
      COALESCE(SUM(c.guest_amount),0) AS guest,COALESCE(SUM(c.discount_amount),0) AS discount
      FROM booking_checkouts c JOIN bookings b ON b.id=c.booking WHERE b.status='confirmed' AND c.completed_at IS NOT NULL AND b.arrival BETWEEN ? AND ?`,range),
    db.execute(`SELECT b.arrival AS day,COUNT(*) AS bookings,SUM(b.total) AS amount FROM bookings b
      WHERE b.status='confirmed' AND b.arrival BETWEEN ? AND ? GROUP BY b.arrival ORDER BY b.arrival DESC`,range),
    db.execute(`SELECT
      COALESCE(SUM(b.arrival=?),0) AS arrivals, COALESCE(SUM(b.departure=? AND c.completed_at IS NULL),0) AS departures,
      COALESCE(SUM(CASE WHEN b.arrival=? THEN b.adults+b.children+b.seniors ELSE 0 END),0) AS guests
      FROM bookings b LEFT JOIN booking_checkouts c ON c.booking=b.id WHERE b.status='confirmed'`,[current,current,current]),
  ])
  const capacity = inventory.filter(i=>i.active).reduce((sum,i)=>sum+Number(i.stock),0)
  const intervals = closures.map(c=>[c.start_date > from ? c.start_date : from,c.end_date < to ? c.end_date : to]).filter(([a,b])=>a<=b).sort((a,b)=>a[0].localeCompare(b[0]))
  const merged=[]
  for(const interval of intervals) {
    const last=merged.at(-1)
    if(last && interval[0]<=last[1]) last[1]=last[1]>interval[1]?last[1]:interval[1]
    else merged.push([...interval])
  }
  const openNights=Math.max(0,stayNights(from,to)+1-merged.reduce((sum,[a,b])=>sum+stayNights(a,b)+1,0))
  const used=usage.filter(i=>i.kind!=='gear').reduce((sum,i)=>sum+Number(i.used),0)
  return {from,to,stats:stats[0],recent,inventory,calendar,closures,usage,trend,revenue,extras:extras[0],reports,today:todayRows[0],capacity,openNights,used,
    occupancy:capacity*openNights ? used/(capacity*openNights)*100 : 0}
}
