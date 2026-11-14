const day = 86_400_000
export const stayNights = (arrival, departure) => (Date.parse(departure) - Date.parse(arrival)) / day
export const shiftDate = (date, days) => new Date(Date.parse(date) + days * day).toISOString().slice(0,10)
export const rescheduleLimit = 3
export const rescheduleNotice = 3

export function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false
  const time = Date.parse(value)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0,10) === value
}

export function rescheduleReason(booking, today, notice=rescheduleNotice, limit=rescheduleLimit) {
  if (booking.checked_out || !['confirmed','pending'].includes(booking.status)) return 'รายการยกเลิกหรือ Check-out แล้ว ไม่สามารถเลื่อนได้'
  if (booking.status==='pending' && !booking.payment_submitted) return 'กรุณาส่งสลิปก่อนเลื่อนการจอง ไม่ต้องรอแอดมินยืนยันสลิป'
  if (limit===0) return 'แคมป์ปิดรับการเลื่อนการจอง กรุณาติดต่อแอดมิน'
  if (booking.reschedule_count >= limit) return `ใช้สิทธิ์เลื่อนครบตามโควต้า ${limit} ครั้งแล้ว`
  if (booking.arrival < shiftDate(today,notice)) return notice === 0 ? 'เลยวันเข้าพักเดิมแล้ว กรุณาติดต่อแอดมิน' : `ต้องเลื่อนหรือแก้ไขล่วงหน้าอย่างน้อย ${notice} วันก่อนวันเข้าพักเดิม`
  return ''
}
