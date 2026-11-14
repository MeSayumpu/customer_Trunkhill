import { assertStayAvailable, assertStock, bookingIdentity, CampError, dates, integer, lockStaySettings, lookup, openCalendar, phoneNumber, today } from './camp'
import { rescheduleLimit, rescheduleReason, stayNights } from './booking-dates'
import { transaction } from './db'
import { wholeCampCode } from './whole-camp'

export async function rescheduleBooking({id,phone,arrival,departure,revision,guest}) {
  const identity = bookingIdentity(id,phoneNumber(phone))
  if (!integer(revision,0,255)) throw new CampError('ข้อมูลการจองเปลี่ยนแล้ว กรุณาค้นหาใหม่')
  const newGuest = guest === undefined ? undefined : typeof guest === 'string' ? guest.trim() : ''
  if (newGuest !== undefined && (!newGuest || newGuest.length > 120)) throw new CampError('กรอกชื่อผู้จองให้ถูกต้อง')
  const nights = dates(arrival,departure)
  try {
    await transaction(async connection => {
      const [[booking]] = await connection.execute(
        'SELECT id,guest,status,arrival,departure,reschedule_count FROM bookings WHERE id=? AND phone=? FOR UPDATE',identity)
      if (!booking) throw new CampError('ไม่พบรายการจอง',404)
      const sameDates = booking.arrival === arrival && booking.departure === departure
      const updatedGuest = newGuest ?? booking.guest
      const sameGuest = updatedGuest === booking.guest
      if (booking.reschedule_count === revision + 1 && sameDates && sameGuest) return
      if (booking.reschedule_count !== revision) throw new CampError('รายการถูกเลื่อนไปแล้ว กรุณาค้นหาใหม่ก่อนเลือกวันที่',409)
      const [[checkout]] = await connection.execute('SELECT booking FROM booking_checkouts WHERE booking=?',[booking.id])
      const [[policy]] = await connection.query('SELECT reschedule_notice_days,reschedule_limit FROM settings WHERE id=1 FOR UPDATE')
      const reason = rescheduleReason({...booking,checked_out:!!checkout},today(),policy.reschedule_notice_days,policy.reschedule_limit??rescheduleLimit)
      if (reason) throw new CampError(reason,409)
      if (sameDates && sameGuest) throw new CampError('กรุณาแก้ไขชื่อผู้จองหรือเลือกวันเข้าพักใหม่')
      if (nights.length !== stayNights(booking.arrival,booking.departure)) throw new CampError('กรุณาคงจำนวนคืนเท่ากับการจองเดิม')
      if (sameDates) {
        await connection.execute('UPDATE bookings SET guest=?,reschedule_count=reschedule_count+1 WHERE id=?',[updatedGuest,booking.id])
        return
      }

      const [lines] = await connection.execute('SELECT code,name,quantity FROM booking_lines WHERE booking=?',[booking.id])
      if (!lines.length) throw new CampError('รายการนี้ไม่มีข้อมูลล็อกหรืออุปกรณ์ กรุณาติดต่อแคมป์',409)
      lines.sort((a,b) => a.code < b.code ? -1 : 1)
      const wholeCamp = lines.some(line => line.code === wholeCampCode)
      await lockStaySettings(connection, wholeCamp)
      const stock = []
      for (const line of lines) {
        const [[item]] = await connection.execute('SELECT stock,active FROM inventory WHERE code=? FOR UPDATE',[line.code])
        if (!item || (!item.active && line.code !== wholeCampCode)) {
          throw new CampError(`${line.name} ไม่เปิดให้จองในวันใหม่ กรุณาติดต่อแคมป์`,409)
        }
        stock.push({...line,stock:item.stock})
      }
      await openCalendar(connection, nights)
      await assertStayAvailable(connection, arrival, departure, wholeCamp, booking.id)
      await assertStock(connection,stock,arrival,departure,booking.id)
      await connection.execute('DELETE FROM allocations WHERE booking=?',[booking.id])
      await connection.query('INSERT INTO allocations (code,night,booking,quantity) VALUES ?',[
        lines.flatMap(line => nights.map(night => [line.code,night,booking.id,line.quantity])),
      ])
      await connection.execute(
        'UPDATE bookings SET guest=?,arrival=?,departure=?,reschedule_count=reschedule_count+1 WHERE id=?',
        [updatedGuest,arrival,departure,booking.id])
    })
  } catch (error) {
    if (['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) throw new CampError('ระบบกำลังประมวลผล กรุณาลองอีกครั้ง',503)
    throw error
  }
  return lookup(...identity)
}
