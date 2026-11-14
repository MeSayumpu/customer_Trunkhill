import { createHash } from 'node:crypto'
import { CampError, lockStaySettings } from './camp'
import { database, transaction } from './db'
import { uploadMime } from './payment-rules'
import { wholeCampCode } from './whole-camp'
import { lockPhoneGuard } from './phone-guard'
import {claimUpload,lockStorage,ensureStorage,storageId} from './storage'

function credentials(request) {
  const id = request.nextUrl.searchParams.get('id')
  const token = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]
  if (!id || !/^[A-F0-9]{20}$/.test(id) || !token) throw new CampError('ไม่พบข้อมูลชำระเงิน',404)
  return [id,createHash('sha256').update(token).digest('hex')]
}

export async function paymentDetails(request) {
  const [id,tokenHash] = credentials(request)
  const [[booking]] = await database().execute(
    `SELECT b.id,(SELECT reference FROM booking_references WHERE booking=b.id) AS reference,b.guest,b.arrival,b.departure,b.total,b.tent_discount,b.status,b.adults,b.children,b.seniors,
      TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(),p.expires_at) AS remaining,
      p.submitted_at IS NOT NULL AS submitted,config.recipient,config.bank_name,config.bank_account
     FROM booking_payments p JOIN bookings b ON b.id=p.booking
     LEFT JOIN payment_config config ON config.id=1 WHERE p.booking=? AND p.token_hash=?`,[id,tokenHash])
  if (!booking) throw new CampError('ไม่พบข้อมูลชำระเงิน',404)
  const [items] = await database().execute(
    'SELECT name,quantity,amount FROM booking_lines WHERE booking=? ORDER BY code',[id])
  const [[rejection]] = await database().execute(
    `SELECT g.blocked_at FROM duplicate_slip_events e JOIN booking_phone_guards g ON g.phone=e.phone WHERE e.booking=?`,[id])
  return { ...booking, items, duplicateRejected:!!rejection, phoneBlocked:!!rejection?.blocked_at }
}

export async function cancelPayment(request) {
  const [id,tokenHash] = credentials(request)
  await transaction(async connection => {
    const [[booking]] = await connection.execute('SELECT status FROM bookings WHERE id=? FOR UPDATE',[id])
    const [[payment]] = await connection.execute('SELECT submitted_at FROM booking_payments WHERE booking=? AND token_hash=?',[id,tokenHash])
    if (!booking || !payment) throw new CampError('ไม่พบข้อมูลชำระเงิน',404)
    if (booking.status === 'cancelled') return
    if (booking.status !== 'pending' || payment.submitted_at) {
      throw new CampError('รายการนี้ส่งสลิปหรือยืนยันแล้ว กรุณาติดต่อแคมป์เพื่อยกเลิก',409)
    }
    const [lines] = await connection.execute('SELECT code FROM booking_lines WHERE booking=? ORDER BY code',[id])
    await lockStaySettings(connection,lines.some(line => line.code === wholeCampCode))
    for (const {code} of lines) await connection.execute('SELECT code FROM inventory WHERE code=? FOR UPDATE',[code])
    await connection.execute('DELETE FROM allocations WHERE booking=?',[id])
    await connection.execute("UPDATE bookings SET status='cancelled' WHERE id=?",[id])
  })
  return paymentDetails(request)
}

