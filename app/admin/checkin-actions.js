'use server'

import { redirect } from 'next/navigation'
import { isStaff } from '../../lib/auth'
import { today } from '../../lib/camp'
import { transaction } from '../../lib/db'
import { adminUrl } from './navigation'
import { checkinAdded, checkinFilters, checkinGear, checkinGuestMax, checkinItemMax, checkinNights, checkinNoteMax, checkinPosition } from './checkin-data'

const whole = (value, max) => {
  const text = String(value ?? '').trim()
  return /^\d{1,4}$/.test(text) && Number(text) <= max ? Number(text) : null
}

// Check-in, or a later change to it before check-out: the guests who actually came, a note, and extra rental equipment.
// Added equipment goes onto the booking (lines, total, stock) at the listed price × the nights still ahead, and its
// amount is remembered as unpaid so the check-out bill collects it.
export async function saveCheckin(id, query, _state, form) {
  if (!(await isStaff())) redirect('/admin')
  if (typeof id !== 'string' || !/^[A-F0-9]{20}$/.test(id)) return { error:'ไม่พบรายการจอง' }
  const guests = ['adults','children','seniors'].map(name => whole(form.get(name),checkinGuestMax))
  if (guests.includes(null) || guests[0] + guests[1] + guests[2] < 1) return { error:'ระบุจำนวนผู้เข้าพักจริงอย่างน้อย 1 คน' }
  const note = String(form.get('note') || '').replace(/\r\n?/g,'\n').trim()
  if (note.length > checkinNoteMax) return { error:`หมายเหตุต้องไม่เกิน ${checkinNoteMax} ตัวอักษร` }
  const wanted = new Map()
  for (const [name,value] of form.entries()) {
    if (!name.startsWith('add:')) continue
    const quantity = whole(value,checkinItemMax), code = name.slice(4)
    if (quantity === null || !/^[A-Z0-9][A-Z0-9-]{0,23}$/.test(code)) return { error:'จำนวนอุปกรณ์ไม่ถูกต้อง' }
    if (quantity > 0) wanted.set(code,quantity)
  }

  const error = await transaction(async connection => {
    const [[booking]] = await connection.execute('SELECT id,status,arrival,departure,adults,children,seniors FROM bookings WHERE id=? FOR UPDATE',[id])
    if (!booking || booking.status !== 'confirmed') return 'รายการจองนี้ไม่สามารถ Check-in ได้'
    if (booking.arrival > today()) return 'Check-in ได้ตั้งแต่วันเช็กอิน'
    const [[checkout]] = await connection.execute('SELECT completed_at FROM booking_checkouts WHERE booking=?',[id])
    if (checkout?.completed_at) return 'รายการนี้ Check-out แล้ว แก้ไขไม่ได้'
    // The form says how many additions it was drawn with; a second send of the same form (double click) is refused.
    const added = await checkinAdded(id,connection)
    if (String(form.get('seen')) !== String(added.length)) return 'รายการถูกแก้ไขแล้ว กรุณาเปิดใหม่เพื่อตรวจสอบข้อมูลล่าสุด'

    let amount = 0
    if (wanted.size) {
      const codes = [...wanted.keys()]
      await connection.execute(`SELECT code FROM inventory WHERE code IN (${codes.map(() => '?').join(',')}) FOR UPDATE`,codes)
      const nights = checkinNights(booking)
      const gear = await checkinGear(nights,connection,codes)
      if (gear.length !== codes.length) return 'อุปกรณ์บางรายการปิดให้เช่าแล้ว กรุณาเปิดใหม่เพื่อเลือกอีกครั้ง'
      for (const item of gear) {
        const quantity = wanted.get(item.code)
        if (quantity > item.available) return `${item.name} เหลือ ${item.available} ในคืนที่พัก ต้องการ ${quantity}`
        const line = item.price * quantity * nights.length
        amount += line
        await connection.execute(
          `INSERT INTO booking_lines (booking,code,name,quantity,amount) VALUES (?,?,?,?,?)
           ON DUPLICATE KEY UPDATE quantity=quantity+VALUES(quantity),amount=amount+VALUES(amount)`,[id,item.code,item.name,quantity,line])
        await connection.query(
          'INSERT INTO allocations (code,night,booking,quantity) VALUES ? ON DUPLICATE KEY UPDATE quantity=quantity+VALUES(quantity)',
          [nights.map(night => [item.code,night,id,quantity])])
        await connection.execute(
          'INSERT INTO booking_checkin_items (booking,code,name,quantity,unit_price,nights,amount,created_at) VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP())',
          [id,item.code,item.name,quantity,item.price,nights.length,line])
      }
    }
    await connection.execute('UPDATE bookings SET adults=?,children=?,seniors=?,total=total+? WHERE id=?',[...guests,amount,id])
    await connection.execute(
      `INSERT INTO booking_checkins (booking,booked_adults,booked_children,booked_seniors,note,added_amount,checked_in_at)
       VALUES (?,?,?,?,?,?,UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE note=VALUES(note),added_amount=added_amount+VALUES(added_amount)`,
      [id,booking.adults,booking.children,booking.seniors,note,amount])
    return null
  })
  if (error) return { error }
  redirect(adminUrl('checkin',{ ...checkinFilters(query),...checkinPosition(query),view:id,saved:'checkin' }))
}
