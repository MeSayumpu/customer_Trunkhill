import { isAdmin } from '../../../lib/auth'
import { database } from '../../../lib/db'
import { isCalendarDate } from '../../../lib/booking-dates'
import { effectiveStatus } from '../../../lib/payment-rules'
import { statuses } from '../../../lib/pricing'
import { itemOrder } from '../../../lib/rentals'
import { readMedia } from '../../../lib/storage'
import { slipArchivedMime } from '../booking-backup-data'
import { zipMaxBytes, zipMaxFiles, zipStream } from '../../../lib/zip'

// Backup of the bookings that checked out in a period: two CSV files and every transfer slip, in one ZIP.
// Nothing is deleted or changed; the admin keeps the file as the record of those bookings.
const extensions = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'}
const range = 'b.departure BETWEEN ? AND ?'
const joins = 'FROM bookings b LEFT JOIN booking_payments p ON p.booking=b.id LEFT JOIN booking_references br ON br.booking=b.id'
function csv(values) {
  return values.map(value => {
    let text = String(value ?? '')
    // Text that a spreadsheet would run as a formula is stored as plain text.
    if (typeof value === 'string' && /^[\s﻿]*[=+\-@＝＋－＠]/u.test(text)) text = "'" + text
    return '"' + text.replaceAll('"','""') + '"'
  }).join(',') + '\r\n'
}

async function* files(from,to,signal) {
  const bookings = ['﻿' + csv(['รหัสจอง','รหัสระบบ','ผู้จอง','เบอร์โทร','เช็กอิน','เช็กเอาต์','ผู้ใหญ่','เด็ก','ผู้สูงอายุ','ยอดรวม','ส่วนลดเต็นท์','สถานะ','Check-out แล้ว','จำนวนครั้งที่เลื่อน','วันเวลาที่จอง (เวลาไทย)','วันเวลาที่ส่งสลิป (เวลาไทย)','ไฟล์สลิป'])]
  const items = ['﻿' + csv(['รหัสจอง','รหัสรายการ','ชื่อรายการ','จำนวน','ยอดรายการ'])]
  let last = '', slips = 0, missing = 0
  while (!signal.aborted) {
    const [rows] = await database().execute(
      `SELECT b.id,br.reference,b.guest,b.phone,b.arrival,b.departure,b.adults,b.children,b.seniors,b.total,b.tent_discount,b.reschedule_count,
         DATE_ADD(b.created_at,INTERVAL 7 HOUR) AS made_at,DATE_ADD(p.submitted_at,INTERVAL 7 HOUR) AS slip_at,
         ${effectiveStatus} AS status,p.mime,(p.slip IS NOT NULL) AS has_slip,
         EXISTS (SELECT 1 FROM booking_checkouts c WHERE c.booking=b.id AND c.completed_at IS NOT NULL) AS checked_out
       ${joins} WHERE ${range} AND b.id>? ORDER BY b.id LIMIT 100`,[from,to,last])
    if (!rows.length) break
    last = rows.at(-1).id
    const ids = rows.map(row => row.id)
    const [lines] = await database().execute(
      `SELECT l.booking,l.code,l.name,l.quantity,l.amount FROM booking_lines l JOIN inventory i ON i.code=l.code
       WHERE l.booking IN (${ids.map(() => '?').join(',')}) ORDER BY l.booking,${itemOrder}`,ids)
    const names = new Map(rows.map(row => [row.id,row.reference || row.id]))
    for (const line of lines) items.push(csv([names.get(line.booking),line.code,line.name,line.quantity,line.amount]))
    for (const row of rows) {
      const name = names.get(row.id)
      let slipName = ''
      if (row.has_slip) {
        // One slip at a time, so memory holds a single file however long the period is.
        const [[payment]] = await database().execute('SELECT slip FROM booking_payments WHERE booking=?',[row.id])
        const content = await readMedia(payment?.slip)
        if (content) {
          slipName = `slips/${name}.${extensions[row.mime] || 'bin'}`
          slips++
          yield { name:slipName, content }
        } else { slipName = 'ไม่พบไฟล์'; missing++ }
      } else if (row.mime === slipArchivedMime) slipName = 'ลบออกจากระบบแล้ว ดูในไฟล์สำรองก่อนหน้า'
      bookings.push(csv([name,row.id,row.guest,"'" + row.phone,row.arrival,row.departure,row.adults,row.children,row.seniors,row.total,row.tent_discount,
        row.status === 'pending' && row.slip_at ? 'รอตรวจสลิป' : statuses[row.status],row.checked_out ? 'ใช่' : 'ไม่',row.reschedule_count,row.made_at,row.slip_at ?? '',slipName]))
    }
  }
  yield { name:'bookings.csv', content:bookings.join('') }
  yield { name:'booking-items.csv', content:items.join('') }
  yield { name:'README.txt', content:[
    'Trunkhill Campfield - สำรองข้อมูลการจอง',
    `ช่วงวันเช็กเอาต์: ${from} ถึง ${to}`,
    `จำนวนการจอง: ${bookings.length - 1} รายการ · สลิป: ${slips} ไฟล์${missing ? ` · ไม่พบไฟล์สลิป ${missing} รายการ` : ''}`,
    `สร้างเมื่อ: ${new Date().toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})} (เวลาไทย)`,
    '',
    'bookings.csv       รายการจอง หนึ่งแถวต่อหนึ่งการจอง',
    'booking-items.csv  ล็อก ห้องพัก และอุปกรณ์ของแต่ละการจอง',
    'slips/             สลิปการโอน ตั้งชื่อไฟล์ตามรหัสจอง',
    '',
    'ไฟล์นี้มีข้อมูลส่วนบุคคลของลูกค้า (ชื่อ เบอร์โทร สลิปการโอน) กรุณาเก็บในที่ปลอดภัย',
  ].join('\r\n') }
}

export async function GET(request) {
  if (!(await isAdmin())) return new Response(null,{status:403})
  const from = request.nextUrl.searchParams.get('from'), to = request.nextUrl.searchParams.get('to')
  const redirect = reason => {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    url.search = new URLSearchParams({section:'storage',backup:reason,from:from || '',to:to || ''}).toString()
    return Response.redirect(url,303)
  }
  if (!isCalendarDate(from) || !isCalendarDate(to) || from > to) return redirect('invalid')
  // Size is checked before the download starts: a ZIP cannot be cut short halfway without breaking it.
  const [[summary]] = await database().execute(
    `SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN p.slip IS NULL THEN 0 WHEN LEFT(p.slip,9)='@storage:'
       THEN COALESCE((SELECT a.bytes FROM storage_assets a WHERE a.id=CONVERT(SUBSTRING(p.slip,10) USING ascii)),0) ELSE LENGTH(p.slip) END),0) AS bytes
     ${joins} WHERE ${range}`,[from,to])
  if (!Number(summary.total)) return redirect('empty')
  if (Number(summary.total) + 3 > zipMaxFiles || Number(summary.bytes) + Number(summary.total) * 4096 > zipMaxBytes) return redirect('large')
  return new Response(ReadableStream.from(zipStream(files(from,to,request.signal))),{headers:{
    'Content-Type':'application/zip','Content-Disposition':`attachment; filename="trunkhill-backup-${from}_${to}.zip"`,
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
  }})
}