export async function submitPayment(request) {
  const [id,tokenHash] = credentials(request)
  // Authenticate before processing an upload.
  const [[eligible]] = await database().execute(
    `SELECT b.status,p.submitted_at,p.expires_at > UTC_TIMESTAMP() AS live,config.recipient
     FROM booking_payments p JOIN bookings b ON b.id=p.booking
     LEFT JOIN payment_config config ON config.id=1 WHERE p.booking=? AND p.token_hash=?`,[id,tokenHash])
  if (!eligible) throw new CampError('ไม่พบข้อมูลชำระเงิน',404)
  if (eligible.status === 'cancelled') return paymentDetails(request)
  if (eligible.submitted_at) return paymentDetails(request)
  if (!eligible.live) throw new CampError('หมดเวลาชำระเงิน กรุณาจองใหม่',409)
  if (!eligible.recipient) throw new CampError('แคมป์ยังไม่ได้ตั้งค่า QR รับเงิน',409)
  const form = await request.formData()
  const file = form.get('slip')
  if(!storageId(file))throw new CampError('กรุณาแนบสลิปอีกครั้ง')
  await transaction(async connection => {
    await lockStorage(connection)
    const [[booking]] = await connection.execute('SELECT status,phone FROM bookings WHERE id=? FOR UPDATE',[id])
    const [[payment]] = await connection.execute(
      'SELECT submitted_at FROM booking_payments WHERE booking=? AND token_hash=?',[id,tokenHash])
    if (!payment || !booking) throw new CampError('ไม่พบข้อมูลชำระเงิน',404)
    if (booking.status === 'cancelled') return
    if (payment.submitted_at) return
    if (booking.status !== 'pending') throw new CampError('รายการนี้ไม่อยู่ระหว่างรอชำระเงิน',409)
    const {content:bytes,mime,fileHash}=await claimUpload(connection,file,id+':'+tokenHash,'slip')
    const guard = await lockPhoneGuard(connection,booking.phone)
    if (guard.blocked_at) throw new CampError('เบอร์โทรนี้ถูกระงับ กรุณาติดต่อแคมป์เพื่อปลดล็อก',403)
    const [[live]] = await connection.execute('SELECT expires_at > UTC_TIMESTAMP() AS valid FROM booking_payments WHERE booking=?',[id])
    if (!live.valid) throw new CampError('หมดเวลาชำระเงิน กรุณาจองใหม่',409)
    // Unique hash claim serializes concurrent submissions of the same file.
    await connection.execute('INSERT IGNORE INTO payment_file_claims (file_hash,booking) VALUES (?,?)',[fileHash,id])
    const [[claim]] = await connection.execute('SELECT booking FROM payment_file_claims WHERE file_hash=? FOR UPDATE',[fileHash])
    const [[config]] = await connection.query('SELECT id FROM payment_config WHERE id=1')
    if (!config) throw new CampError('แคมป์ยังไม่ได้ตั้งค่า QR รับเงิน',409)
    const [lines] = await connection.execute('SELECT code FROM booking_lines WHERE booking=? ORDER BY code',[id])
    await lockStaySettings(connection, lines.some(line => line.code === wholeCampCode))
    for (const { code } of lines) {
      await connection.execute('SELECT code FROM inventory WHERE code=? FOR UPDATE',[code])
    }
    if (claim.booking !== id) {
      await connection.execute('INSERT INTO duplicate_slip_events (booking,phone,file_hash) VALUES (?,?,?)',[id,guard.phone,fileHash])
      const count = Number(guard.duplicate_count) + 1
      await connection.execute('UPDATE booking_phone_guards SET duplicate_count=?,blocked_at=IF(? > 3,UTC_TIMESTAMP(),NULL) WHERE phone=?',[count,count,guard.phone])
      await connection.execute('UPDATE booking_payments SET mime=?,slip=? WHERE booking=?',[mime,bytes,id])
      await connection.execute('DELETE FROM allocations WHERE booking=?',[id])
      await connection.execute("UPDATE bookings SET status='cancelled' WHERE id=?",[id])
      await ensureStorage(connection)
      return
    }
    const [result] = await connection.execute(
      `UPDATE booking_payments SET submitted_at=UTC_TIMESTAMP(),mime=?,slip=?
       WHERE booking=? AND submitted_at IS NULL AND expires_at > UTC_TIMESTAMP()`,[mime,bytes,id])
    if (!result.affectedRows) throw new CampError('หมดเวลาชำระเงิน กรุณาจองใหม่',409)
    await ensureStorage(connection)
  })
  return paymentDetails(request)
}
